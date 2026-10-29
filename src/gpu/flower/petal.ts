/*
 * Story 11.1: a petal as a surface grown from its base, not a textured card. Twin of
 * src/wgsl/petal.wgsl, which the vertex shader evaluates per vertex, pulled from (u, v) on a grid.
 *
 * (u, v): u runs 0 at the base to 1 at the tip, v from -1 at one edge to 1 at the other. The petal
 * lies along +y with its upper (inner) face towards +z, its base at the origin.
 *
 * - Outline. The half-width is a bump u^a (1 - u)^b, normalised to 1 at `widest`: b sets the tip,
 *   from round (0.5, a vertical tangent) through a point (1) to a drawn-out point (1.5), and a
 *   follows from b and where the petal is widest. A claw narrows the base to a stalk. A notch pulls
 *   the tip's middle back, as a cherry blossom's or a pink's.
 * - Cup and curl. The edges rise towards the inner face across the petal, and the petal bends
 *   along its length at a constant curvature, `curl` radians in all (negative curls it back).
 * - Ruffles. A petal's edge ruffles because its margin grows more than its middle: Liang and
 *   Mahadevan's blooming lily. The edge's excess length `excess` (0.1 is a tenth longer) is taken
 *   up as a wave out of the surface, in a band `fringe` of the half-width from the edge. A sine of
 *   amplitude A and wavelength λ lengthens a line by (πA / λ)², so A = λ √excess / π. The
 *   wavelength of such buckling shortens as the excess grows (Sharon et al.'s leaf edges); here
 *   λ = λ0 / excess^¼, with λ0 set by the band's width. No excess, no ruffle; more, more and shorter
 *   waves.
 * - Wrap. In a bud a petal wraps the ones inside it: its cross-section is an arc of a circle,
 *   curvature `wrap` across (in 1 / lengths), the arc length kept, so a petal wider than its
 *   circle wraps round it. The cup's parabola is the open petal's shallower dish.
 * - Rolled margins. A rose's petal edges roll back as it opens, which is what points its open
 *   petals. The band outside 0.55 of the half-width bends back round an axis along the petal, at
 *   a constant curvature, through `roll` half-turns at the edge, from nothing at a third of the way
 *   up to all of it near the tip.
 */

export type Vec3 = [number, number, number];

export interface PetalShape {
  /** Length along the midline, m. */
  length: number;
  /** Greatest width, as a fraction of the length. */
  width: number;
  /** Where along it is widest, 0..1. */
  widest: number;
  /** The tip: 0 round, 0.5 a point, 1 drawn out. */
  tip: number;
  /** The stalk at the base, as a fraction of the length (0 for none). */
  claw: number;
  /** How far the tip's middle is pulled back, as a fraction of the length (0 for none). */
  notch: number;
  /** How far the edges rise towards the inner face, as a fraction of the half-width. */
  cup: number;
  /** Bend along the petal, radians in all: positive towards the inner face, negative back. */
  curl: number;
  /** The edge's growth beyond the middle's, as a fraction of its length. */
  excess: number;
  /** The band at the edge that grew more, as a fraction of the half-width. */
  fringe: number;
  /** How far the margins roll back towards the outer face, in half-turns at the edge. */
  roll: number;
  /** Curvature across the petal, towards the inner face, in 1 / lengths: wrapped round a bud. */
  wrap: number;
}

export const FLAT_PETAL: PetalShape = {
  length: 1,
  width: 0.6,
  widest: 0.6,
  tip: 0.2,
  claw: 0,
  notch: 0,
  cup: 0,
  curl: 0,
  excess: 0,
  fringe: 0.3,
  roll: 0,
  wrap: 0,
};

/** Where the rolled margin starts, as a fraction of the half-width. */
const ROLL_FROM = 0.55;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** The outline's exponents: b from the tip, a so that the bump peaks at `widest`. */
export function outlineExponents(shape: Readonly<PetalShape>): [number, number] {
  const b = 0.5 + shape.tip;
  const w = Math.min(Math.max(shape.widest, 0.05), 0.95);
  return [(b * w) / (1 - w), b];
}

/** Half-width at u, as a fraction of the length. */
export function halfWidth(shape: Readonly<PetalShape>, u: number): number {
  const [a, b] = outlineExponents(shape);
  const w = Math.min(Math.max(shape.widest, 0.05), 0.95);
  const peak = w ** a * (1 - w) ** b;
  const x = Math.min(Math.max(u, 0), 1);
  let h = (x ** a * (1 - x) ** b) / peak;
  if (shape.claw > 0) {
    // A stalk a sixth of the width, opening into the blade over the claw's length.
    h =
      Math.max(h, 0) * smoothstep(0, shape.claw * 1.6, x) +
      (1 / 6) * (1 - smoothstep(shape.claw * 0.6, shape.claw * 1.6, x));
  }
  return 0.5 * shape.width * h;
}

/** The ruffle's wavelength and amplitude along the edge, in lengths. */
export function ruffle(shape: Readonly<PetalShape>): { wavelength: number; amplitude: number } {
  if (shape.excess <= 0) return { wavelength: Infinity, amplitude: 0 };
  const band = Math.max(shape.fringe, 0.02) * 0.5 * shape.width;
  const wavelength = (2.2 * band) / shape.excess ** 0.25;
  return { wavelength, amplitude: (wavelength * Math.sqrt(shape.excess)) / Math.PI };
}

/** A point on the petal, m, and its distance out of the uncurled surface (for shading). */
export function petalPoint(shape: Readonly<PetalShape>, u: number, v: number): Vec3 {
  const L = shape.length;
  const h = halfWidth(shape, u);
  let x = v * h;
  // The notch pulls the middle of the tip back.
  const y = u * (1 - shape.notch * (1 - v * v) * u ** 6);
  // Out of the surface: the cup, then the ruffle in the band at the edge.
  let z = shape.cup * h * v * v;
  // The rolled margin: the band past ROLL_FROM bends back on an arc of radius rho.
  const turn = shape.roll * Math.PI * smoothstep(0.3, 0.9, u);
  if (turn > 1e-4 && Math.abs(v) > ROLL_FROM && h > 0) {
    const rho = ((1 - ROLL_FROM) * h) / turn;
    const w = (Math.abs(v) - ROLL_FROM) * h;
    const phi = w / rho;
    x += Math.sign(v) * (rho * Math.sin(phi) - w);
    z -= rho * (1 - Math.cos(phi));
  }
  // The wrap: across on an arc, keeping its length.
  if (shape.wrap > 1e-5) {
    const a = x * shape.wrap;
    z += (1 - Math.cos(a)) / shape.wrap;
    x = Math.sin(a) / shape.wrap;
  }
  const r = ruffle(shape);
  if (r.amplitude > 0) {
    const band = Math.max(shape.fringe, 0.02);
    const edge = Math.exp(-(1 - Math.abs(v)) / band) * smoothstep(0, 0.25, u);
    // Each edge has its own phase, so the two sides do not mirror.
    const phase = v < 0 ? 1.7 : 0;
    z += edge * r.amplitude * Math.sin((2 * Math.PI * u) / r.wavelength + phase);
  }
  // The curl: the midline on an arc, the offset along the arc's normal.
  if (Math.abs(shape.curl) < 1e-5) return [x * L, y * L, z * L];
  const radius = 1 / shape.curl;
  const theta = shape.curl * y;
  return [
    x * L,
    (radius * Math.sin(theta) - z * Math.sin(theta)) * L,
    (radius * (1 - Math.cos(theta)) + z * Math.cos(theta)) * L,
  ];
}

/**
 * Story 11.1's levels of detail: the grids an organ can be drawn with, finest first. An organ gets
 * the coarsest whose chord error (`gridError`) at its length on screen is within a pixel: its
 * normals are the surface's own, so inside a petal no facet shows, and a pixel is what the edge
 * can afford. Ruffles set it: their waves are short, and a grid's error falls as 1/n².
 */
export const PETAL_LODS = [
  { nu: 48, nv: 24 },
  { nu: 32, nv: 16 },
  { nu: 22, nv: 11 },
  { nu: 12, nv: 6 },
  { nu: 5, nv: 3 },
] as const;

/** The level of detail for a petal `px` long on screen, within `tolerance` px; the finest if none. */
export function petalLod(shape: Readonly<PetalShape>, px: number, tolerance = 1): number {
  for (let k = PETAL_LODS.length - 1; k > 0; k--) {
    const lod = PETAL_LODS[k]!;
    if (gridError(shape, lod.nu, lod.nv) * px <= tolerance) return k;
  }
  return 0;
}

/**
 * The level of detail for a ring round the axis (a tube or the receptacle) `radiusPx` across on
 * screen: the coarsest whose `nv - 1` segments round it stay within `tolerance` px of the circle,
 * a chord's sagitta r (1 - cos(π / n)).
 */
export function ringLod(radiusPx: number, tolerance = 1): number {
  for (let k = PETAL_LODS.length - 1; k >= 0; k--) {
    const n = PETAL_LODS[k]!.nv - 1;
    if (radiusPx * (1 - Math.cos(Math.PI / n)) <= tolerance) return k;
  }
  return RING_GRID;
}

/**
 * Every grid a flower is drawn with: the petals' levels of detail, then one for large rings, fine
 * round the axis (64 segments: within a pixel up to a radius of 830 px) and coarse along it.
 */
export const GRIDS = [...PETAL_LODS, { nu: 24, nv: 65 }] as const;
export const RING_GRID = PETAL_LODS.length;

/**
 * Where a grid's rows go along a petal, from evenly spaced s: closer together at the base and the
 * tip. A round tip's width runs as √(1 - u), and the base's as a low power of u, so their slopes are
 * infinite at the ends; spaced as u = s²(3 - 2s), both ends run linearly in s and a few rows draw
 * them. The shader spaces its rows the same way.
 */
export function gridU(s: number): number {
  return s * s * (3 - 2 * s);
}

/**
 * The worst distance, in petal lengths, between the surface and the flat triangles of an nu x nv
 * grid over it (rows spaced by `gridU`): measured at each cell's centre and the midpoints of its
 * edges.
 */
export function gridError(shape: Readonly<PetalShape>, nu: number, nv: number): number {
  const unit = { ...shape, length: 1 };
  const at = (s: number, v: number) => petalPoint(unit, gridU(s), v);
  let worst = 0;
  for (let j = 0; j < nu - 1; j++) {
    for (let i = 0; i < nv - 1; i++) {
      const u0 = j / (nu - 1);
      const u1 = (j + 1) / (nu - 1);
      const v0 = (i / (nv - 1)) * 2 - 1;
      const v1 = ((i + 1) / (nv - 1)) * 2 - 1;
      const corners = [at(u0, v0), at(u1, v0), at(u0, v1), at(u1, v1)];
      const mid = (a: Vec3, b: Vec3): Vec3 => [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        (a[2] + b[2]) / 2,
      ];
      const checks: [Vec3, Vec3][] = [
        [at((u0 + u1) / 2, v0), mid(corners[0]!, corners[1]!)],
        [at(u0, (v0 + v1) / 2), mid(corners[0]!, corners[2]!)],
        // The diagonal the two triangles share runs from (u1, v0) to (u0, v1).
        [at((u0 + u1) / 2, (v0 + v1) / 2), mid(corners[1]!, corners[2]!)],
      ];
      for (const [surface, flat] of checks) {
        worst = Math.max(
          worst,
          Math.hypot(surface[0] - flat[0], surface[1] - flat[1], surface[2] - flat[2]),
        );
      }
    }
  }
  return worst;
}
