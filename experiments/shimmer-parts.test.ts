import { it } from 'vitest';
import { measureShimmer } from '../tests/shimmer.test.ts';

// Scratch: which part of the recipe makes backlit grass shimmer (story 2.7). SHIMMER_ID,
// SHIMMER_PRESET and SHIMMER_ABLATE (comma-separated) pick what to measure.
it('parts', async () => {
  const id = process.env.SHIMMER_ID ?? 'meadow';
  const preset = process.env.SHIMMER_PRESET ?? 'golden hour';
  for (const ablate of (process.env.SHIMMER_ABLATE ?? 'none').split(',')) {
    let worst = 0;
    let peak = 0;
    for (const settle of [0.5, 1.13, 1.77, 2.41]) {
      const r = await measureShimmer(id, { preset, params: { dose: 0.7, ablate }, settle });
      worst = Math.max(worst, r.flashingAreaPx);
      peak = Math.max(peak, r.peakCellFlashes);
    }
    console.log(`${id} ${preset} without ${ablate}: ${worst} px, peak ${peak}`);
  }
}, 600_000);
