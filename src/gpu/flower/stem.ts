/*
 * Story 11.5: a flower's stem in the wind. A stem is a slender cantilever, fixed at the ground and
 * carrying its head at the tip. Its bending stiffness at the tip is k = 3 E I / L³ (I = π a⁴ / 4
 * for a solid round stem of radius a), and it sways as a damped oscillator of that stiffness and a
 * mass of the head plus 33/140 of the stem's own (Rayleigh's effective mass for a cantilever), so
 *
 *   f = (1 / 2π) √(k / m).
 *
 * A long stem under a heavy head sways slowly and far (a poppy, about 0.4 Hz); a short stiff one
 * quickly and little (a buttercup's). Plants damp their sway strongly, a damping ratio of 0.1 to 0.3
 * from leaves and the air (Niklas); 0.15 here. The wind pushes the head by its drag,
 * ½ ρ Cd A U², and the stem takes the shape of a cantilever under a tip load,
 * y(s) = δ s² (3L - s) / (2L³), whose tip turns through 3δ / 2L: the head tilts as it is pushed.
 * Petals flutter on top of that, at their own higher frequencies (Sousa's hierarchy).
 */

export interface Stem {
  /** m. */
  length: number;
  radius: number;
  /** Young's modulus, Pa: a few hundred MPa for a green stem. */
  modulus: number;
  /** kg/m³; about water's. */
  density: number;
  /** The head's mass, kg. */
  headMass: number;
  /** The head's area facing the wind, m², and its drag coefficient. */
  headArea: number;
  drag?: number;
  /** Damping ratio. */
  damping?: number;
}

export const AIR_DENSITY = 1.2;

export function stemStiffness(s: Readonly<Stem>): number {
  const I = (Math.PI * s.radius ** 4) / 4;
  return (3 * s.modulus * I) / s.length ** 3;
}

export function stemMass(s: Readonly<Stem>): number {
  return s.headMass + (33 / 140) * s.density * Math.PI * s.radius ** 2 * s.length;
}

/** The stem's natural frequency, Hz. */
export function stemFrequency(s: Readonly<Stem>): number {
  return Math.sqrt(stemStiffness(s) / stemMass(s)) / (2 * Math.PI);
}

/** The wind's drag on the head, N, at a speed of `wind` m/s. */
export function headDrag(s: Readonly<Stem>, wind: number): number {
  return 0.5 * AIR_DENSITY * (s.drag ?? 1.1) * s.headArea * wind * Math.abs(wind);
}

/** The stem's sideways displacement at `along` (0 at the ground, 1 at the head), for a tip at δ. */
export function stemShape(along: number, tip: number): number {
  return (tip * along * along * (3 - along)) / 2;
}

/** How far the head tilts, rad, when the tip is displaced by δ. */
export function headTilt(s: Readonly<Stem>, tip: number): number {
  return (1.5 * tip) / s.length;
}

/** The head's sway on the ground plane (x, z), a damped oscillator driven by the wind's drag. */
export class StemSway {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  readonly omega: number;
  readonly zeta: number;
  readonly mass: number;

  constructor(readonly stem: Readonly<Stem>) {
    this.omega = 2 * Math.PI * stemFrequency(stem);
    this.zeta = stem.damping ?? 0.15;
    this.mass = stemMass(stem);
  }

  /** Advances by `dt` s under a wind of (wx, wz) m/s; sub-stepped so a slow frame stays stable. */
  step(dt: number, wx: number, wz: number): void {
    const steps = Math.max(1, Math.ceil(dt * this.omega * 4));
    const h = dt / steps;
    const fx = headDrag(this.stem, wx) / this.mass;
    const fz = headDrag(this.stem, wz) / this.mass;
    for (let k = 0; k < steps; k++) {
      // Semi-implicit Euler: velocity first, then position from the new velocity.
      this.vx += h * (fx - this.omega ** 2 * this.x - 2 * this.zeta * this.omega * this.vx);
      this.vz += h * (fz - this.omega ** 2 * this.z - 2 * this.zeta * this.omega * this.vz);
      this.x += h * this.vx;
      this.z += h * this.vz;
    }
  }
}
