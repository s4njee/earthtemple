import { describe, expect, it } from 'vitest';
import { arrange, FLOWERS } from '../src/gpu/flower/diagram.ts';
import {
  bilayerCurvature,
  openState,
  organPoint,
  strainForBend,
  type OpeningOptions,
} from '../src/gpu/flower/opening.ts';

// Story 11.4: petals open by a growth difference across them, from a closed bud to the open
// flower its diagram describes, never going back on the way.

const OPTIONS: OpeningOptions = { budCurl: 1.6, stagger: 0.45 };
const petals = (name: keyof typeof FLOWERS) =>
  arrange(FLOWERS[name]).filter((o) => o.organ === 'petal');

describe('opening by differential growth', () => {
  it('bends a bilayer as Timoshenko’s strip, and a 1% difference turns a petal through 2 rad', () => {
    expect(bilayerCurvature(0.01, 0.0003)).toBeCloseTo(50, 9);
    expect(bilayerCurvature(0.01, 0.0003) * 0.04).toBeCloseTo(2, 9);
    expect(strainForBend(2, 0.04, 0.0003)).toBeCloseTo(0.01, 12);
    expect(bilayerCurvature(-0.01)).toBe(-bilayerCurvature(0.01));
  });

  it('starts as a closed bud: every petal wraps inwards, its tip over the middle', () => {
    for (const name of Object.keys(FLOWERS) as (keyof typeof FLOWERS)[]) {
      for (const petal of petals(name)) {
        const state = openState(petal, 0, OPTIONS);
        expect(state.open).toBe(0);
        expect(state.curl).toBeGreaterThan(0);
        const tip = organPoint(petal, state, 1, 0);
        const base = organPoint(petal, state, 0, 0);
        const length = petal.shape.length * petal.scale;
        // The tip has come back towards the axis, along the petal's own way out (signed: an inner
        // petal's tip may reach past the axis), no further out than its base plus a third of its
        // length, and above the base.
        const out = (p: readonly number[]) =>
          p[0]! * Math.sin(petal.azimuth) + p[2]! * Math.cos(petal.azimuth);
        expect(out(tip)).toBeLessThan(out(base) + length / 3);
        expect(tip[1]).toBeGreaterThan(base[1]);
      }
    }
  });

  it('ends as the open flower its diagram describes', () => {
    for (const name of Object.keys(FLOWERS) as (keyof typeof FLOWERS)[]) {
      for (const organ of arrange(FLOWERS[name])) {
        if (organ.organ === 'receptacle') continue;
        const state = openState(organ, 1, OPTIONS);
        expect(state.open).toBeCloseTo(1, 9);
        expect(state.tilt).toBeCloseTo(organ.open, 9);
        expect(state.curl).toBeCloseTo(organ.curl, 9);
      }
    }
  });

  it('opens monotonically, the outer organs first', () => {
    for (const name of ['rose', 'camellia'] as const) {
      const organs = petals(name);
      let previous = organs.map((o) => openState(o, 0, OPTIONS));
      for (let k = 1; k <= 200; k++) {
        const now = organs.map((o) => openState(o, k / 200, OPTIONS));
        now.forEach((state, i) => {
          // Growth only adds: the inner face's lead never shrinks while the flower opens, so the
          // blade unwinds and the hinge leans out. A nested bud's petal (story 12.2) leans as its
          // shell holds it, and its hinge may relax as it is let go: only its blade unwinds.
          expect(state.bladeStrain).toBeLessThanOrEqual(previous[i]!.bladeStrain + 1e-12);
          if (!organs[i]!.nested) {
            expect(state.hingeStrain).toBeGreaterThanOrEqual(previous[i]!.hingeStrain - 1e-12);
            expect(state.tilt).toBeGreaterThanOrEqual(previous[i]!.tilt - 1e-12);
          }
          // An organ further out is at least as open as one further in.
          if (i > 0) expect(now[i - 1]!.open).toBeGreaterThanOrEqual(state.open - 1e-12);
        });
        previous = now;
      }
    }
  });

  it('needs only a strain difference of a few percent, for every flower', () => {
    for (const name of Object.keys(FLOWERS) as (keyof typeof FLOWERS)[]) {
      for (const petal of petals(name)) {
        for (const p of [0, 0.5, 1]) {
          const state = openState(petal, p, OPTIONS);
          expect(Math.abs(state.bladeStrain)).toBeLessThan(0.05);
          expect(Math.abs(state.hingeStrain)).toBeLessThan(0.15);
        }
      }
    }
  });
});

describe('fused corollas', () => {
  it('keeps every lobe on its tube’s rim from the bud to the open flower', async () => {
    const { FLAT_PETAL } = await import('../src/gpu/flower/petal.ts');
    const bell = arrange({
      name: 'bell',
      rings: [
        {
          kind: 'whorl',
          organ: 'petal',
          count: 5,
          offset: 0,
          radius: 0.002,
          height: 0,
          closed: 0.1,
          open: 0.9,
          tube: { length: 0.02, rim: [0.003, 0.01], flare: 1.5 },
          shape: { ...FLAT_PETAL, length: 0.01 },
        },
      ],
    });
    const tube = bell.find((o) => o.organ === 'tube')!;
    const lobes = bell.filter((o) => o.organ === 'petal');
    expect(lobes).toHaveLength(5);
    for (const p of [0, 0.3, 0.7, 1]) {
      const tubeState = openState(tube, p, OPTIONS);
      const rim = organPoint(tube, tubeState, 1, 0);
      const rimRadius = Math.hypot(rim[0], rim[2]);
      for (const lobe of lobes) {
        const base = organPoint(lobe, openState(lobe, p, OPTIONS), 0, 0);
        expect(Math.hypot(base[0], base[2])).toBeCloseTo(rimRadius, 9);
        expect(base[1]).toBeCloseTo(rim[1], 9);
      }
    }
  });

  it('opens a morning glory’s funnel tenfold, and gives a daffodil a corona with no lobes', () => {
    const glory = arrange(FLOWERS['morning glory']);
    const funnel = glory.find((o) => o.organ === 'tube')!;
    const mouth = (p: number) => {
      const q = organPoint(funnel, openState(funnel, p, OPTIONS), 1, 0.5);
      return Math.hypot(q[0], q[2]);
    };
    expect(mouth(1) / mouth(0)).toBeGreaterThan(9);
    const daffodil = arrange(FLOWERS.daffodil);
    expect(daffodil.filter((o) => o.organ === 'tube')).toHaveLength(1);
    expect(daffodil.filter((o) => o.organ === 'petal')).toHaveLength(6);
    expect(daffodil.some((o) => o.radiusClosed !== undefined)).toBe(false);
  });
});
