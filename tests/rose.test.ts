import { describe, expect, it } from 'vitest';
import { arrange, ROSE } from '../src/gpu/flower/diagram.ts';
import { bowlWrap, budStretch, openState, organPoint } from '../src/gpu/flower/opening.ts';
import { crossings } from './nesting.ts';

// Story 12.2: a rose's petals, nested shell inside shell in the bud and bowl inside bowl as they
// open, do not pass through each other.

const organs = arrange(ROSE);
const petals = organs.filter((o) => o.organ === 'petal' || o.organ === 'sepal');

describe('rose', () => {
  it('puts every petal on its own shell in the bud, each inside the one before', () => {
    const c = ROSE.bud!.centre;
    let previous = Infinity;
    for (const o of petals) {
      const shell = Math.hypot(o.radius, c - o.height);
      expect(shell).toBeLessThanOrEqual(previous + 1e-12);
      previous = shell;
      const state = openState(o, 0, { budCurl: 1.6, stagger: 0.45 });
      for (const u of [0, 0.3, 0.6, 1]) {
        for (const v of [-1, -0.5, 0, 0.5, 1]) {
          const p = organPoint(o, state, u, v);
          expect(Math.hypot(p[0], p[1] - c, p[2])).toBeCloseTo(shell, 5);
        }
      }
    }
  });

  it('wraps a petal on a sphere at the sphere’s curvature', () => {
    // A meridian through (r, h) of a sphere of radius R round (0, c), leaning t = atan2(c - h, r).
    const R = 0.01;
    const r = 0.006;
    const tilt = Math.atan2(Math.sqrt(R * R - r * r), r);
    for (const u of [0, 0.4, 0.8]) {
      expect(bowlWrap(r, tilt, 0.02 / R, 0.02, u)).toBeCloseTo(0.02 / R, 6);
    }
  });

  it('is taller than wide while closed, and not once open', () => {
    expect(budStretch(ROSE.bud, 0)).toBeCloseTo(ROSE.bud!.elongation, 9);
    expect(budStretch(ROSE.bud, 0.5)).toBe(1);
  });

  it('opens without a petal passing through another', () => {
    for (const progress of [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]) {
      const { share, deepest } = crossings(ROSE, organs, progress);
      // Before: 0.85 of the inner petals' points were outside a petal round them in the bud, and
      // 0.12 once open. Now under half a percent, the deepest the innermost two petals at the very
      // middle of the open rose.
      expect(share, `share at ${progress}`).toBeLessThan(0.005);
      expect(deepest, `depth at ${progress}`).toBeLessThan(0.002);
    }
  });
});
