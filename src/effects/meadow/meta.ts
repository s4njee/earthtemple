import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'meadow',
  title: 'Meadow',
  epic: '3',
  tier: 'C',
  tags: ['grass', 'wind', 'compute', 'indirect draws', 'depth of field', 'hero'],
  summary:
    'A meadow at eye level running to the horizon: tall grass with seed heads and wildflowers, coloured from leaf pigments and lit through the blades when the sun is behind them; gusts and cloud shadows crossing it, pollen in the light, the nearest blades out of focus. The pointer brushes a path that springs back.',
  scorecard: {
    compute: true,
    mobile: 'untested',
    flash: 'low',
    pattern: 'none',
    // Walking through the grass is a zoom over the cap, held from the camera's own motion
    // (tests/meadow.test.ts): the motion check cannot follow grass.
    motionPresets: ['walk through'],
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: a still of the meadow, or a photograph.',
    useCases: ['An outdoor or travel brand hero', 'A landing page for spring or summer'],
  },
};
