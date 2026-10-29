import { ALL_PARTS, FLAGS, without, type Part } from '../../gpu/grass/field.ts';
import { createLawnScene, LAWN_LIGHTS } from '../../gpu/grass/lawn-scene.ts';
import { TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed } from '../../gpu/safety/dose.ts';
import type { Brush } from '../../gpu/wind/trample.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';

// Story 3.4: mowing, on the lawn scene (lawn-scene.ts). A mower is a brush that cuts the grass and
// lays it along its travel (the trample field's lay, which stays). The stripes are not painted:
// stubble laid away from the viewer shows its upper side to the sky and the sun, stubble laid
// towards the viewer its shaded side, so rows mown in opposite directions read light and dark, and
// would swap if the view turned round, as real lawn stripes do.
//
// The mower runs up and down rows across the lawn, along the view, by a progress value: from a
// clock that loops, or held at the `progress` parameter, as a progress bar. Dragging mows too.
// Stripes are a grating, so how hard the stubble is laid (and so the stripes' contrast) follows
// the intensity, and the bold stripes are gated.

/** The lawn the mower covers, m: across the view, and its near and far ends. */
const X0 = -2.6;
const X1 = 2.6;
const Z0 = 1.2;
const Z1 = 6.2;
/** A row's width, the mower's cutting width. */
const ROW = 0.52;
const ROWS = Math.ceil((X1 - X0) / ROW);
/** The mower's path length: rows along z, joined at the ends. */
const LENGTH = ROWS * (Z1 - Z0);

/** Where the mower is after `s` metres of path, and which way it is going. */
function mowerAt(s: number): { x: number; z: number; along: [number, number] } {
  const row = Math.min(ROWS - 1, Math.floor(s / (Z1 - Z0)));
  const into = s - row * (Z1 - Z0);
  const away = row % 2 === 0;
  return {
    x: X0 + (row + 0.5) * ROW,
    z: away ? Z0 + into : Z1 - into,
    along: [0, away ? 1 : -1],
  };
}

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    progress: {
      type: 'number',
      default: -1,
      min: -1,
      max: 1,
      step: 0.01,
      label: 'progress (-1 loops)',
    },
    seconds: { type: 'number', default: 40, min: 8, max: 120, step: 1, label: 'a lawn takes, s' },
    light: { type: 'select', default: 'afternoon', options: Object.keys(LAWN_LIGHTS) },
    density: { type: 'number', default: 0.8, min: 0.1, max: 1, step: 0.01 },
    ablate: {
      type: 'select',
      default: 'none',
      options: ['none', ...Object.keys(FLAGS)],
      label: 'without',
    },
    seed: { type: 'number', default: 4, min: 1, max: 999, step: 1 },
    ...TAIL_PARAMS,
    exposure: { ...TAIL_PARAMS.exposure, default: 1.35 },
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
  },
  presets: {
    afternoon: {},
    evening: { light: 'evening' },
    'half mown': { progress: 0.5 },
    'bold stripes': { dose: 0.9, progress: 0.75 },
  },

  async create(ctx) {
    const { params } = ctx;
    const scene = createLawnScene(ctx, { label: 'mowing' });
    let mown = 0;
    let clock = 0;
    let last: { x: number; z: number } | undefined;

    return {
      resize: (w, h) => scene.resize(w, h),
      frame(time, encoder, target) {
        clock += time.delta;
        // How hard the stubble is laid: the stripes' contrast follows it.
        const laid = dosed(params.dose, 0, 0.55, 1);
        const looped = (clock / params.seconds) % 1.15;
        const progress = params.progress >= 0 ? params.progress : Math.min(looped, 1);
        const goal = progress * LENGTH;
        // Mowing backwards (the loop starting again, or the progress set lower) starts a fresh
        // lawn: the cut is cleared and mown again up to the goal.
        if (goal < mown - 1e-6) {
          scene.trample.clear();
          mown = 0;
        }
        // The path not yet mown, one pass a row: a mower brush covers its pass from `length` back,
        // so even a held frame, or a jump to the end, is mown in one step.
        const brushes: Brush[] = [];
        const row = Z1 - Z0;
        while (mown < goal - 1e-6) {
          const end = Math.min(goal, (Math.floor(mown / row + 1e-9) + 1) * row);
          const m = mowerAt(Math.max(mown, end - 1e-6));
          brushes.push({
            x: m.x,
            z: m.z,
            radius: ROW * 0.6,
            strength: laid,
            along: m.along,
            mow: true,
            length: end - mown,
          });
          mown = end;
        }
        const under = scene.pointer;
        if (under && under.down && !time.still) {
          if (last) {
            const dx = under.x - last.x;
            const dz = under.z - last.z;
            const moved = Math.hypot(dx, dz);
            if (moved > 0.005) {
              brushes.push({
                x: under.x,
                z: under.z,
                radius: ROW * 0.6,
                strength: laid,
                along: [dx / moved, dz / moved],
                mow: true,
              });
            }
          }
          last = under;
        } else {
          last = undefined;
        }
        const ablate = params.ablate as string;
        const flags = ablate in FLAGS ? without(ablate as Part) : ALL_PARTS;
        scene.frame(time, encoder, target, {
          density: params.density,
          light: params.light,
          dose: params.dose,
          brushes,
          flags,
          seed: params.seed,
        });
      },
      stats: () => ({ ...scene.stats(), mown: Math.round((100 * mown) / LENGTH) }),
      destroy: () => scene.destroy(),
    };
  },
});
