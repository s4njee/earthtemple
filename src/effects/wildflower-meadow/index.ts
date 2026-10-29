import { meadowEffect } from '../meadow/index.ts';
import { meta } from './meta.ts';

// Story 12.3: the meadow (story 3.2) in flower. The grass field grows its wildflowers in drifts
// (story 11.6) and sets the heads nearest the camera aside in two lists by distance; the flower
// renderer (src/gpu/flower/render.ts) draws those whole, from the daisy's, buttercup's, poppy's
// and cornflower's floral diagrams, at the tips of the stems the field swayed and the pointer
// brushed, with no count ever read back. Further off they stay the field's points of colour.
export const effect = meadowEffect(meta, { wholeFlowers: true, flowers: 0.85 });
