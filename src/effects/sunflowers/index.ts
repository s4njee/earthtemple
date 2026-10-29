import { arrange, openReach, SUNFLOWER } from '../../gpu/flower/diagram.ts';
import { LOOKS, STEMS } from '../../gpu/flower/looks.ts';
import { FLAT_PETAL } from '../../gpu/flower/petal.ts';
import { createFlowerRenderer, type FlowerHead } from '../../gpu/flower/render.ts';
import { nodToward, turnHead } from '../../gpu/flower/heliotropism.ts';
import { headTilt, StemSway } from '../../gpu/flower/stem.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { trackPointer } from '../../gpu/pointer.ts';
import { createHdrTail, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { createRandom } from '../../gpu/random.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct } from '../../gpu/uniforms.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';
import skyShader from './sky.wgsl';

// Story 12.4: rows of sunflowers whose heads follow the pointer as young sunflowers follow the sun.
// Atamian et al. (Science, 2016) found that a young sunflower's stem grows faster on its east side
// by day, turning the head west after the sun, and on its west side by night, turning it back to
// face the dawn. Turning by growth is slow: each head eases towards the pointer with a lag of its
// own, at a rate a stem can grow, and drifts back east when the pointer leaves. The pointer is the
// sun, so a head that has turned to it is lit full on. Each head is the shared flower renderer's
// sunflower (src/gpu/flower/diagram.ts): 610 disc florets in Vogel's spiral, 34 rays, leafy bracts,
// on a stem with leaves up it.

type Vec3 = [number, number, number];

const SkyParams = defineUniformStruct('SkyParams', {
  zenith: 'vec3f',
  sx: 'f32',
  horizon: 'vec3f',
  sy: 'f32',
  field: 'vec3f',
  pitch: 'f32',
  sun_dir: 'vec3f',
  pad: 'f32',
  sun: 'vec3f',
});

const EYE: Vec3 = [0, 1.45, 0];
const PITCH = -0.1;
const FOV = (42 * Math.PI) / 180;
/** Facing the dawn: east, a little towards the viewer. */
const EAST = norm([-0.75, 0.15, -0.65]);
/** The fastest a stem can turn its head by growing, rad/s, sped up for the page. */
const TURN = 0.9;

function norm(v: readonly number[]): Vec3 {
  const l = Math.hypot(...v);
  return [v[0]! / l, v[1]! / l, v[2]! / l];
}

interface Plant {
  /** Where the stem stands. */
  root: Vec3;
  /** Its height scale and its lag, s. */
  scale: number;
  lag: number;
  yaw: number;
  /** Where its head faces now. */
  facing: Vec3;
  sway: StemSway;
}

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    rows: { type: 'number', default: 3, min: 1, max: 3, step: 1 },
    follow: { type: 'boolean', default: true, label: 'follow the pointer' },
    lag: { type: 'number', default: 1.2, min: 0.2, max: 4, step: 0.1, label: 'lag, s' },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0.2 },
  },
  presets: {
    field: {},
    'one row': { rows: 1 },
    'slow growth': { lag: 3.5 },
    'facing east': { follow: false },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'sunflowers' });
    const stem = STEMS.sunflower;
    const flowers = createFlowerRenderer(device, {
      format: tail.scene.format,
      label: 'sunflowers',
      species: [
        {
          diagram: SUNFLOWER,
          stem,
          // Broad heart-shaped leaves on long stalks, drooping, smaller up the stem.
          leaves: {
            count: 11,
            from: 0.12,
            to: 0.9,
            tilt: 1.05,
            top: 0.5,
            shape: {
              ...FLAT_PETAL,
              length: 0.36,
              width: 0.78,
              widest: 0.32,
              tip: 0.7,
              claw: 0.3,
              cup: 0.12,
              curl: -0.7,
              excess: 0.03,
              fringe: 0.25,
            },
          },
        },
      ],
    });
    flowers.setLooks([{ look: LOOKS.sunflower, stem }]);
    const reach = openReach(arrange(SUNFLOWER));

    // Three rows, staggered, each further back a little taller and more of them.
    const random = createRandom(7);
    const plants: Plant[] = [];
    const rows = [
      { z: 2.6, count: 7, spacing: 0.72 },
      { z: 4.7, count: 9, spacing: 0.7 },
      { z: 6.4, count: 12, spacing: 0.68 },
    ];
    rows.forEach((row, r) => {
      for (let k = 0; k < row.count; k++) {
        const x = (k - (row.count - 1) / 2) * row.spacing + (random() - 0.5) * 0.25 + r * 0.3;
        const scale = 0.92 + 0.18 * random() + 0.06 * r;
        plants.push({
          root: [x, 0, row.z + (random() - 0.5) * 0.3],
          scale,
          lag: 0.7 + 0.8 * random(),
          yaw: random() * 6.283,
          facing: EAST,
          sway: new StemSway({
            ...stem,
            length: stem.length * scale,
            modulus: 1.5e9,
            density: 1000,
            headArea: Math.PI * reach * reach,
          }),
        });
      }
    });

    const skyUniforms = createUniformBuffer(device, SkyParams, 'sunflowers sky');
    const skyModule = createShader(
      device,
      withChunks(skyShader, { 'sky-params.wgsl': SkyParams.wgsl }),
    );
    const skyPipeline = device.createRenderPipeline({
      label: 'sunflowers sky',
      layout: 'auto',
      vertex: { module: skyModule, entryPoint: 'sky_vs' },
      fragment: {
        module: skyModule,
        entryPoint: 'sky_fs',
        targets: [{ format: tail.scene.format }],
      },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'always' },
      multisample: { count: 4 },
    });
    const skyGroup = device.createBindGroup({
      layout: skyPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: skyUniforms.buffer } }],
    });
    const pointer = trackPointer(canvas);
    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;
    let sunDir: Vec3 = norm([-0.3, 0.55, -0.8]);

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
        colour = make('sunflowers colour', tail.scene.format);
        depth = make('sunflowers depth', 'depth24plus');
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : time.delta;
        clock += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        const aspect = width / height;
        const camera = pitchedCamera({
          aspect,
          eye: EYE,
          pitch: PITCH,
          fovY: FOV,
          near: 0.1,
          far: 60,
        });
        const sy = 1 / Math.tan(FOV / 2);
        const sx = sy / aspect;

        // The sun is where the pointer is, out in front of the rows; with no pointer, the morning
        // sun in the east.
        const p = pointer.state;
        const day = params.follow && p.inside && !time.still;
        let sunPoint: Vec3 | undefined;
        if (day) {
          const nx = 2 * p.x - 1;
          const ny = 1 - 2 * p.y;
          const f: Vec3 = [0, -Math.sin(PITCH), Math.cos(PITCH)];
          const u: Vec3 = [0, Math.cos(PITCH), Math.sin(PITCH)];
          const ray = norm([nx / sx, f[1] + (u[1] * ny) / sy, f[2] + (u[2] * ny) / sy]);
          sunPoint = [EYE[0] + ray[0] * 1.6, EYE[1] + ray[1] * 1.6, EYE[2] + ray[2] * 1.6];
          // The light comes from it, seen from the middle of the rows, raised: a sun, not a lamp.
          sunDir = norm([sunPoint[0], sunPoint[1] - 1.3, sunPoint[2] - 4.5]);
        }

        const gust = 1 + 0.5 * Math.sin(0.5 * clock) + 0.3 * Math.sin(1.3 * clock + 2);
        const wind = dosed(dose, 0, 0.9, 1.6) * Math.max(gust, 0);
        const heads: FlowerHead[] = [];
        const shown = plants.slice(0, [7, 16, 28][Math.max(0, Math.min(2, params.rows - 1))]);
        for (const plant of shown) {
          if (dt > 0) plant.sway.step(dt, wind * 0.9, wind * 0.3);
          const length = plant.sway.stem.length;
          const head: Vec3 = [plant.root[0], length, plant.root[2]];
          // Where it would face: the sun, or the east.
          const want = sunPoint
            ? norm([sunPoint[0] - head[0], sunPoint[1] - head[1], sunPoint[2] - head[2]])
            : EAST;
          // Mature heads nod: never far above level.
          const aim = norm([want[0], Math.min(Math.max(want[1], -0.35), 0.45), want[2]]);
          // Growth turns it: towards the aim with its own lag, no faster than a stem can grow.
          plant.facing = turnHead(
            plant.facing,
            aim,
            dt,
            plant.lag * params.lag,
            TURN * dosed(dose, 0.3, 1, 1.4),
          );
          const tip = Math.hypot(plant.sway.x, plant.sway.z);
          heads.push({
            position: head,
            progress: 1,
            yaw: plant.yaw,
            scale: plant.scale,
            sway: [
              plant.sway.x,
              plant.sway.z,
              headTilt(plant.sway.stem, tip),
              (0.6 * tip * tip) / length,
            ],
            nod: nodToward(plant.facing),
          });
        }

        flowers.prepare(
          {
            viewProj: camera.viewProj,
            eye: EYE,
            time: clock,
            sun: [...sunDir, 2.6],
            sunColour: [1, 0.95, 0.86],
            skyTop: [0.35, 0.45, 0.62],
            skyBottom: [0.14, 0.14, 0.08],
            ambient: 1,
            haze: [0.62, 0.72, 0.84, 0.012],
            flutter: time.still ? 0 : dosed(dose, 0, 0.01, 0.025),
          },
          [{ species: 0, perMetre: (Math.min(width, height) * sy) / 2 / 2.6, heads }],
        );
        skyUniforms.set({
          zenith: [0.1, 0.26, 0.62],
          sx,
          horizon: [0.62, 0.72, 0.84],
          sy,
          field: [0.16, 0.2, 0.06],
          pitch: PITCH,
          sun_dir: sunDir,
          sun: [1, 0.9, 0.7],
        });
        skyUniforms.upload();
        const pass = encoder.beginRenderPass({
          label: 'sunflowers',
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
          timestampWrites: profiler.pass('flowers'),
        });
        pass.setPipeline(skyPipeline);
        pass.setBindGroup(0, skyGroup);
        pass.draw(3);
        flowers.draw(pass);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => flowers.stats(),
      destroy() {
        pointer.destroy();
        flowers.destroy();
        skyUniforms.destroy();
        colour?.destroy();
        depth?.destroy();
        tail.destroy();
      },
    };
  },
});
