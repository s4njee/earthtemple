import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'grass-edges',
  title: 'Grass on the page',
  epic: '3',
  tier: 'A',
  tags: ['grass', 'page', 'scroll', 'pointer'],
  summary:
    'Grass growing along the top edges of the page’s own headings, cards and buttons, and along the bottom of the view: it sprouts unevenly and fills in over time or as the page scrolls, sways in a wave of wind, and parts around the pointer.',
  layout: 'hero',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'A CSS strip of grass along each element’s top edge, or nothing.',
    useCases: ['A spring or seasonal landing page', 'A garden centre or sustainability site'],
  },
};
