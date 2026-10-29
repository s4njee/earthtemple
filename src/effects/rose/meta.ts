import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'rose',
  title: 'A rose',
  epic: '12',
  tier: 'A',
  tags: ['flowers', 'petals', 'scroll', 'phyllotaxis', 'hero'],
  summary:
    'A rose opening from a tight bud, close up and slow: forty petals in a golden-angle spiral, nested shell inside shell in the bud and bowl inside bowl as they open, so none passes through another, their margins rolling back as they spread. Red, pink, white, yellow or peach, from their pigments.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'The poster: the rose half open.',
    useCases: [
      'A florist or wedding hero',
      "A Valentine's or anniversary page",
      'A perfume launch',
    ],
  },
};
