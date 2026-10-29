import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'flower-opening',
  title: 'A flower opening',
  epic: '12',
  tier: 'A',
  tags: ['flowers', 'petals', 'scroll', 'phyllotaxis'],
  summary:
    'One flower opening from the bud on its swaying stem, over time or as the page scrolls: a lily, buttercup, cherry blossom, poppy, rose, camellia, hibiscus, morning glory or daffodil, built from its floral diagram, its petals grown surfaces coloured by their pigments that open as their inner faces outgrow their outer ones.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'low',
    pattern: 'none',
    // Fully open, a lily's three lower tepals hang as bright bars on a dark ground: a grating.
    patternPresets: ['lily'],
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'The poster: the flower half open.',
    useCases: ['A hero centrepiece', 'A section divider', 'A florist or spring page'],
  },
};
