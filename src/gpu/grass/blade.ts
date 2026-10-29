import type { Pigments } from '../optics/leaf.ts';

// Story 2.1: the blade model. Twin of src/wgsl/blade.wgsl, and the species table.

export type Vec3 = [number, number, number];

const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function bezier(v0: Vec3, v1: Vec3, v2: Vec3, t: number): Vec3 {
  return mix3(mix3(v0, v1, t), mix3(v1, v2, t), t);
}

/** Jahrmann and Wimmer's estimate of the arc length of a degree-2 curve. */
export function bezierLength(v0: Vec3, v1: Vec3, v2: Vec3): number {
  return (2 * dist(v0, v2) + dist(v0, v1) + dist(v1, v2)) / 3;
}

/** The true arc length, by summing many chords. */
export function arcLength(v0: Vec3, v1: Vec3, v2: Vec3, steps = 512): number {
  let total = 0;
  let prev = v0;
  for (let i = 1; i <= steps; i++) {
    const p = bezier(v0, v1, v2, i / steps);
    total += dist(prev, p);
    prev = p;
  }
  return total;
}

/** `blade_shape`: the guide and tip of a blade of `height` whose forces put its tip at `tip`. */
export function bladeShape(v0: Vec3, tip: Vec3, height: number): { v1: Vec3; v2: Vec3 } {
  let v2: Vec3 = [tip[0], Math.max(tip[1], v0[1]), tip[2]];
  const ratio = Math.hypot(v2[0] - v0[0], v2[2] - v0[2]) / height;
  let v1: Vec3 = [v0[0], v0[1] + height * Math.max(1 - ratio, 0.05 * Math.max(ratio, 1)), v0[2]];
  for (let k = 0; k < 2; k++) {
    const r = height / Math.max(bezierLength(v0, v1, v2), 1e-6);
    const g = mix3(v0, v1, r);
    v2 = [g[0] + r * (v2[0] - v1[0]), g[1] + r * (v2[1] - v1[1]), g[2] + r * (v2[2] - v1[2])];
    v1 = g;
  }
  return { v1, v2 };
}

/**
 * A kind of grass: its shape, how it stands, how it moves, and its pigments. Heights and widths in
 * metres. Colours are not picked: they come from the pigments through the leaf model
 * (src/gpu/optics/leaf.ts, story 2.6).
 */
export interface Species {
  /** Blade heights, shortest to tallest, before a clump's own scale. */
  height: readonly [number, number];
  /** Width at the root. */
  width: number;
  /** How the width narrows to the tip: w(t) = width (1 - t^taper)^0.6. Higher is blunter. */
  taper: number;
  /** Lean at rest, away from the clump's centre, as a fraction of the height. */
  lean: number;
  /** A blade's twist over its length, radians. */
  twist: number;
  /** Natural frequency of a 25 cm blade, Hz; a blade of height h sways at freq sqrt(0.25 / h). */
  freq: number;
  /** Blades per square metre at full density. */
  density: number;
  /** Fraction of blades that are dry. */
  dry: number;
  /** Fraction of blades that are flowering stems, with a seed head; and how much taller. */
  stems: number;
  stemHeight: number;
  /** Of the stems, the fraction that carry a flower instead (a meadow's wildflowers). */
  flowers: number;
  /** Leaf area index: blade area over ground area, for the canopy's Beer-Lambert darkening. */
  lai: number;
  pigments: {
    /** Low in the canopy, lush and pale ends of the blade-to-blade variation. */
    root: readonly [Pigments, Pigments];
    /** At the tip. */
    tip: readonly [Pigments, Pigments];
    /** A dead blade. */
    dead: Pigments;
    /** A seed head's chaff. */
    head: Pigments;
  };
}

const p = (chlorophyll: number, carotenoids: number, brown = 0, layers = 1.5): Pigments => ({
  chlorophyll,
  carotenoids,
  brown,
  layers,
});

export const SPECIES = {
  lawn: {
    height: [0.06, 0.11],
    width: 0.004,
    taper: 3,
    lean: 0.12,
    twist: 0.4,
    freq: 3.2,
    density: 6000,
    dry: 0.03,
    stems: 0,
    stemHeight: 1,
    flowers: 0,
    lai: 3,
    pigments: {
      root: [p(55, 12), p(42, 10)],
      tip: [p(42, 10), p(28, 8)],
      dead: p(2, 3, 0.7),
      head: p(4, 4, 0.5),
    },
  },
  meadow: {
    height: [0.18, 0.42],
    width: 0.006,
    taper: 2.2,
    lean: 0.22,
    twist: 0.8,
    freq: 1.6,
    density: 1600,
    dry: 0.08,
    stems: 0.06,
    stemHeight: 1.35,
    flowers: 0.15,
    lai: 3.5,
    pigments: {
      root: [p(50, 11), p(38, 9)],
      tip: [p(36, 9), p(22, 8)],
      dead: p(2, 3, 0.75),
      head: p(5, 5, 0.45),
    },
  },
  tussock: {
    height: [0.25, 0.6],
    width: 0.004,
    taper: 1.8,
    lean: 0.45,
    twist: 1.2,
    freq: 1.2,
    density: 1100,
    dry: 0.2,
    stems: 0.1,
    stemHeight: 1.25,
    flowers: 0,
    lai: 3,
    pigments: {
      root: [p(40, 10), p(28, 9)],
      tip: [p(22, 9), p(12, 8, 0.1)],
      dead: p(1, 3, 0.65),
      head: p(3, 5, 0.4),
    },
  },
  dry: {
    height: [0.2, 0.5],
    width: 0.005,
    taper: 2,
    lean: 0.25,
    twist: 0.9,
    freq: 1.4,
    density: 1000,
    dry: 0.7,
    stems: 0.12,
    stemHeight: 1.2,
    flowers: 0,
    lai: 2.5,
    pigments: {
      root: [p(20, 8, 0.1), p(10, 7, 0.2)],
      tip: [p(6, 6, 0.3), p(2, 4, 0.5)],
      dead: p(1, 3, 0.6),
      head: p(2, 4, 0.45),
    },
  },
} as const satisfies Record<string, Species>;

export type SpeciesName = keyof typeof SPECIES;
export const SPECIES_NAMES = Object.keys(SPECIES) as SpeciesName[];

/**
 * A cell per blade at the species' full density. The density setting thins blades by rejection,
 * not by spacing, so a blade is in the same place at any density.
 */
export function cellSize(species: Species): number {
  return 1 / Math.sqrt(Math.max(species.density, 1));
}

/** Bytes per blade in the drawn lists: v0 and width, v1 and facing, v2 and tone. */
export const BLADE_BYTES = 48;

/** Levels of the triangle strip per LOD: 15, 7 and 3 vertices, as Ghost of Tsushima's blades. A fourth list holds flower heads, four vertices each. */
export const LOD_LEVELS = [7, 3, 1] as const;
