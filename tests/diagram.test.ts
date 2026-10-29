import { describe, expect, it } from 'vitest';
import {
  arrange,
  diagramSvg,
  FLOWERS,
  GOLDEN_ANGLE,
  LILY,
  ROSE,
} from '../src/gpu/flower/diagram.ts';

// Story 11.2: a floral diagram arranges what botanists say it does.

const TURN = 2 * Math.PI;
const wrap = (a: number) => ((a % TURN) + TURN) % TURN;

describe('floral diagrams', () => {
  it('alternates a lily’s two whorls of three tepals, and gives it six stamens', () => {
    const organs = arrange(LILY);
    const petals = organs.filter((o) => o.organ === 'petal');
    expect(petals).toHaveLength(6);
    expect(organs.filter((o) => o.organ === 'stamen')).toHaveLength(6);
    const outer = petals.slice(0, 3).map((o) => wrap(o.azimuth));
    const inner = petals.slice(3).map((o) => wrap(o.azimuth));
    // Each inner tepal sits halfway between two outer ones: 60° from its nearest.
    for (const a of inner) {
      const nearest = Math.min(...outer.map((b) => Math.min(wrap(a - b), wrap(b - a))));
      expect(nearest).toBeCloseTo(TURN / 6, 9);
    }
  });

  it('places a rose’s petals the golden angle apart, moving inwards and smaller', () => {
    const petals = arrange(ROSE).filter((o) => o.organ === 'petal');
    expect(petals).toHaveLength(40);
    for (let k = 1; k < petals.length; k++) {
      expect(petals[k]!.azimuth - petals[k - 1]!.azimuth).toBeCloseTo(GOLDEN_ANGLE, 12);
      expect(petals[k]!.radius).toBeLessThan(petals[k - 1]!.radius);
      expect(petals[k]!.scale).toBeLessThan(petals[k - 1]!.scale);
    }
    expect((GOLDEN_ANGLE * 180) / Math.PI).toBeCloseTo(137.508, 3);
  });

  it('opens from the outside in, and every flower draws its diagram', () => {
    for (const diagram of Object.values(FLOWERS)) {
      const all = arrange(diagram);
      // Every flower stands on one receptacle, wider than any organ's base.
      const receptacle = all.filter((o) => o.organ === 'receptacle');
      expect(receptacle).toHaveLength(1);
      const organs = all.filter((o) => o.organ !== 'receptacle' && o.organ !== 'tube');
      for (const o of organs) {
        // Lobes stand on a tube's rim, not the receptacle.
        if (o.radiusClosed === undefined) {
          expect(o.radius).toBeLessThan(receptacle[0]!.shape.length);
        }
      }
      // Arranged outside in: the outer ring opens first, and nothing opens before what is outside it.
      expect(organs[0]!.order).toBe(0);
      for (let k = 1; k < organs.length; k++) {
        expect(organs[k]!.order).toBeGreaterThanOrEqual(organs[k - 1]!.order);
      }
      expect(organs.at(-1)!.order).toBe(1);
      for (const o of organs) {
        expect(o.order).toBeGreaterThanOrEqual(0);
        expect(o.order).toBeLessThanOrEqual(1);
        expect(o.open).toBeGreaterThanOrEqual(o.closed);
      }
      const svg = diagramSvg(diagram);
      expect(svg.match(/<ellipse/g)).toHaveLength(organs.length);
      expect(svg).not.toContain('NaN');
    }
  });
});
