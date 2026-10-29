import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'wildflower-meadow',
  title: 'Wildflower meadow',
  epic: '12',
  tier: 'C',
  tags: ['grass', 'flowers', 'wind', 'compute', 'indirect draws', 'depth of field', 'hero'],
  summary:
    'The meadow in flower: ox-eye daisies, buttercups, poppies and cornflowers in drifts through the grass, each drift its own species. The nearest heads are whole flowers from their floral diagrams, swaying and brushed aside on the stems the grass grew; further off they are points of colour, and the drifts tint the far field.',
  scorecard: {
    compute: true,
    mobile: 'untested',
    flash: 'low',
    pattern: 'none',
    motionPresets: ['walk through'],
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: a still of the meadow in flower, or a photograph.',
    useCases: ['A spring or summer hero', 'A garden centre or seed company', 'An outdoor brand'],
  },
};
