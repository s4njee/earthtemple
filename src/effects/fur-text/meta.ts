import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'fur-text',
  title: 'Fur text',
  epic: '3',
  tier: 'B',
  tags: ['fur', 'grass', 'text', 'pointer', 'shells'],
  summary:
    'A heading grown over with fur, grass or moss: strands drawn by shells from the letters’ distance field and lit as strands, which the pointer combs over and which slowly stand back up.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'The heading in a warm brown with a soft text shadow, or the poster.',
    useCases: ['A playful or tactile hero heading', 'A pet, textile or outdoor brand'],
  },
};
