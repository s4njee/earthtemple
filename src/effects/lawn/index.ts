import { createLawnScene, LAWN_LIGHTS } from '../../gpu/grass/lawn-scene.ts';
import { FLAGS, without, ALL_PARTS, type Part } from '../../gpu/grass/field.ts';
import { TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS } from '../../gpu/safety/dose.ts';
import type { Brush } from '../../gpu/wind/trample.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';

// Story 3.3: a lawn the pointer brushes and treads (lawn-scene.ts, the trample field of story
// 2.5). Moving, the pointer brushes the grass along its path; pressed, it treads a print. Left
// alone, a slow trail winds across by itself, so the lawn is never only still.

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    density: { type: 'number', default: 0.8, min: 0.1, max: 1, step: 0.01 },
    light: { type: 'select', default: 'afternoon', options: Object.keys(LAWN_LIGHTS) },
    trail: { type: 'number', default: 1, min: 0, max: 1.6, step: 0.05, label: 'trail depth' },
    ablate: {
      type: 'select',
      default: 'none',
      options: ['none', ...Object.keys(FLAGS)],
      label: 'without',
    },
    far: { type: 'select', default: 'canopy', options: ['canopy', 'shells'], label: 'far grass' },
    seed: { type: 'number', default: 2, min: 1, max: 999, step: 1 },
    ...TAIL_PARAMS,
    // A sunlit lawn fills the frame with lit tips; the tail's default exposure leaves it dull.
    exposure: { ...TAIL_PARAMS.exposure, default: 1.35 },
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
  },
  presets: {
    afternoon: {},
    evening: { light: 'evening' },
    overcast: { light: 'overcast' },
    'deep trail': { trail: 1.5, light: 'evening' },
  },

  async create(ctx) {
    const { params } = ctx;
    const scene = createLawnScene(ctx, { label: 'lawn' });
    let last: { x: number; z: number } | undefined;
    let clock = 0;

    return {
      resize: (w, h) => scene.resize(w, h),
      frame(time, encoder, target) {
        clock += time.delta;
        const brushes: Brush[] = [];
        const under = scene.pointer;
        const strength = params.trail;
        if (under && !time.still) {
          if (under.down) {
            // A tread: pressed flat around the foot.
            brushes.push({ x: under.x, z: under.z, radius: 0.16, strength: 1.4 * strength });
          }
          if (last) {
            const dx = under.x - last.x;
            const dz = under.z - last.z;
            const moved = Math.hypot(dx, dz);
            if (moved > 0.002) {
              brushes.push({
                x: under.x,
                z: under.z,
                radius: 0.2,
                strength,
                along: [dx / moved, dz / moved],
              });
            }
          }
          last = under;
        } else if (!time.still) {
          last = undefined;
          // Nobody here: a slow trail winds across the lawn by itself.
          const t = clock * 0.18;
          const x = 1.6 * Math.sin(t);
          const z = 3.2 + 1.1 * Math.sin(2 * t + 0.7);
          const dx = 1.6 * Math.cos(t);
          const dz = 2.2 * Math.cos(2 * t + 0.7);
          const l = Math.hypot(dx, dz) || 1;
          brushes.push({ x, z, radius: 0.2, strength: 0.9 * strength, along: [dx / l, dz / l] });
        }
        const ablate = params.ablate as string;
        scene.frame(time, encoder, target, {
          density: params.density,
          light: params.light,
          dose: params.dose,
          brushes,
          flags: ablate in FLAGS ? without(ablate as Part) : ALL_PARTS,
          seed: params.seed,
          shells: params.far === 'shells',
        });
      },
      stats: () => scene.stats(),
      destroy: () => scene.destroy(),
    };
  },
});
