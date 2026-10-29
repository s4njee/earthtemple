import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'sunflowers',
  title: 'Sunflowers',
  epic: '12',
  tier: 'B',
  tags: ['flowers', 'phyllotaxis', 'pointer', 'hero'],
  summary:
    'Rows of sunflowers against a summer sky whose heads turn to follow the pointer as young sunflowers follow the sun, each a little behind the last, and drift back east when it leaves. Each head is 610 florets in Vogel’s golden-angle spiral, ringed by 34 rays.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: the rows facing the viewer.',
    useCases: [
      'A summer or harvest hero',
      'A seed company or farm shop',
      'An interactive landing page',
    ],
  },
};
