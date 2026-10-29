import { describe, expect, it } from 'vitest';
import {
  FLAT_PETAL,
  halfWidth,
  petalPoint,
  ruffle,
  type PetalShape,
} from '../src/gpu/flower/petal.ts';

// Story 11.1: a petal's ruffles come from its edge's excess growth, and its outline is what its
// parameters say.

const shape = (s: Partial<PetalShape>): PetalShape => ({ ...FLAT_PETAL, ...s });

/** Sign changes of the edge's height out of the surface, base to tip: twice the waves. */
const crossings = (s: PetalShape) => {
  let count = 0;
  let last = 0;
  for (let i = 0; i <= 2000; i++) {
    const z = petalPoint(s, 0.25 + (0.7 * i) / 2000, 0.98)[2];
    if (Math.abs(z) < 1e-9) continue;
    if (last && Math.sign(z) !== Math.sign(last)) count++;
    last = z;
  }
  return count;
};

/** The edge's length, base to tip, over its length in the plane: the excess it took up. */
const edgeExcess = (s: PetalShape) => {
  let curved = 0;
  let flat = 0;
  let prev = petalPoint(s, 0.3, 0.995);
  let prevFlat = petalPoint({ ...s, excess: 0 }, 0.3, 0.995);
  for (let i = 1; i <= 4000; i++) {
    const u = 0.3 + (0.6 * i) / 4000;
    const p = petalPoint(s, u, 0.995);
    const q = petalPoint({ ...s, excess: 0 }, u, 0.995);
    curved += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
    flat += Math.hypot(q[0] - prevFlat[0], q[1] - prevFlat[1], q[2] - prevFlat[2]);
    prev = p;
    prevFlat = q;
  }
  return curved / flat - 1;
};

describe('petal', () => {
  it('is flat, with no ruffle, when its edge grew no more than its middle', () => {
    for (let i = 0; i <= 20; i++) {
      for (const v of [-1, -0.5, 0, 0.5, 1]) expect(petalPoint(FLAT_PETAL, i / 20, v)[2]).toBe(0);
    }
    expect(ruffle(FLAT_PETAL).amplitude).toBe(0);
  });

  it('ruffles more, in more and shorter waves, the more its edge grew', () => {
    const waves = [0.02, 0.08, 0.3].map((excess) => crossings(shape({ excess })));
    expect(waves[0]).toBeGreaterThan(0);
    expect(waves[1]).toBeGreaterThan(waves[0]!);
    expect(waves[2]).toBeGreaterThan(waves[1]!);
    const lengths = [0.02, 0.08, 0.3].map((excess) => ruffle(shape({ excess })).wavelength);
    expect(lengths[1]).toBeLessThan(lengths[0]!);
    expect(lengths[2]).toBeLessThan(lengths[1]!);
  });

  it('takes up its excess length in the ruffle, at the edge', () => {
    // The wave is a sine, so the length it adds is the excess to first order.
    for (const excess of [0.02, 0.05]) {
      expect(edgeExcess(shape({ excess }))).toBeGreaterThan(excess * 0.6);
      expect(edgeExcess(shape({ excess }))).toBeLessThan(excess * 1.4);
    }
  });

  it('is widest where it says, and closed at its base and tip', () => {
    for (const widest of [0.3, 0.5, 0.75]) {
      const s = shape({ widest });
      let best = 0;
      for (let i = 0; i <= 1000; i++)
        if (halfWidth(s, i / 1000) > halfWidth(s, best / 1000)) best = i;
      expect(Math.abs(best / 1000 - widest)).toBeLessThan(0.01);
      expect(halfWidth(s, widest)).toBeCloseTo(s.width / 2, 6);
    }
    expect(halfWidth(FLAT_PETAL, 0)).toBe(0);
    expect(halfWidth(FLAT_PETAL, 1)).toBe(0);
  });

  it('keeps its length when it curls', () => {
    const curled = shape({ curl: -1.2 });
    let length = 0;
    let prev = petalPoint(curled, 0, 0);
    for (let i = 1; i <= 1000; i++) {
      const p = petalPoint(curled, i / 1000, 0);
      length += Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
      prev = p;
    }
    expect(length).toBeCloseTo(1, 4);
    // Curled back: the tip is behind the base's plane.
    expect(petalPoint(curled, 1, 0)[2]).toBeLessThan(-0.3);
  });
});

describe('petal levels of detail', () => {
  it('draws each petal with the coarsest grid within a pixel, coarser as it gets smaller', async () => {
    const { arrange, FLOWERS } = await import('../src/gpu/flower/diagram.ts');
    const { PETAL_LODS, gridError, petalLod } = await import('../src/gpu/flower/petal.ts');
    const shapesOf = (diagrams: readonly (typeof FLOWERS)[keyof typeof FLOWERS][]) =>
      diagrams
        .flatMap((d) => arrange(d))
        .filter((o) => o.organ === 'petal' || o.organ === 'sepal')
        .map((o) => ({ ...o.shape, curl: o.curl }));
    // The rose has a budget of its own: its forty petals' rolled margins (story 12.2) are tight
    // curves across, a level finer than a flat petal.
    const { rose, ...others } = FLOWERS;
    const all = shapesOf(Object.values(FLOWERS));
    const vertices = (px: number, shapes = shapesOf(Object.values(others))) =>
      shapes.reduce((n, s) => {
        const lod = PETAL_LODS[petalLod(s, px)]!;
        return n + lod.nu * lod.nv;
      }, 0) / shapes.length;
    for (const s of all) {
      let last = 0;
      for (const px of [200, 100, 50, 25, 12, 6]) {
        const k = petalLod(s, px);
        const lod = PETAL_LODS[k]!;
        // Every petal of every flower is within a pixel up to 200 px long.
        expect(gridError(s, lod.nu, lod.nv) * px).toBeLessThanOrEqual(1);
        expect(k).toBeGreaterThanOrEqual(last);
        last = k;
      }
    }
    // A petal 100 px long needs about a 22 x 11 grid on average, and one 25 px long a third of it.
    expect(vertices(100)).toBeLessThan(22 * 11);
    expect(vertices(25)).toBeLessThan((22 * 11) / 3);
    expect(vertices(100, shapesOf([rose]))).toBeLessThan(32 * 16);
  });
});
