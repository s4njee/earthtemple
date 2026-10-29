import { TULIP } from '../../gpu/flower/diagram.ts';
import { LOOKS, STEMS, type FlowerLook } from '../../gpu/flower/looks.ts';
import { FLAT_PETAL } from '../../gpu/flower/petal.ts';
import {
  createFlowerRenderer,
  type FlowerGroup,
  type FlowerHead,
} from '../../gpu/flower/render.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { pcg1d, toUnorm } from '../../gpu/hash.ts';
import { petalColours } from '../../gpu/optics/petal.ts';
import { createHdrTail, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct, uniformArray } from '../../gpu/uniforms.ts';
import { groundWind, type Wind } from '../../gpu/wind/wind.ts';
import { defineEffect } from '../types.ts';
import fieldShader from './field.wgsl';
import { meta } from './meta.ts';

// Story 12.6: a field of tulips in coloured beds, as the Dutch bulb fields are grown, running away
// from the viewer to the horizon. Each bed is one cultivar, coloured from its pigments (story 11.3).
// The nearest tulips are drawn whole by the shared flower renderer, in three bands by distance,
// each with the levels of detail its nearest needs, swaying on their stems in the grass engine's
// gusting wind; past them the ground takes its bed's colour, as heads seen at a grazing angle
// cover it, and the tulips drawn whole shrink away into it over the last few metres. Tulips open in
// the warmth and close in the cool: in the evening the field closes as the light goes.
//
// Beds are a grating, a regular pattern of stripes: a bed's cultivar is drawn at random, so beds of
// one colour run together and the stripes' widths vary, and the colours are kept close in lightness.

type Vec3 = [number, number, number];

const FieldParams = defineUniformStruct('FieldParams', {
  zenith: 'vec3f',
  sx: 'f32',
  horizon: 'vec3f',
  sy: 'f32',
  soil: 'vec3f',
  pitch: 'f32',
  leaf: 'vec3f',
  near: 'f32',
  sun_dir: 'vec3f',
  period: 'f32',
  sun: 'vec3f',
  haze: 'f32',
  sky: 'vec3f',
  seed: 'u32',
  eye: 'vec3f',
  colours: uniformArray('vec4f', 6),
});

/** The cultivars, from their pigments: red, yellow, pink, purple, white and orange. */
const CULTIVARS: FlowerLook[] = [
  LOOKS.tulip,
  {
    ...LOOKS.tulip,
    petal: { carotenoids: 42, layers: 1.8 },
    base: { carotenoids: 55, layers: 1.8 },
  },
  {
    ...LOOKS.tulip,
    petal: { anthocyanin: 5, pH: 4.2, layers: 2 },
    base: { anthocyanin: 2, carotenoids: 8, layers: 2.2 },
  },
  {
    ...LOOKS.tulip,
    petal: { anthocyanin: 22, pH: 5.6, layers: 1.6 },
    base: { anthocyanin: 35, pH: 5.8, layers: 1.5 },
  },
  {
    ...LOOKS.tulip,
    petal: { carotenoids: 0.5, layers: 2.9 },
    base: { carotenoids: 10, layers: 2.6 },
  },
  {
    ...LOOKS.tulip,
    petal: { carotenoids: 30, anthocyanin: 5, pH: 3.3, layers: 1.7 },
    base: { carotenoids: 45, layers: 1.8 },
  },
];

/** A bed and its furrow, m. */
const PERIOD = 2.6;
/** Tulips drawn whole out to here, m. */
const NEAR = 8;
const BANDS = [3, 6, NEAR] as const;
const SPACING = 0.19;
const EYE: Vec3 = [0, 1.55, 0];
const PITCH = 0.13;
const FOV = (44 * Math.PI) / 180;

/** Twin of field.wgsl's `bed_at`: whether x is in a bed, and its cultivar. */
export function bedAt(x: number, seed: number): { inside: boolean; cultivar: number } {
  const k = Math.floor(x / PERIOD);
  const key = (k + 4096) >>> 0;
  const inset = 0.12 + 0.1 * toUnorm(pcg1d(Math.imul(key, 3) + 1));
  const local = x - k * PERIOD;
  return {
    inside: local > inset && local < PERIOD - 0.6 * inset,
    cultivar: pcg1d((key + Math.imul(seed, 7919)) >>> 0) % 6,
  };
}

interface Bulb {
  x: number;
  z: number;
  cultivar: number;
  scale: number;
  yaw: number;
  phase: number;
  /** How far it is behind the field in opening, 0 to 1. */
  late: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    time: { type: 'select', default: 'day', options: ['day', 'evening'] },
    seed: { type: 'number', default: 4, min: 1, max: 999, step: 1 },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0.2 },
  },
  presets: {
    day: {},
    evening: { time: 'evening' },
    'other beds': { seed: 17 },
  },

  async create({ device, format, hdr, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'tulips' });
    const stem = STEMS.tulip;
    const flowers = createFlowerRenderer(device, {
      format: tail.scene.format,
      label: 'tulips',
      // A field of small heads: within two pixels.
      tolerance: 2,
      species: [
        {
          diagram: TULIP,
          stem,
          // Two broad leaves from the ground, arching out.
          leaves: {
            count: 2,
            from: 0,
            to: 0.22,
            tilt: 0.42,
            top: 0.75,
            shape: {
              ...FLAT_PETAL,
              length: 0.24,
              width: 0.26,
              widest: 0.35,
              tip: 0.7,
              cup: 0.35,
              curl: -0.55,
            },
          },
        },
      ],
    });
    flowers.setLooks(CULTIVARS.map((look) => ({ look, stem })));
    const farColours = new Float32Array(24);
    CULTIVARS.forEach((look, k) => {
      // A field seen across: a head's lit colour, a little of its leaves through it.
      const c = petalColours(look.petal).reflect;
      farColours.set([c[0] * 0.92 + 0.01, c[1] * 0.92 + 0.02, c[2] * 0.92 + 0.005, 1], k * 4);
    });

    const fieldUniforms = createUniformBuffer(device, FieldParams, 'tulips field');
    const fieldModule = createShader(
      device,
      withChunks(fieldShader, { 'field-params.wgsl': FieldParams.wgsl }),
    );
    const fieldPipeline = device.createRenderPipeline({
      label: 'tulips field',
      layout: 'auto',
      vertex: { module: fieldModule, entryPoint: 'field_vs' },
      fragment: {
        module: fieldModule,
        entryPoint: 'field_fs',
        targets: [{ format: tail.scene.format }],
      },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' },
      multisample: { count: 4 },
    });
    const fieldGroup = device.createBindGroup({
      layout: fieldPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: fieldUniforms.buffer } }],
    });

    // The bulbs in the beds near the viewer, planted on a jittered grid.
    let bulbs: Bulb[] = [];
    let plantedFor = -1;
    const plant = (seed: number) => {
      bulbs = [];
      const half = NEAR * 1.4;
      let i = 0;
      for (let z = 1.3; z < NEAR; z += SPACING) {
        for (let x = -half; x < half; x += SPACING) {
          const h = pcg1d((i++ * 2654435761 + seed) >>> 0);
          const jx = x + (toUnorm(h) - 0.5) * SPACING * 0.7;
          const jz = z + (toUnorm(pcg1d(h)) - 0.5) * SPACING * 0.7;
          const bed = bedAt(jx, seed);
          if (!bed.inside) continue;
          const r = toUnorm(pcg1d(h ^ 0x9e3779b9));
          bulbs.push({
            x: jx,
            z: jz,
            cultivar: bed.cultivar,
            scale: 0.88 + 0.24 * r,
            yaw: r * 6.283,
            phase: toUnorm(pcg1d(h + 7)) * 6.283,
            late: toUnorm(pcg1d(h + 13)),
          });
        }
      }
      plantedFor = seed;
    };
    const groups: FlowerGroup[] = BANDS.map(() => ({ species: 0, perMetre: 1, heads: [] }));

    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;

    return {
      resize(w, h) {
        width = w;
        height = h;
        tail.resize(w, h);
        colour?.destroy();
        depth?.destroy();
        const make = (label: string, f: GPUTextureFormat) =>
          device.createTexture({
            label,
            size: [w, h],
            format: f,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
          });
        colour = make('tulips colour', tail.scene.format);
        depth = make('tulips depth', 'depth24plus');
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : time.delta;
        clock += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        const seed = Math.round(params.seed);
        if (seed !== plantedFor) plant(seed);
        const aspect = width / height;
        const camera = pitchedCamera({
          aspect,
          eye: EYE,
          pitch: PITCH,
          fovY: FOV,
          near: 0.1,
          far: 400,
        });
        const sy = 1 / Math.tan(FOV / 2);
        const sx = sy / aspect;
        const focal = (sy * height) / 2;

        // Day: the field open in the warmth. Evening: the light going and the tulips closing as
        // it cools, then morning again, over a minute and a half.
        const evening = params.time === 'evening';
        const dusk = evening ? 0.5 - 0.5 * Math.cos((2 * Math.PI * clock) / 90) : 0;
        const light = 1 - 0.75 * dusk;
        const sunDir = norm([-0.45, 0.6 - 0.45 * dusk, 0.65]);
        const sun: Vec3 = [2.6 * light, (2.45 - 0.5 * dusk) * light, (2.25 - 0.9 * dusk) * light];
        const sky: Vec3 = [0.3 * light, 0.38 * light, 0.52 * light];
        const open = 0.95 - 0.6 * dusk;

        // The grass engine's wind: gusts crossing the field, each stem on its own phase.
        const wind: Wind = {
          dir: [0.6, 0.8],
          lean: dosed(dose, 0, 0.05, 0.1),
          gust: time.still ? 0 : dosed(dose, 0, 0.09, 0.18),
          speed: 3,
          scale: 5,
          flutter: dosed(dose, 0, 0.025, 0.05),
          time: clock,
        };
        const tanX = 1 / sx;
        for (const g of groups) (g.heads as FlowerHead[]).length = 0;
        for (const b of bulbs) {
          if (Math.abs(b.x) > b.z * tanX + 0.6) continue;
          const d = Math.hypot(b.x, EYE[1] - 0.4, b.z);
          const band = d < BANDS[0] ? 0 : d < BANDS[1] ? 1 : 2;
          // Shrinking into the far field's colour over the last metres.
          const scale = b.scale * (1 - smoothstep(NEAR - 2.5, NEAR, b.z));
          if (scale < 0.02) continue;
          const length = stem.length * scale;
          const [gx, gz] = groundWind(b.x, b.z, wind, 0.9, b.phase);
          const tip = Math.hypot(gx, gz) * length;
          (groups[band]!.heads as FlowerHead[]).push({
            position: [b.x, length, b.z],
            progress: Math.max(0.2, open - 0.25 * b.late),
            yaw: b.yaw,
            scale,
            sway: [gx * length, gz * length, (1.5 * tip) / length, (0.6 * tip * tip) / length],
            look: b.cultivar,
          });
        }
        groups.forEach(
          (g, k) => (g.perMetre = focal / Math.max(k === 0 ? 1.4 : BANDS[k - 1]!, 0.5)),
        );
        flowers.prepare(
          {
            viewProj: camera.viewProj,
            eye: EYE,
            time: clock,
            sun: [...sunDir, 1],
            sunColour: sun,
            skyTop: sky,
            skyBottom: [sky[0] * 0.4, sky[1] * 0.4, sky[2] * 0.3],
            ambient: 1,
            haze: [0.62 * light, 0.7 * light, 0.8 * light, 0.004],
          },
          groups,
        );
        fieldUniforms.set({
          zenith: [0.12 * light, 0.28 * light, 0.62 * light],
          sx,
          horizon: [0.62 * light, 0.7 * light, 0.8 * light],
          sy,
          soil: [0.1, 0.07, 0.045],
          pitch: PITCH,
          leaf: [0.08, 0.14, 0.045],
          near: NEAR,
          sun_dir: sunDir,
          period: PERIOD,
          sun,
          haze: 0.004,
          sky,
          seed,
          eye: EYE,
          colours: farColours,
        });
        fieldUniforms.upload();
        const pass = encoder.beginRenderPass({
          label: 'tulips',
          colorAttachments: [
            {
              view: colour!.createView(),
              resolveTarget: tail.scene.view,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'discard',
            },
          ],
          depthStencilAttachment: {
            view: depth!.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('tulips'),
        });
        pass.setPipeline(fieldPipeline);
        pass.setBindGroup(0, fieldGroup);
        pass.draw(3);
        flowers.draw(pass);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => ({ ...flowers.stats(), bulbs: bulbs.length }),
      destroy() {
        flowers.destroy();
        fieldUniforms.destroy();
        colour?.destroy();
        depth?.destroy();
        tail.destroy();
      },
    };
  },
});

function norm(v: readonly number[]): Vec3 {
  const l = Math.hypot(...v);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
}
