import { describe, expect, it } from 'vitest';
import { loadEffect } from '../src/effects/registry.ts';
import { STRONG_DOSE } from '../src/gpu/safety/dose.ts';
import { analyseFlashes, sampleCells, type CellSample, type FlashReport } from './flash.ts';
import { mountHeadless } from './headless.ts';

// Story 2.7: grass shimmer. Thin blades that sway alias, and an aliased blade sliding across a
// pixel flips it between grass and gap: flicker, at the scale of a pixel. The flash analyser's
// cells (24 x 14 over the view) average that away, so the same analysis runs here over regions of
// 5 x 5 pixels, and the area of those flashing more than three times a second must stay under the
// flash rule's area limit, as the analyser's own cells must. Each preset is measured from several
// starting moments (frame phases), at the default and at the strong dose, with a still camera.

const WIDTH = 480;
const HEIGHT = 270;
const SCALE = 4;
const REGION = 5;
const PHASES = [0.5, 1.13, 1.77, 2.41];
const SECONDS = 2;

export async function measureShimmer(
  id: string,
  options: { preset?: string; params?: Record<string, unknown>; settle: number },
): Promise<FlashReport> {
  const mounted = await mountHeadless(id, {
    width: WIDTH,
    height: HEIGHT,
    fps: 60,
    preset: options.preset,
    params: { drift: 0, ...options.params },
  });
  await mounted.runTo(options.settle);
  const columns = WIDTH / REGION;
  const rows = Math.floor(HEIGHT / REGION);
  const cells: CellSample[][] = [];
  for (let frame = 0; frame < SECONDS * 60; frame++) {
    mounted.step();
    cells.push(sampleCells(await mounted.read(), WIDTH, HEIGHT, columns, rows));
  }
  mounted.destroy();
  return analyseFlashes({ cells, cellAreaPx: REGION * REGION * SCALE * SCALE, fps: 60 });
}

const GRASS = [
  'grass-footer',
  'meadow',
  'lawn',
  'mowing',
  'grass-growth',
  'grass-edges',
  'fur-text',
] as const;

describe.skipIf(process.env.FLASH_SWEEP === '0')('grass shimmer', () => {
  for (const id of GRASS) {
    it(`${id}: no region shimmers over the flash limit, in any preset or phase`, async () => {
      const effect = await loadEffect(id);
      const presets = Object.keys(effect.presets ?? {}).filter((p) => p !== 'walk through');
      const worst: string[] = [];
      const over: string[] = [];
      for (const preset of presets) {
        for (const params of [{}, { dose: STRONG_DOSE }]) {
          for (const settle of PHASES) {
            const report = await measureShimmer(id, { preset, params, settle });
            worst.push(
              `${preset}${'dose' in params ? ' strong' : ''} @${settle}: ${report.flashingAreaPx} px, peak ${report.peakCellFlashes}`,
            );
            if (report.verdict === 'high') over.push(worst.at(-1)!);
          }
        }
      }
      if (process.env.SHIMMER_REPORT) console.log(`${id}\n  ${worst.join('\n  ')}`);
      expect(over).toEqual([]);
    }, 600_000);
  }
});
