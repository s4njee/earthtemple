import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'night-bloom',
  title: 'Night bloom',
  epic: '12',
  tier: 'A',
  tags: ['flowers', 'night', 'scroll', 'hero'],
  summary:
    'A moonflower unfurling at dusk, fast enough to watch: its twisted bud untwists and the long tube flares into a broad white limb folded by five greener bands, pale in the moonlight, seen as dark-adapted eyes see it.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: the moonflower open in the dark.',
    useCases: ['A dark hero', 'An evening or night-time event page', 'A fragrance or candle brand'],
  },
};
