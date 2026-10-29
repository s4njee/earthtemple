import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'grass-growth',
  title: 'Grass growth',
  epic: '3',
  tier: 'B',
  tags: ['grass', 'growth', 'scroll', 'compute'],
  summary:
    'A lawn growing in from bare ground as the page scrolls, or over time: patches sprout at their own moments and spread until they meet, each blade rising to its height. It shrinks back the same way.',
  scorecard: {
    compute: true,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'no',
    features: { required: [] },
    fallback: 'The poster: patches of lawn coming up through bare soil.',
    useCases: ['An onboarding or sign-up progress', 'A "growth" story on a landing page'],
  },
};
