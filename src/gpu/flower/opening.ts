import type { Organ } from './diagram.ts';
import { petalPoint, type PetalShape, type Vec3 } from './petal.ts';

/*
 * Story 11.4: a flower opens because each petal's inner face grows more than its outer one, or
 * swells with water, and so bends outwards (van Doorn and van Meeteren's review). A petal is a
 * bilayer: two faces bonded along it, and a strain difference Δε between them bends it. For two
 * layers of equal thickness and stiffness, Timoshenko's bimetal strip gives the curvature
 *
 *   κ = 3 Δε / (2 h)
 *
 * for a petal of thickness h. So a petal of length L turns through κ L = 3 Δε L / (2 h) radians.
 * Petals are thin: 4 cm long and 0.3 mm thick, a strain difference of 1% turns one through 2 rad,
 * from wrapped round the bud to curled back. That is why opening can be fast, and why some
 * flowers close again at night by turgor alone.
 *
 * Two places bend: the blade, which curls, and a short hinge at the base (the lowest 15% of the
 * petal), whose bend is the petal's tilt out from the axis. Each grows from its bud strain to its
 * open strain as the organ opens; the organs open ring by ring from the outside in, each over the
 * last part of the flower's progress that `stagger` leaves it. Strain grows linearly with the
 * organ's opening, so the curl and the tilt do too: the shader (flower-opening's flower.wgsl)
 * mixes the angles, which is the same thing.
 *
 * `organPoint` is the shader's placement on the CPU, so the bud and the open flower can be tested.
 */

/** A petal's thickness, m, unless a flower says otherwise. */
export const PETAL_THICKNESS = 0.0003;
/** The hinge at a petal's base, as a fraction of its length. */
export const HINGE = 0.15;

/** Timoshenko's curvature for two equal layers, 1/m, from their strain difference. */
export function bilayerCurvature(strainDifference: number, thickness = PETAL_THICKNESS): number {
  return (1.5 * strainDifference) / thickness;
}

/** The strain difference that turns a length through `angle` radians. */
export function strainForBend(angle: number, length: number, thickness = PETAL_THICKNESS): number {
  return (angle * thickness) / (1.5 * length);
}

export interface OpeningOptions {
  /** The blade's curl in the bud, rad (positive wraps it inwards, round the bud). */
  budCurl: number;
  /** How much of the flower's progress the opening order spreads over, 0 to 1. */
  stagger: number;
}

export interface OpenState {
  /** The organ's own opening, 0 (bud) to 1 (open). */
  open: number;
  /** Its tilt from the axis and the blade's curl, rad. */
  tilt: number;
  curl: number;
  /** The strain differences across its hinge and its blade that bend it so. */
  hingeStrain: number;
  bladeStrain: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** An organ's own opening from the flower's progress: the outer organs first. */
export function organOpening(order: number, progress: number, stagger: number): number {
  const start = order * stagger;
  return smoothstep(start, start + 1 - stagger, progress);
}

export function openState(
  organ: Readonly<Organ>,
  progress: number,
  options: Readonly<OpeningOptions>,
): OpenState {
  const open = organOpening(organ.order, progress, options.stagger);
  const length = organ.shape.length * organ.scale;
  const hinge = (angle: number) => strainForBend(angle, HINGE * length);
  const blade = (angle: number) => strainForBend(angle, length);
  const hingeStrain = hinge(organ.closed) + (hinge(organ.open) - hinge(organ.closed)) * open;
  const bladeStrain = blade(options.budCurl) + (blade(organ.curl) - blade(options.budCurl)) * open;
  return {
    open,
    tilt: bilayerCurvature(hingeStrain) * HINGE * length,
    curl: bilayerCurvature(bladeStrain) * length,
    hingeStrain,
    bladeStrain,
  };
}

/** Where a point (u, v) of an organ is, m, the flower's axis along +y: the shader's placement. */
export function organPoint(
  organ: Readonly<Organ>,
  state: Readonly<OpenState>,
  u: number,
  v: number,
): Vec3 {
  const tube = organ.tube;
  if (tube) {
    // A fused tube: a surface of revolution out to its rim, which widens as it opens.
    const rim = tube.rim[0] + (tube.rim[1] - tube.rim[0]) * state.open;
    const a = Math.PI * v;
    let r = organ.radius + (rim - organ.radius) * u ** tube.flare;
    r += (tube.ruffle ?? 0) * tube.length * u ** 4 * Math.sin((tube.waves ?? 0) * a) * state.open;
    return [r * Math.sin(a), organ.height + u * tube.length, r * Math.cos(a)];
  }
  // A lobe on a tube's rim rides the rim out as it opens.
  const radius =
    organ.radiusClosed === undefined
      ? organ.radius
      : organ.radiusClosed + (organ.radius - organ.radiusClosed) * state.open;
  const shape: PetalShape = { ...organ.shape, length: 1, curl: state.curl };
  const scale = organ.shape.length * organ.scale * (0.75 + 0.25 * state.open);
  const local = petalPoint(shape, u, v).map((c) => c * scale) as Vec3;
  const radial: Vec3 = [Math.sin(organ.azimuth), 0, Math.cos(organ.azimuth)];
  // across = up × radial
  const across: Vec3 = [radial[2], 0, -radial[0]];
  const t = state.tilt;
  const along: Vec3 = [Math.sin(t) * radial[0], Math.cos(t), Math.sin(t) * radial[2]];
  const inner: Vec3 = [-Math.cos(t) * radial[0], Math.sin(t), -Math.cos(t) * radial[2]];
  return [0, 1, 2].map(
    (k) =>
      radial[k]! * radius +
      (k === 1 ? organ.height : 0) +
      across[k]! * local[0] +
      along[k]! * local[1] +
      inner[k]! * local[2],
  ) as Vec3;
}
