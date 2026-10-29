import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'tulips',
  title: 'Tulip fields',
  epic: '12',
  tier: 'C',
  tags: ['flowers', 'wind', 'hero'],
  summary:
    'A Dutch bulb field running to the horizon in beds of one colour each, red, yellow, pink, purple, white and orange from their pigments. The near tulips are whole cups swaying in gusts; the far field is their colour. In the evening they close as the light goes.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: the striped field in sun.',
    useCases: ['A spring hero', 'A travel page for the Netherlands', 'A bulb or garden retailer'],
  },
};
