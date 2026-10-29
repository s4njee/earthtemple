import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'dewy-petals',
  title: 'Dewy petals',
  epic: '12',
  tier: 'C',
  tags: ['flowers', 'water', 'depth of field', 'macro', 'hero'],
  summary:
    "A macro close-up of a rose's petals beaded with dew, turning slowly under a shallow depth of field: each drop a lens showing a flipped view of the petals round it, with a dark rim, a glint and a crescent of gathered light. The look of a perfume or skincare brand.",
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    // The petals' overlapping edges in the turning view read as a weak rosette: 0.24 of 0.4.
    pattern: 'low',
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: the petals and their dew.',
    useCases: ['A perfume or skincare hero', 'A florist', 'A wedding or spa page'],
  },
};
