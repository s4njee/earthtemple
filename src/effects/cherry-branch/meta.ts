import type { EffectMeta } from '../types.ts';

export const meta: EffectMeta = {
  id: 'cherry-branch',
  title: 'Cherry branch',
  epic: '12',
  tier: 'B',
  tags: ['flowers', 'trees', 'scroll', 'wind', 'hero'],
  summary:
    'A cherry branch that grows out across the view, buds and blossoms as the page scrolls, then lets its petals go on the breeze. The branch is grown by space colonisation and tapers by the pipe model; the blossoms open a little out of step on their pedicels, and each fallen petal tumbles as it drifts down.',
  scorecard: {
    compute: false,
    mobile: 'untested',
    flash: 'none',
    pattern: 'none',
    lightPage: 'yes',
    features: { required: [] },
    fallback: 'The poster: the branch in full blossom.',
    useCases: ['A spring or hanami page', 'A scroll story', 'A Japanese restaurant or tea brand'],
  },
};
