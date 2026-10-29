import { createLawnScene, LAWN_LIGHTS } from '../../gpu/grass/lawn-scene.ts';
import { TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS } from '../../gpu/safety/dose.ts';
import { trackScroll } from '../../gpu/scroll.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';

// Story 3.7: a lawn growing in, on the lawn scene (lawn-scene.ts) with the grass field's growth
// reveal. Seeded patches 1.6 m apart start at their own moments and spread at a steady speed; a
// blade grows to its full height over a short while once the front has passed it, so the lawn
// fills in from patches that meet, as sown grass comes up. Driven by the page's scroll (all grown
// as the canvas leaves the top of the viewport) or by a slow clock that grows, holds and shrinks.

const GROWTH = { cell: 1.6, speed: 0.4, spread: 3 };
/**
 * Progress at which everything in view has grown: the latest start, plus the farthest any ground
 * lies from its nearest patch (about 0.75 of a cell), plus a blade's ripening.
 */
const FULL = GROWTH.spread + (GROWTH.cell * 0.75) / GROWTH.speed + 0.85;
const GROW = 14;
const HOLD = 5;
const SHRINK = 9;
const REST = 2;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    follow: { type: 'select', default: 'time', options: ['time', 'scroll'] },
    light: { type: 'select', default: 'afternoon', options: Object.keys(LAWN_LIGHTS) },
    density: { type: 'number', default: 0.8, min: 0.1, max: 1, step: 0.01 },
    seed: { type: 'number', default: 5, min: 1, max: 999, step: 1 },
    ...TAIL_PARAMS,
    exposure: { ...TAIL_PARAMS.exposure, default: 1.35 },
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
  },
  presets: {
    'over time': {},
    'on scroll': { follow: 'scroll' },
    evening: { light: 'evening' },
  },

  async create(ctx) {
    const { params } = ctx;
    const scene = createLawnScene(ctx, { label: 'grass-growth' });
    const scroll = trackScroll(ctx.canvas);
    // The first frame shows patches coming up, so a gallery card or a poster is a lawn growing.
    let clock = GROW * 0.3;
    let progress = 0;

    return {
      resize: (w, h) => scene.resize(w, h),
      frame(time, encoder, target) {
        clock += time.delta;
        if (params.follow === 'scroll') {
          progress = scroll.update(time.delta).progress * FULL;
        } else {
          const t = clock % (GROW + HOLD + SHRINK + REST);
          const f =
            t < GROW
              ? t / GROW
              : t < GROW + HOLD
                ? 1
                : t < GROW + HOLD + SHRINK
                  ? 1 - (t - GROW - HOLD) / SHRINK
                  : 0;
          progress = f * FULL;
        }
        scene.frame(time, encoder, target, {
          density: params.density,
          light: params.light,
          dose: params.dose,
          brushes: [],
          seed: params.seed,
          growth: { progress, ...GROWTH },
          // Bare, sown soil, not a turf's thatch.
          soil: [0.055, 0.04, 0.026],
        });
      },
      stats: () => ({ ...scene.stats(), grown: Math.round((100 * progress) / FULL) }),
      destroy: () => {
        scroll.destroy();
        scene.destroy();
      },
    };
  },
});
