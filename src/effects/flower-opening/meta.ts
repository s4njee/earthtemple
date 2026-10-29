import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'flower-opening',
  title: 'A flower opening',
  epic: '12',
  tier: 'A',
  tags: ['flowers', 'petals', 'scroll', 'phyllotaxis'],
  summary:
    'One flower opening from the bud, over time or as the page scrolls: a lily, buttercup, cherry blossom, poppy, rose or camellia, built from its floral diagram, its petals grown surfaces that ruffle where their edges grew more.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'low',
    pattern: 'low',
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'The poster: the flower half open.',
    useCases: ['A hero centrepiece', 'A section divider', 'A florist or spring page'],
  },
};
