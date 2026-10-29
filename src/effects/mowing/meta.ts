import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'mowing',
  title: 'Mowing',
  epic: '3',
  tier: 'B',
  tags: ['grass', 'stripes', 'compute', 'progress', 'pointer'],
  summary:
    'A lawn being mown in stripes. The mower cuts the grass and lays it the way it travels; the stripes appear because grass laid away from you shows its lit upper side and grass laid towards you its shaded one. Drag to mow; left alone, it mows by a progress value, as a progress bar.',
  scorecard: {
    compute: true,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: a half-mown lawn.',
    useCases: ['A playful progress bar or loader', 'A garden or landscaping page'],
  },
};
