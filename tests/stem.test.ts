import { describe, expect, it } from 'vitest';
import {
  headDrag,
  headTilt,
  stemFrequency,
  stemShape,
  stemStiffness,
  StemSway,
  type Stem,
} from '../src/gpu/flower/stem.ts';

// Story 11.5: a stem sways as a cantilever carrying its head.

const POPPY: Stem = {
  length: 0.5,
  radius: 0.001,
  modulus: 5e8,
  density: 1000,
  headMass: 0.001,
  headArea: 0.004,
};

describe('stems in the wind', () => {
  it('sways a poppy at about 0.4 Hz, slower for a longer stem or a heavier head', () => {
    expect(stemFrequency(POPPY)).toBeGreaterThan(0.3);
    expect(stemFrequency(POPPY)).toBeLessThan(0.55);
    expect(stemFrequency({ ...POPPY, length: 0.7 })).toBeLessThan(stemFrequency(POPPY));
    expect(stemFrequency({ ...POPPY, headMass: 0.005 })).toBeLessThan(stemFrequency(POPPY));
    // Twice as thick: sixteen times as stiff in bending (I goes as a⁴), under four times the stem.
    expect(stemStiffness({ ...POPPY, radius: 0.002 })).toBeCloseTo(16 * stemStiffness(POPPY), 12);
    expect(stemFrequency({ ...POPPY, radius: 0.002 })).toBeGreaterThan(2 * stemFrequency(POPPY));
  });

  it('rings down at its damping ratio, at its natural frequency', () => {
    const sway = new StemSway(POPPY);
    sway.x = 0.01;
    const dt = 1 / 600;
    const peaks: [number, number][] = [];
    let last = sway.x;
    let rising = false;
    for (let t = 0; t < 20; t += dt) {
      sway.step(dt, 0, 0);
      if (rising && sway.x < last && last > 0) peaks.push([t, last]);
      rising = sway.x > last;
      last = sway.x;
    }
    expect(peaks.length).toBeGreaterThan(3);
    // Period between peaks: the damped frequency, f √(1 - ζ²).
    const period = peaks[1]![0] - peaks[0]![0];
    const f = stemFrequency(POPPY) * Math.sqrt(1 - 0.15 ** 2);
    expect(1 / period).toBeCloseTo(f, 1);
    // Logarithmic decrement: ln(x1 / x2) = 2π ζ / √(1 - ζ²).
    const decrement = Math.log(peaks[0]![1] / peaks[1]![1]);
    expect(decrement).toBeCloseTo((2 * Math.PI * 0.15) / Math.sqrt(1 - 0.15 ** 2), 1);
  });

  it('settles under a steady wind where the stem’s stiffness holds the drag', () => {
    const sway = new StemSway(POPPY);
    for (let k = 0; k < 6000; k++) sway.step(1 / 100, 4, 0);
    expect(sway.x).toBeCloseTo(headDrag(POPPY, 4) / stemStiffness(POPPY), 6);
    expect(sway.z).toBe(0);
  });

  it('bends as a cantilever under a tip load, the head turning with it', () => {
    expect(stemShape(0, 0.02)).toBe(0);
    expect(stemShape(1, 0.02)).toBeCloseTo(0.02, 12);
    expect(stemShape(0.5, 0.02)).toBeCloseTo(0.02 * 0.3125, 12);
    // The slope at the tip is 3δ / 2L.
    const e = 1e-6;
    const slope = (stemShape(1, 0.02) - stemShape(1 - e, 0.02)) / e / POPPY.length;
    expect(slope).toBeCloseTo(headTilt(POPPY, 0.02), 4);
  });
});
