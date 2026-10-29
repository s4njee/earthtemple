import { SPECIES, SPECIES_NAMES, type SpeciesName } from '../../gpu/grass/blade.ts';
import { cropToBottom, groundCamera } from '../../gpu/grass/camera.ts';
import {
  ALL_PARTS,
  createGrassField,
  FLAGS,
  without,
  type GrassField,
  type Lighting,
  type Part,
} from '../../gpu/grass/field.ts';
import { createGrassStrip, type GrassStrip } from '../../gpu/grass/strip.ts';
import { trackPointer } from '../../gpu/pointer.ts';
import { createHdrTail, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct } from '../../gpu/uniforms.ts';
import { createTrample, type Brush } from '../../gpu/wind/trample.ts';
import { defineEffect } from '../types.ts';
import dofShader from './dof.wgsl';
import { meta } from './meta.ts';
import pollenShader from './pollen.wgsl';
import skyShader from './sky.wgsl';

// Story 3.2: the meadow, the grass engine's showpiece. A field at eye level running to the horizon:
// blades out to `reach`, then the canopy ground to the horizon (story 2.8), under a sky whose
// clouds cast the shadows crossing the grass. The pointer brushes a path through it, kept in the
// trample field, which springs back (2.5). The nearest blades are out of focus, and pollen hangs in
// the light. Each part of the recipe can be switched off, one at a time, for the realism study (2.9).

const SkyParams = defineUniformStruct('SkyParams', {
  zenith: 'vec3f',
  sx: 'f32',
  haze: 'vec3f',
  sy: 'f32',
  sun_dir: 'vec3f',
  horizon: 'f32',
  sun: 'vec3f',
  glow: 'f32',
  eye: 'vec3f',
  time: 'f32',
  wind_dir: 'vec2f',
  cloud_depth: 'f32',
  cloud_scale: 'f32',
  cloud_speed: 'f32',
  hedge_colour: 'vec3f',
  hedge: 'f32',
});

const DofParams = defineUniformStruct('DofParams', {
  focus: 'f32',
  aperture: 'f32',
  max_radius: 'f32',
  strip_top: 'f32',
});

const PollenParams = defineUniformStruct('PollenParams', {
  view_proj: 'mat4x4f',
  eye: 'vec3f',
  time: 'f32',
  sun_dir: 'vec3f',
  focal: 'f32',
  sun: 'vec3f',
  focus: 'f32',
  sky: 'vec3f',
  aperture: 'f32',
  wind: 'vec2f',
  viewport: 'vec2f',
  max_radius: 'f32',
  strip_top: 'f32',
  amount: 'f32',
});

type Vec3 = readonly [number, number, number];
const norm = (v: Vec3): [number, number, number] => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};

interface Time {
  /** Eye height, horizon in NDC, the distance to the ground at the bottom edge, where grass starts. */
  eye: number;
  horizon: number;
  bottom: number;
  start: number;
  /** Focus distance, m, and the blur at 1080p of something at twice or half of it, px. */
  focus: number;
  aperture: number;
  reach: number;
  fade: number;
  lod0: number;
  lod1: number;
  light: Lighting;
  zenith: Vec3;
  glow: number;
  pollen: number;
  /** The far hedge's height, radians, and colour before the haze. */
  hedge: number;
  hedgeColour: Vec3;
}

const TIMES: Record<string, Time> = {
  midday: {
    eye: 1.55,
    horizon: 0.22,
    bottom: 3.6,
    start: 2.6,
    focus: 9,
    aperture: 0.7,
    reach: 34,
    fade: 7,
    lod0: 7,
    lod1: 15,
    light: {
      sunDir: norm([0.45, 0.8, -0.4]),
      sun: [3.0, 2.85, 2.6],
      sky: [0.28, 0.36, 0.5],
      horizon: [0.62, 0.72, 0.86],
      transmit: 0.9,
      sheen: 0.9,
      cloudDepth: 0.5,
      cloudScale: 700,
      cloudSpeed: 6,
      fog: 260,
      soil: [0.08, 0.055, 0.03],
      groundMode: 1,
    },
    zenith: [0.16, 0.32, 0.72],
    glow: 0.5,
    pollen: 0.4,
    hedge: 0.014,
    hedgeColour: [0.08, 0.13, 0.07],
  },
  'golden hour': {
    // Just above the grass, kneeling. Lower, among the blades, the near ones are a row of tall
    // blurred stripes the pattern rule counts, and they sweep across the view faster than the
    // motion caps allow (story 2.10).
    eye: 0.95,
    horizon: 0.05,
    bottom: 2.2,
    start: 1.3,
    // Focused where a photographer would, a few metres out: most of the frame is nearer than the
    // middle distance, so a far focus blurs nearly all of it.
    focus: 4.5,
    aperture: 2.4,
    reach: 26,
    fade: 5,
    lod0: 5,
    lod1: 11,
    light: {
      sunDir: norm([-0.22, 0.09, 0.97]),
      sun: [3.5, 1.95, 0.8],
      sky: [0.16, 0.15, 0.18],
      horizon: [1.0, 0.62, 0.34],
      transmit: 1,
      sheen: 1.2,
      cloudDepth: 0.25,
      cloudScale: 800,
      cloudSpeed: 4,
      fog: 180,
      soil: [0.08, 0.055, 0.03],
      groundMode: 1,
    },
    zenith: [0.22, 0.3, 0.48],
    glow: 1.2,
    pollen: 1,
    hedge: 0.008,
    hedgeColour: [0.12, 0.07, 0.04],
  },
  dusk: {
    eye: 1.25,
    horizon: 0.15,
    bottom: 2.8,
    start: 1.9,
    focus: 8,
    // In the dusk light a blur barely shows; under 2 px, the pass is skipped.
    aperture: 0.6,
    reach: 28,
    fade: 6,
    lod0: 6,
    lod1: 13,
    light: {
      sunDir: norm([-0.3, -0.05, 0.95]),
      sun: [0.35, 0.18, 0.08],
      sky: [0.07, 0.08, 0.13],
      horizon: [0.55, 0.34, 0.3],
      transmit: 0.8,
      sheen: 0.5,
      cloudDepth: 0.2,
      cloudScale: 800,
      cloudSpeed: 3,
      fog: 200,
      soil: [0.06, 0.045, 0.03],
      groundMode: 1,
    },
    zenith: [0.05, 0.07, 0.18],
    glow: 2,
    pollen: 0,
    hedge: 0.012,
    hedgeColour: [0.02, 0.02, 0.03],
  },
};

/** Walking pace through the grass, m/s. */
const WALK = 0.8;

/**
 * The camera's own motion, in the motion caps' units: zoom doublings a second from walking
 * forwards, v / (z ln 2) at the focus distance, and screen widths a second of sideways drift there.
 * The motion check reads optical flow, which grass gives it too little of to follow (story 2.10),
 * so the caps are held from this.
 */
export function cameraMotion(time: string, walk: boolean, drift: number) {
  const t = TIMES[time] ?? TIMES.midday!;
  // The view's width at distance z is 2 z s a; with the bottom edge fixed, s a is set by the camera.
  const s = t.eye / t.bottom / (t.horizon + 1);
  return {
    zoom: walk ? WALK / (t.focus * Math.LN2) : 0,
    drift: drift / (2 * t.focus * s * (16 / 9)),
  };
}

const PARTS = Object.keys(FLAGS) as Part[];
const ABLATIONS = ['none', ...PARTS, 'antialias', 'depth of field', 'pollen', 'flowers'] as const;

/** Blades per list. */
const CAPACITY = 220_000;
const POLLEN = 700;
/** The meadow's grass: the species' tall meadow grass, half as tall again. */
const HEIGHT = 1.6;
const WIND: readonly [number, number] = [0.42 / 1.002, 0.91 / 1.002];

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    time: { type: 'select', default: 'midday', options: Object.keys(TIMES) },
    grass: { type: 'select', default: 'meadow', options: SPECIES_NAMES },
    density: { type: 'number', default: 0.8, min: 0.1, max: 1, step: 0.01 },
    flowers: { type: 'number', default: 0.35, min: 0, max: 1, step: 0.01, label: 'wildflowers' },
    blur: { type: 'number', default: 1, min: 0, max: 2, step: 0.05, label: 'depth of field' },
    drift: { type: 'number', default: 0.12, min: 0, max: 0.4, step: 0.01, label: 'drift, m/s' },
    walk: { type: 'boolean', default: false, label: 'walk through' },
    ablate: { type: 'select', default: 'none', options: ABLATIONS, label: 'without' },
    distance: {
      type: 'select',
      default: 'canopy',
      options: ['canopy', 'shells'],
      label: 'far grass',
    },
    seed: { type: 'number', default: 3, min: 1, max: 999, step: 1 },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0.35 },
    bloomThreshold: { ...TAIL_PARAMS.bloomThreshold, default: 1.6 },
  },
  presets: {
    midday: {},
    'golden hour': { time: 'golden hour' },
    dusk: { time: 'dusk' },
    sparse: { density: 0.45, flowers: 0.3 },
    'walk through': { walk: true },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'meadow' });
    const sceneFormat = tail.scene.format;
    let samples = 0;
    let field: GrassField | undefined;
    let strip: GrassStrip | undefined;
    const build = (n: number) => {
      field?.destroy();
      strip?.destroy();
      samples = n;
      field = createGrassField(device, {
        capacity: CAPACITY,
        format: sceneFormat,
        sampleCount: n,
        distance: true,
        label: 'meadow',
      });
      strip = createGrassStrip(device, {
        format: sceneFormat,
        samples: n,
        distance: true,
        label: 'meadow strip',
      });
    };
    build(4);
    const trample = createTrample(device, { size: 256, cell: 0.06, tau: 2.5 });
    const pointer = trackPointer(canvas);

    const skyUniforms = createUniformBuffer(device, SkyParams, 'meadow sky');
    const skyModule = createShader(
      device,
      withChunks(skyShader, { 'sky-params.wgsl': SkyParams.wgsl }),
    );
    const skyPipeline = device.createRenderPipeline({
      label: 'meadow sky',
      layout: 'auto',
      vertex: { module: skyModule, entryPoint: 'sky_vs' },
      fragment: { module: skyModule, entryPoint: 'sky_fs', targets: [{ format: sceneFormat }] },
    });
    const skyGroup = device.createBindGroup({
      layout: skyPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: skyUniforms.buffer } }],
    });

    const dofUniforms = createUniformBuffer(device, DofParams, 'meadow dof');
    const dofModule = createShader(
      device,
      withChunks(dofShader, { 'dof-params.wgsl': DofParams.wgsl }),
    );
    const dofPipeline = device.createRenderPipeline({
      label: 'meadow dof',
      layout: 'auto',
      vertex: { module: dofModule, entryPoint: 'dof_vs' },
      fragment: { module: dofModule, entryPoint: 'dof_fs', targets: [{ format: sceneFormat }] },
    });

    const pollenUniforms = createUniformBuffer(device, PollenParams, 'meadow pollen');
    const pollenModule = createShader(
      device,
      withChunks(pollenShader, { 'pollen-params.wgsl': PollenParams.wgsl }),
    );
    const add: GPUBlendComponent = { srcFactor: 'one', dstFactor: 'one' };
    const pollenPipeline = device.createRenderPipeline({
      label: 'meadow pollen',
      layout: 'auto',
      vertex: { module: pollenModule, entryPoint: 'pollen_vs' },
      fragment: {
        module: pollenModule,
        entryPoint: 'pollen_fs',
        targets: [{ format: sceneFormat, blend: { color: add, alpha: add } }],
      },
      primitive: { topology: 'triangle-strip' },
    });

    let sharp: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;
    let lastHit: [number, number] | undefined;
    let groupsFor: { key: string; dof: GPUBindGroup; pollen: GPUBindGroup } | undefined;

    return {
      resize(w, h) {
        width = w;
        height = h;
        tail.resize(w, h);
        sharp?.destroy();
        sharp = device.createTexture({
          label: 'meadow sharp',
          size: [w, h],
          format: sceneFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        groupsFor = undefined;
      },
      frame(time, encoder, target) {
        const wanted = params.ablate === 'antialias' ? 1 : 4;
        if (wanted !== samples) {
          build(wanted);
          groupsFor = undefined;
        }
        clock += time.delta;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        const t = TIMES[params.time] ?? TIMES.midday!;
        const ablate = params.ablate as (typeof ABLATIONS)[number];
        const flags = (PARTS as readonly string[]).includes(ablate)
          ? without(ablate as Part)
          : ALL_PARTS;

        // The camera drifts sideways, slowly; walking through moves it forwards.
        const x = params.drift * clock;
        const z = params.walk ? WALK * clock : 0;
        const view = groundCamera({
          aspect: width / height,
          eyeHeight: t.eye,
          horizon: t.horizon,
          bottomDistance: t.bottom,
          start: t.start,
          near: 0.05,
          far: 3000,
          x,
          z,
        });
        // The rows the grass can reach: the tallest stem at the front of the field, or the horizon,
        // which grass lower than the eye rises towards with distance.
        const species = SPECIES[params.grass as SpeciesName] ?? SPECIES.meadow;
        const tallest = species.height[1] * HEIGHT * 1.3 * species.stemHeight;
        const reach = Math.max(
          t.horizon,
          view.scale[1] * ((tallest - t.eye) / t.start) + t.horizon,
        );
        const rows = Math.min(height, Math.ceil(((Math.min(reach, 1) + 1.04) / 2) * height));
        const top = (2 * rows) / height - 1;
        const camera = rows >= height ? view : cropToBottom(view, top);
        strip!.resize(width, rows);

        // The pointer brushes the grass: a ray to half the canopy's height.
        const brushes: Brush[] = [];
        const p = pointer.state;
        const canopy = ((species.height[0] + species.height[1]) / 2) * HEIGHT;
        if (p.inside && !time.still) {
          const nx = 2 * p.x - 1;
          const ny = 1 - 2 * p.y;
          const dir = [nx / view.scale[0], (ny - t.horizon) / view.scale[1], 1] as const;
          const along = (0.45 * canopy - t.eye) / dir[1];
          if (dir[1] < 0 && along > 0 && along < 25) {
            const hit: [number, number] = [x + dir[0] * along, z + along];
            const moved = lastHit ? Math.hypot(hit[0] - lastHit[0], hit[1] - lastHit[1]) : 0;
            const speed = moved / Math.max(time.delta, 1e-3);
            const radius = t.eye < 1 ? 0.25 : 0.35;
            brushes.push(
              speed > 0.2 && lastHit
                ? {
                    x: hit[0],
                    z: hit[1],
                    radius,
                    strength: 1.3,
                    along: [(hit[0] - lastHit[0]) / moved, (hit[1] - lastHit[1]) / moved],
                  }
                : { x: hit[0], z: hit[1], radius, strength: 0.5 },
            );
            lastHit = hit;
          }
        } else {
          lastHit = undefined;
        }
        trample.step(encoder, time.delta, x, z + 7, brushes);

        field!.update(
          camera,
          {
            species,
            density: params.density,
            heightScale: HEIGHT,
            clump: 0.18,
            lod0: t.lod0,
            lod1: t.lod1,
            fade: t.fade,
            reach: t.reach,
            wind: {
              dir: WIND,
              lean: dosed(dose, 0, 0.12, 0.28),
              // A held frame is a lull: no gust bending the field.
              gust: time.still ? 0 : dosed(dose, 0, 0.32, 0.75),
              speed: dosed(dose, 1.2, 3, 5.5),
              scale: 4.5,
              flutter: dosed(dose, 0, 0.05, 0.1),
            },
            pointer: [0, -2, 0.1, 0],
            trample,
            seed: params.seed,
            minPixels: 0.04,
            flags,
            flowers: ablate === 'flowers' ? 0 : params.flowers,
            shells: params.distance === 'shells',
          },
          clock,
          { width, height: rows },
        );
        field!.light(t.light);
        field!.compute(encoder, profiler.pass('place'));

        const grass = encoder.beginRenderPass({
          label: 'meadow grass',
          colorAttachments: [
            {
              view: strip!.colour,
              resolveTarget: strip!.resolveTarget,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: samples > 1 ? 'discard' : 'store',
            },
            {
              view: strip!.distance!,
              resolveTarget: strip!.distanceResolveTarget,
              loadOp: 'clear',
              clearValue: { r: 1e4, g: 0, b: 0, a: 0 },
              storeOp: samples > 1 ? 'discard' : 'store',
            },
          ],
          depthStencilAttachment: {
            view: strip!.depth,
            depthLoadOp: 'clear',
            depthClearValue: 1,
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('grass'),
        });
        field!.draw(grass);
        grass.end();

        // The sky, then the grass over it, sharp; then depth of field into the scene.
        const blur = ablate === 'depth of field' ? 0 : params.blur;
        const scale = height / 1080;
        const focusBlur = t.aperture * blur * scale;
        const stripTop = height - rows;
        const widestBlur = focusBlur * Math.max(1, t.focus / t.start - 1);
        // Under two pixels of blur anywhere in view, the pass is not worth its cost.
        const blurring = focusBlur > 0.05 && Math.min(18 * scale, widestBlur) >= 2;
        const into = blurring ? sharp!.createView() : tail.scene.view;
        const light = t.light;
        skyUniforms.set({
          zenith: t.zenith,
          sx: view.scale[0],
          haze: light.horizon ?? light.sky,
          sy: view.scale[1],
          sun_dir: light.sunDir,
          horizon: t.horizon,
          sun: light.sun,
          glow: t.glow,
          eye: view.eye,
          time: clock,
          wind_dir: WIND,
          cloud_depth: (flags & FLAGS.clouds) !== 0 ? (light.cloudDepth ?? 0) : 0,
          cloud_scale: light.cloudScale ?? 260,
          cloud_speed: light.cloudSpeed ?? 4,
          hedge: t.hedge,
          hedge_colour: t.hedgeColour,
        });
        skyUniforms.upload();
        const sky = encoder.beginRenderPass({
          label: 'meadow sky',
          colorAttachments: [{ view: into, loadOp: 'clear', storeOp: 'store' }],
          timestampWrites: profiler.pass('sky'),
        });
        sky.setPipeline(skyPipeline);
        sky.setBindGroup(0, skyGroup);
        sky.draw(3);
        sky.end();
        strip!.composite(encoder, into, height, true);

        const key = `${sharp!.label}${width}x${height}x${rows}x${samples}`;
        if (!groupsFor || groupsFor.key !== key) {
          groupsFor = {
            key,
            dof: device.createBindGroup({
              layout: dofPipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: dofUniforms.buffer } },
                { binding: 1, resource: sharp!.createView() },
                { binding: 2, resource: strip!.distanceResolve! },
              ],
            }),
            pollen: device.createBindGroup({
              layout: pollenPipeline.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: { buffer: pollenUniforms.buffer } },
                { binding: 1, resource: strip!.distanceResolve! },
              ],
            }),
          };
        }
        // The widest blur in view: the nearest grass, or the sky. Gathering wider is wasted.
        const widest = focusBlur * Math.max(1, t.focus / t.start - 1);
        const maxRadius = Math.min(18 * scale, widest);
        if (blurring) {
          dofUniforms.set({
            focus: t.focus,
            aperture: focusBlur,
            max_radius: maxRadius,
            strip_top: stripTop,
          });
          dofUniforms.upload();
          const dof = encoder.beginRenderPass({
            label: 'meadow dof',
            colorAttachments: [{ view: tail.scene.view, loadOp: 'clear', storeOp: 'store' }],
            timestampWrites: profiler.pass('focus'),
          });
          dof.setPipeline(dofPipeline);
          dof.setBindGroup(0, groupsFor.dof);
          dof.draw(3);
          dof.end();
        }

        const pollen = ablate === 'pollen' ? 0 : t.pollen;
        if (pollen > 0) {
          pollenUniforms.set({
            view_proj: view.viewProj,
            eye: view.eye,
            time: clock,
            sun_dir: light.sunDir,
            focal: (view.scale[0] * width) / 2,
            sun: light.sun,
            focus: t.focus,
            sky: light.sky,
            aperture: focusBlur,
            wind: WIND,
            viewport: [width, height],
            max_radius: maxRadius,
            strip_top: stripTop,
            amount: pollen,
          });
          pollenUniforms.upload();
          const motes = encoder.beginRenderPass({
            label: 'meadow pollen',
            colorAttachments: [{ view: tail.scene.view, loadOp: 'load', storeOp: 'store' }],
          });
          motes.setPipeline(pollenPipeline);
          motes.setBindGroup(0, groupsFor.pollen);
          motes.draw(4, POLLEN);
          motes.end();
        }
        tail.encode(encoder, target, time, params, profiler);
      },
      stats() {
        const [near, mid, far, flowers] = field!.counts();
        return { near, mid, far, flowers, cells: field!.cells };
      },
      destroy() {
        pointer.destroy();
        field?.destroy();
        strip?.destroy();
        trample.destroy();
        sharp?.destroy();
        skyUniforms.destroy();
        dofUniforms.destroy();
        pollenUniforms.destroy();
        tail.destroy();
      },
    };
  },
});
