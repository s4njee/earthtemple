import type { EffectContext, FrameTime } from '../../effects/types.ts';
import { createHdrTail, type TailValues } from '../post/index.ts';
import { dosed, heldDose } from '../safety/dose.ts';
import { trackPointer } from '../pointer.ts';
import { createTrample, type Brush, type Trample } from '../wind/trample.ts';
import { SPECIES, type Species } from './blade.ts';
import { pitchedCamera, pitchedRay, type GroundCamera } from './camera.ts';
import { ALL_PARTS, createGrassField, type GrassSettings, type Lighting } from './field.ts';
import { createGrassStrip } from './strip.ts';

// Stories 3.3, 3.4 and 3.7: a lawn seen from standing height, looking down, shared by `lawn`,
// `mowing` and `grass-growth`. The blade engine under a pitched camera, the trample field for
// what is pressed or mown, and the light. The view looks down far enough that no sky shows: the
// ground and its canopy fill the canvas.

export const LAWN_LIGHTS = {
  afternoon: {
    sunDir: [0.42, 0.62, -0.66],
    sun: [2.9, 2.75, 2.5],
    sky: [0.3, 0.38, 0.52],
    horizon: [0.62, 0.72, 0.86],
    transmit: 0.8,
    sheen: 0.9,
    cloudDepth: 0.35,
    cloudScale: 120,
    cloudSpeed: 3,
    fog: 0,
    soil: [0.08, 0.055, 0.03],
    groundMode: 1,
  },
  evening: {
    // Low and from the side: pressed and laid grass shows most.
    sunDir: [0.9, 0.22, 0.38],
    sun: [3.2, 2.2, 1.2],
    sky: [0.16, 0.17, 0.24],
    horizon: [0.8, 0.6, 0.45],
    transmit: 1,
    sheen: 1,
    cloudDepth: 0,
    fog: 0,
    soil: [0.08, 0.055, 0.03],
    groundMode: 1,
  },
  overcast: {
    sunDir: [0.1, 0.98, -0.15],
    sun: [0.5, 0.5, 0.52],
    sky: [0.62, 0.65, 0.68],
    horizon: [0.7, 0.72, 0.74],
    transmit: 0.4,
    sheen: 0.3,
    cloudDepth: 0,
    fog: 0,
    soil: [0.08, 0.055, 0.03],
    groundMode: 1,
  },
} as const satisfies Record<string, Lighting>;
export type LawnLight = keyof typeof LAWN_LIGHTS;

/** Standing at the lawn's edge, looking down. */
const EYE: readonly [number, number, number] = [0, 1.7, 0];
const PITCH = (42 * Math.PI) / 180;
const FOV = (44 * Math.PI) / 180;
const CAPACITY = 200_000;

export interface LawnFrame {
  species?: Species;
  density: number;
  light: string;
  dose: number;
  brushes: readonly Brush[];
  growth?: GrassSettings['growth'];
  flags?: number;
  seed: number;
  /** Shells beyond the blades' full detail (story 2.8), judged here seen from above. */
  shells?: boolean;
  /** What shows between and under the blades. Default turf's thatch. */
  soil?: readonly [number, number, number];
}

export interface LawnScene {
  /** The lawn's point under the pointer (at half the grass's height), or undefined. */
  readonly pointer: { readonly x: number; readonly z: number; readonly down: boolean } | undefined;
  readonly trample: Trample;
  readonly camera: GroundCamera;
  resize(width: number, height: number): void;
  frame(time: FrameTime, encoder: GPUCommandEncoder, target: GPUTextureView, f: LawnFrame): void;
  stats(): Record<string, number>;
  destroy(): void;
}

export function createLawnScene(
  ctx: Pick<EffectContext, 'device' | 'format' | 'hdr' | 'canvas' | 'profiler'> & {
    params: TailValues;
  },
  options: { regrow?: number; label: string },
): LawnScene {
  const { device, profiler } = ctx;
  const tail = createHdrTail(device, { format: ctx.format, hdr: ctx.hdr, label: options.label });
  const field = createGrassField(device, {
    capacity: CAPACITY,
    format: tail.scene.format,
    sampleCount: 4,
    label: options.label,
  });
  const strip = createGrassStrip(device, {
    format: tail.scene.format,
    samples: 4,
    label: `${options.label} strip`,
  });
  // 10 m of lawn at 4 cm, around the middle of the view.
  const trample = createTrample(device, {
    size: 256,
    cell: 0.04,
    tau: 2.5,
    regrow: options.regrow ?? 0,
  });
  const pointer = trackPointer(ctx.canvas);
  let width = 1;
  let height = 1;
  let clock = 0;
  let camera = pitchedCamera({ aspect: 1, eye: EYE, pitch: PITCH, fovY: FOV, far: 60 });
  let under: { x: number; z: number; down: boolean } | undefined;

  return {
    get pointer() {
      return under;
    },
    trample,
    get camera() {
      return camera;
    },
    resize(w, h) {
      width = w;
      height = h;
      tail.resize(w, h);
      strip.resize(w, h);
      camera = pitchedCamera({ aspect: w / h, eye: EYE, pitch: PITCH, fovY: FOV, far: 60 });
    },
    frame(time, encoder, target, f) {
      clock += time.delta;
      const dose = time.still ? heldDose(f.dose) : f.dose;
      const species = f.species ?? SPECIES.lawn;
      const canopy = (species.height[0] + species.height[1]) / 2;
      const p = pointer.state;
      under = undefined;
      if (p.inside) {
        const ray = pitchedRay(PITCH, camera.scale, [2 * p.x - 1, 1 - 2 * p.y]);
        const t = (0.5 * canopy - EYE[1]) / ray[1];
        if (ray[1] < 0 && t > 0) {
          under = { x: EYE[0] + ray[0] * t, z: EYE[2] + ray[2] * t, down: p.down };
        }
      }
      trample.step(encoder, time.delta, 0, 3.2, f.brushes);
      field.update(
        camera,
        {
          species,
          density: f.density,
          heightScale: 1,
          clump: 0.08,
          lod0: 2.6,
          lod1: 4.2,
          fade: 2.2,
          reach: 8,
          wind: {
            dir: [0.7, 0.71],
            lean: dosed(dose, 0, 0.06, 0.12),
            gust: time.still ? 0 : dosed(dose, 0, 0.12, 0.2),
            speed: dosed(dose, 1, 2, 2.6),
            scale: 2,
            flutter: dosed(dose, 0, 0.04, 0.05),
          },
          pointer: [0, -2, 0.1, 0],
          trample,
          seed: f.seed,
          minPixels: 0.04,
          flags: f.flags ?? ALL_PARTS,
          flowers: 0,
          growth: f.growth,
          shells: f.shells,
        },
        clock,
        { width, height },
      );
      // Under turf is thatch, dead and living stems, not bare soil.
      field.light({
        ...(LAWN_LIGHTS[f.light as LawnLight] ?? LAWN_LIGHTS.afternoon),
        soil: f.soil ?? [0.035, 0.05, 0.015],
      });
      field.compute(encoder, profiler.pass('place'));
      const pass = encoder.beginRenderPass({
        label: `${options.label} grass`,
        colorAttachments: [
          {
            view: strip.colour,
            resolveTarget: strip.resolveTarget,
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'discard',
          },
          null,
        ],
        depthStencilAttachment: {
          view: strip.depth,
          depthLoadOp: 'clear',
          depthClearValue: 1,
          depthStoreOp: 'discard',
        },
        timestampWrites: profiler.pass('grass'),
      });
      field.draw(pass);
      pass.end();
      strip.composite(encoder, tail.scene.view, height);
      tail.encode(encoder, target, time, ctx.params, profiler);
    },
    stats() {
      const [near, mid, far] = field.counts();
      return { near, mid, far, cells: field.cells };
    },
    destroy() {
      pointer.destroy();
      field.destroy();
      strip.destroy();
      trample.destroy();
      tail.destroy();
    },
  };
}
