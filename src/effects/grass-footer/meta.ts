import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'grass-footer',
  title: 'Grass footer',
  epic: '3',
  tier: 'B',
  tags: ['grass', 'wind', 'compute', 'indirect draws', 'pointer'],
  summary:
    'A strip of grass along the bottom of the page, seen from just above the ground: blades placed, clumped, bent by gusts and culled in compute each frame, then drawn with indirect draws. The pointer parts it.',
  scorecard: {
    compute: true,
    mobile: 'untested',
    flash: 'low',
    pattern: 'low',
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'A row of SVG blades swaying with CSS transforms, or the poster.',
    useCases: [
      'A footer or section edge',
      'A spring or outdoor landing page',
      'An environmental brand',
    ],
  },
};
