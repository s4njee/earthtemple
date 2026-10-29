import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'hello',
  title: 'Hello',
  epic: '1',
  tier: 'A',
  tags: ['scaffold', 'grass'],
  summary:
    'The smallest effect: a strip of flat 2D blades along the bottom of the view, swaying in a wave of wind, one instanced draw through the HDR tail, over the page. Every later effect starts from this shape.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'A row of SVG blades, or the poster.',
    useCases: ['The template for new effects'],
  },
};
