import { describe, expect, it } from 'vitest';
import { leafColours, leafSpectrum, type Pigments } from '../src/gpu/optics/leaf.ts';

// Story 2.6: the leaf plate model. It must conserve energy, and a green leaf must look like the
// measured ones: most reflective in the green, dark in the blue and the red.

const GREEN: Pigments = { chlorophyll: 40, carotenoids: 10, brown: 0, layers: 1.5 };
const lambdas = Array.from({ length: 61 }, (_, i) => 400 + 5 * i);

describe('leaf optics', () => {
  it('reflects and transmits no more light than arrives, and loses none without pigments', () => {
    for (const p of [
      GREEN,
      { chlorophyll: 80, carotenoids: 20, brown: 0, layers: 2.5 },
      { chlorophyll: 2, carotenoids: 3, brown: 0.9, layers: 1.2 },
    ]) {
      for (const l of lambdas) {
        const { r, t } = leafSpectrum(p, l);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(r + t).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    const clear = { chlorophyll: 0, carotenoids: 0, brown: 0, layers: 1.5 };
    for (const l of [450, 550, 650]) {
      const { r, t } = leafSpectrum(clear, l);
      expect(r + t).toBeCloseTo(1, 6);
    }
  });

  it('makes a green leaf green: a peak in the green, troughs in the blue and the red', () => {
    const r = lambdas.map((l) => leafSpectrum(GREEN, l).r);
    const at = (l: number) => r[(l - 400) / 5]!;
    const visible = lambdas.filter((l) => l <= 690);
    const peak = visible.reduce((best, l) => (at(l) > at(best) ? l : best), 400);
    expect(peak).toBeGreaterThanOrEqual(520);
    expect(peak).toBeLessThanOrEqual(580);
    // Measured green leaves reflect about 10 to 15% at 550 nm and 4 to 7% in the red trough.
    expect(at(550)).toBeGreaterThan(0.08);
    expect(at(550)).toBeLessThan(0.2);
    expect(at(665)).toBeLessThan(0.08);
    expect(at(450)).toBeLessThan(0.07);
    const { reflect, transmit } = leafColours(GREEN);
    expect(reflect[1]).toBeGreaterThan(reflect[0]);
    expect(reflect[1]).toBeGreaterThan(reflect[2]);
    expect(transmit[1]).toBeGreaterThan(transmit[0]);
  });

  it('turns yellow as chlorophyll goes, and brown when the leaf dies', () => {
    const hue = (p: Pigments) => {
      const [r, g] = leafColours(p).reflect;
      return r / g;
    };
    const mature = hue(GREEN);
    const ageing = hue({ chlorophyll: 15, carotenoids: 9, brown: 0, layers: 1.5 });
    const dead = hue({ chlorophyll: 1, carotenoids: 2, brown: 0.8, layers: 1.5 });
    expect(ageing).toBeGreaterThan(mature);
    expect(dead).toBeGreaterThan(1);
  });
});
