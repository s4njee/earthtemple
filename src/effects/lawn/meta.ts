import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'lawn',
  title: 'Lawn',
  epic: '3',
  tier: 'B',
  tags: ['grass', 'trample', 'compute', 'indirect draws', 'pointer'],
  summary:
    'A lawn seen from standing height. The pointer brushes a trail through it and a press treads it down; the grass rises back over a few seconds, without bouncing, to exactly upright. A cursor trail with a memory.',
  scorecard: {
    compute: true,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: a still of the lawn.',
    useCases: ['A garden, landscaping or outdoor-brand section', 'A playful cursor trail'],
  },
};
