import { FLAT_PETAL, type PetalShape } from './petal.ts';

/*
 * Story 11.2: a flower as botanists describe it, a floral diagram. Whorls of organs (sepals, then
 * petals, stamens and carpels inwards), each with its count (the merosity: a lily's threes, a
 * buttercup's fives) and its turn from the whorl outside it, half a member's angle when they
 * alternate, as they mostly do. Or a spiral, as a rose's or a camellia's petals are, placed by
 * Vogel's model: each member turned the golden angle from the last, moving inwards as it goes.
 *
 * `arrange` turns a diagram into its organs: where each sits on the receptacle, how far it opens,
 * its petal shape and the order it opens in. The same organs build the flower in 3D and draw its
 * diagram in 2D (`diagramSvg`), so a flower's structure can be checked against a botanical source.
 */

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * A flower's parts. The stem and its leaves are not in a floral diagram; the renderer adds them
 * (story 11.5, src/gpu/flower/render.ts).
 */
export type OrganKind =
  'sepal' | 'petal' | 'stamen' | 'carpel' | 'receptacle' | 'tube' | 'stem' | 'leaf';

interface Ring {
  organ: OrganKind;
  /** Radius from the axis at the organ's base, m. */
  radius: number;
  /** Height up the receptacle, m. */
  height: number;
  /** Angle from the axis, rad: in the bud, and when open. */
  closed: number;
  open: number;
  shape: PetalShape;
}

/**
 * A fused whorl's tube: the members joined along their lower parts into one surface round the axis,
 * a corolla tube (a morning glory's funnel) or a corona (a daffodil's trumpet). It rises `length`
 * from the whorl's radius and height to a rim that widens as the flower opens, its profile
 * r(u) = r0 + (rim - r0) u^flare; `waves` ruffles round the rim, `ruffle` of the length deep.
 * The free lobes of the members stand on the rim.
 */
export interface Tube {
  length: number;
  rim: [number, number];
  flare: number;
  waves?: number;
  ruffle?: number;
  /**
   * Story 12.5: in the bud the limb is furled in a spiral, turned this far round the axis at the
   * rim (as u²), and it untwists as it opens: a moonflower's bud is a twisted spire. `folds` is how
   * deep its pleats are in the bud, as a fraction of the radius, one to a wave: the twist turns them.
   */
  twist?: number;
  folds?: number;
}

export interface Whorl extends Ring {
  kind: 'whorl';
  count: number;
  /** Turn from the whorl outside it, as a fraction of the angle between members (0.5 alternates). */
  offset: number;
  /** Fused into a tube, with its members' free lobes on its rim (none for a corona alone). */
  tube?: Tube;
}

export interface Spiral extends Omit<Ring, 'radius' | 'height' | 'open' | 'closed'> {
  kind: 'spiral';
  count: number;
  /** Divergence between successive members, rad (the golden angle). */
  divergence: number;
  /** From the outermost member to the innermost. */
  radius: [number, number];
  height: [number, number];
  closed: [number, number];
  open: [number, number];
  /** The innermost member's size, as a fraction of the outermost's. */
  inner: number;
  /**
   * Curl from the outermost member to the innermost, when it changes along the spiral: a rose's
   * outer petals curl back and its inner ones curl in round the centre.
   */
  curl?: [number, number];
  /**
   * Spaced as Vogel's sunflower (story 4.4): radius as the square root of the members inside, so
   * each takes an equal share of the disc. Otherwise the radius runs evenly from outer to inner.
   */
  vogel?: boolean;
}

/**
 * Story 12.2: a bud whose petals are nested shells. In a rose's bud each petal wraps the ones
 * inside it, so in the bud each lies on its own sphere round a common centre on the axis, through
 * its base: the midline on the sphere's meridian (a constant curl of its length over the radius)
 * and the blade wrapped across at the sphere's curvature. Shells round one centre never cross, and
 * a spiral's members move inwards and up, so each lies inside the one before it. As it opens a
 * nested petal stays on a surface of revolution, a bowl that flattens and turns back: its wrap
 * across is the bowl's (`bowlWrap` in opening.ts), not a cup of its own, and nested bowls do not
 * cross either. A petal too long
 * for its shell is shorter in the bud and grows as it opens. While the bud is closed its shells
 * are stretched upwards, which keeps them nested (any affine map does): a rose's bud is taller
 * than it is wide.
 */
export interface Bud {
  /** The shells' centre, m above the receptacle. */
  centre: number;
  /** The closed bud's height over its width. */
  elongation: number;
  /** How near the top of its shell a tip may come, rad from the axis. */
  tip?: number;
}

export interface FloralDiagram {
  name: string;
  /** Outside in. */
  rings: readonly (Whorl | Spiral)[];
  bud?: Bud;
  /** Leave out the receptacle: a fallen petal is a petal alone (story 12.7). */
  receptacle?: false;
}

/** How long a petal is in the bud, as a fraction of its open length, unless its shell says less. */
export const BUD_SCALE = 0.75;

export interface Organ {
  organ: OrganKind;
  /** Around the axis, rad. */
  azimuth: number;
  radius: number;
  height: number;
  closed: number;
  open: number;
  /** Size, as a fraction of its shape's length. */
  scale: number;
  shape: PetalShape;
  /** 0 opens first (the outermost), 1 last. */
  order: number;
  /** Its curl when open, rad: its shape's, or along a spiral's range. */
  curl: number;
  /** A lobe on a tube's rim: its base's radius in the bud, moving out to `radius` as it opens. */
  radiusClosed?: number;
  /** The tube itself, for organ 'tube'. */
  tube?: Tube;
  /**
   * In a nested bud (`Bud`): wrapped round its shell and then its bowl, with its curl in the bud and
   * its length there as a fraction of its open one.
   */
  nested?: boolean;
  budCurl?: number;
  budScale?: number;
}

export function arrange(diagram: Readonly<FloralDiagram>): Organ[] {
  const organs: Organ[] = [];
  let turn = 0;
  let previous = 1;
  for (const [r, ring] of diagram.rings.entries()) {
    if (ring.kind === 'whorl') {
      // Turned from the whorl outside it by `offset` of that whorl's spacing, so whorls of the
      // same count alternate.
      turn += (ring.offset * 2 * Math.PI) / Math.max(previous, 1);
      const tube = ring.tube;
      if (tube) {
        organs.push({
          organ: 'tube',
          azimuth: 0,
          radius: ring.radius,
          height: ring.height,
          closed: 0,
          open: 0,
          scale: 1,
          shape: { ...FLAT_PETAL, length: tube.length },
          order: r,
          curl: 0,
          tube,
        });
      }
      for (let k = 0; k < ring.count; k++) {
        organs.push({
          organ: ring.organ,
          azimuth: turn + (2 * Math.PI * k) / ring.count,
          radius: tube ? tube.rim[1] : ring.radius,
          height: tube ? ring.height + tube.length : ring.height,
          closed: ring.closed,
          open: ring.open,
          scale: 1,
          shape: ring.shape,
          order: r,
          curl: ring.shape.curl,
          ...(tube ? { radiusClosed: tube.rim[0] } : {}),
        });
      }
      if (ring.count > 0) previous = ring.count;
    } else {
      for (let k = 0; k < ring.count; k++) {
        const t = ring.count > 1 ? k / (ring.count - 1) : 0;
        const mix = (r: [number, number]) => r[0] + (r[1] - r[0]) * t;
        const radius = ring.vogel
          ? ring.radius[1] + (ring.radius[0] - ring.radius[1]) * Math.sqrt(1 - t)
          : mix(ring.radius);
        organs.push({
          organ: ring.organ,
          azimuth: turn + k * ring.divergence,
          radius,
          height: mix(ring.height),
          closed: mix(ring.closed),
          open: mix(ring.open),
          scale: 1 + (ring.inner - 1) * t,
          shape: ring.shape,
          order: r + 0.9 * t,
          curl: ring.curl ? mix(ring.curl) : ring.shape.curl,
        });
      }
      previous = ring.count;
    }
  }
  // Opening order: ring by ring from the outside in, and along a spiral from its outer end.
  const last = Math.max(...organs.map((o) => o.order), 1e-9);
  for (const o of organs) o.order /= last;
  if (diagram.bud) nest(organs, diagram.bud);
  if (diagram.receptacle === false) return organs;
  // The receptacle the organs stand on: a low dome out a little past the widest base, so nothing
  // shows through the middle of the flower.
  const reach =
    Math.max(0.0015, ...organs.filter((o) => o.radiusClosed === undefined).map((o) => o.radius)) *
    1.15;
  organs.push({
    organ: 'receptacle',
    azimuth: 0,
    radius: 0,
    height: 0,
    closed: 0,
    open: 0,
    scale: 1,
    shape: { ...FLAT_PETAL, length: reach, cup: 0.35 },
    order: 0,
    curl: 0,
  });
  return organs;
}

/** Puts each sepal and petal on its shell in the bud (`Bud`). */
function nest(organs: Organ[], bud: Readonly<Bud>): void {
  const tip = bud.tip ?? 0.15;
  for (const o of organs) {
    if ((o.organ !== 'sepal' && o.organ !== 'petal') || o.radiusClosed !== undefined) continue;
    const below = bud.centre - o.height;
    const shell = Math.hypot(o.radius, below);
    // Leaving its base along the meridian, upwards: tilted out from the axis by this much.
    o.closed = Math.atan2(below, o.radius);
    // The arc from its base to the top of the shell, less the tip's gap.
    const arc = Math.atan2(o.radius, -below) - tip;
    const length = o.shape.length * o.scale;
    o.budScale = Math.min(BUD_SCALE, (shell * arc) / length);
    const inBud = length * o.budScale;
    o.budCurl = inBud / shell;
    o.nested = true;
  }
}

/** How far the open flower reaches from its axis, m. */
export function openReach(organs: readonly Organ[]): number {
  return Math.max(
    ...organs.map((o) =>
      o.tube
        ? o.tube.rim[1]
        : o.radius + o.shape.length * o.scale * Math.sin(Math.min(o.open, Math.PI / 2)),
    ),
  );
}

/** How high the open flower stands above its receptacle, m. */
export function openTop(organs: readonly Organ[]): number {
  return Math.max(
    ...organs.map((o) =>
      o.tube
        ? o.height + o.tube.length
        : o.height + o.shape.length * o.scale * Math.max(Math.cos(o.open), 0),
    ),
  );
}

const petal = (s: Partial<PetalShape>): PetalShape => ({ ...FLAT_PETAL, ...s });

const SEPAL = petal({ length: 0.02, width: 0.4, widest: 0.4, tip: 0.5, cup: 0.3 });
const STAMEN = petal({ length: 0.012, width: 0.08, widest: 0.9, tip: 0 });
const CARPEL = petal({ length: 0.014, width: 0.18, widest: 0.3, tip: 0 });

/** Lilies: two whorls of three tepals, alternating, six stamens and a three-part pistil. */
export const LILY: FloralDiagram = {
  name: 'lily',
  rings: [
    {
      kind: 'whorl',
      organ: 'petal',
      count: 3,
      offset: 0,
      radius: 0.003,
      height: 0,
      closed: 0.12,
      open: 1.2,
      shape: petal({
        length: 0.075,
        width: 0.32,
        widest: 0.42,
        tip: 0.6,
        curl: -2.2,
        cup: 0.25,
        excess: 0.04,
        fringe: 0.25,
      }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 3,
      offset: 0.5,
      radius: 0.0025,
      height: 0.001,
      closed: 0.1,
      open: 1.1,
      shape: petal({
        length: 0.072,
        width: 0.4,
        widest: 0.45,
        tip: 0.5,
        curl: -2.0,
        cup: 0.3,
        excess: 0.06,
        fringe: 0.22,
      }),
    },
    {
      kind: 'whorl',
      organ: 'stamen',
      count: 6,
      offset: 0,
      radius: 0.0015,
      height: 0.002,
      closed: 0.05,
      // Splayed and curving outwards, as a lily's are: upright, six long filaments are a grating.
      open: 0.75,
      shape: petal({ ...STAMEN, length: 0.05, curl: -0.6 }),
    },
    {
      kind: 'whorl',
      organ: 'carpel',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.002,
      closed: 0,
      open: 0.05,
      shape: petal({ ...CARPEL, length: 0.055, width: 0.05 }),
    },
  ],
};

/** Buttercups: five sepals, five glossy petals alternating with them, many stamens. */
export const BUTTERCUP: FloralDiagram = {
  name: 'buttercup',
  rings: [
    {
      kind: 'whorl',
      organ: 'sepal',
      count: 5,
      offset: 0,
      radius: 0.002,
      height: 0,
      closed: 0.3,
      open: 1.9,
      shape: petal({ ...SEPAL, length: 0.006 }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 5,
      offset: 0.5,
      radius: 0.0025,
      height: 0.0005,
      closed: 0.2,
      open: 1.15,
      shape: petal({ length: 0.012, width: 0.95, widest: 0.62, tip: 0, claw: 0.12, cup: 0.45 }),
    },
    {
      kind: 'spiral',
      organ: 'stamen',
      count: 55,
      divergence: GOLDEN_ANGLE,
      radius: [0.0022, 0.0012],
      height: [0.001, 0.0015],
      closed: [0.3, 0.2],
      open: [0.95, 0.5],
      inner: 0.8,
      shape: petal({ ...STAMEN, length: 0.0045, width: 0.15 }),
    },
    // Many free carpels in a green head at the centre, as the buttercups' are.
    {
      kind: 'spiral',
      organ: 'carpel',
      count: 21,
      divergence: GOLDEN_ANGLE,
      radius: [0.0011, 0.0001],
      height: [0.0015, 0.0025],
      closed: [0.2, 0],
      open: [0.7, 0.05],
      inner: 0.7,
      shape: petal({ ...CARPEL, length: 0.0025, width: 0.55 }),
    },
  ],
};

/** Cherry blossom: five sepals, five notched petals, a ring of long stamens. */
export const CHERRY: FloralDiagram = {
  name: 'cherry',
  rings: [
    {
      kind: 'whorl',
      organ: 'sepal',
      count: 5,
      offset: 0,
      radius: 0.002,
      height: 0,
      closed: 0.3,
      open: 2.1,
      shape: petal({ ...SEPAL, length: 0.005 }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 5,
      offset: 0.5,
      radius: 0.0025,
      height: 0.0005,
      closed: 0.15,
      open: 1.35,
      shape: petal({
        length: 0.016,
        width: 0.8,
        widest: 0.62,
        tip: 0,
        notch: 0.09,
        claw: 0.08,
        cup: 0.18,
        excess: 0.02,
        fringe: 0.3,
      }),
    },
    {
      kind: 'whorl',
      organ: 'stamen',
      count: 30,
      offset: 0,
      radius: 0.0022,
      height: 0.001,
      closed: 0.2,
      open: 0.8,
      shape: petal({ ...STAMEN, length: 0.008 }),
    },
    {
      kind: 'whorl',
      organ: 'carpel',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.001,
      closed: 0,
      open: 0.02,
      shape: petal({ ...CARPEL, length: 0.009, width: 0.06 }),
    },
  ],
};

/** Poppies: four crumpled petals in two pairs, a crown of stamens round a flat-topped capsule. */
export const POPPY: FloralDiagram = {
  name: 'poppy',
  rings: [
    {
      kind: 'whorl',
      organ: 'petal',
      count: 2,
      offset: 0,
      radius: 0.0065,
      height: 0,
      closed: 0.1,
      open: 1.25,
      shape: petal({
        length: 0.045,
        width: 1.15,
        widest: 0.6,
        tip: 0,
        cup: 0.35,
        excess: 0.16,
        fringe: 0.35,
      }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 2,
      offset: 0.25,
      radius: 0.006,
      height: 0.001,
      closed: 0.08,
      open: 1.05,
      shape: petal({
        length: 0.04,
        width: 1.1,
        widest: 0.6,
        tip: 0,
        cup: 0.45,
        excess: 0.18,
        fringe: 0.35,
      }),
    },
    {
      kind: 'spiral',
      organ: 'stamen',
      count: 89,
      divergence: GOLDEN_ANGLE,
      radius: [0.0055, 0.0042],
      height: [0.002, 0.003],
      closed: [0.2, 0.1],
      open: [0.75, 0.35],
      inner: 0.85,
      shape: petal({ ...STAMEN, length: 0.009 }),
    },
    {
      kind: 'whorl',
      organ: 'carpel',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.002,
      closed: 0,
      open: 0,
      shape: petal({ ...CARPEL, length: 0.012, width: 0.6 }),
    },
  ],
};

/**
 * Roses: five sepals, then a golden-angle spiral of petals, the outer open and curled back, their
 * margins rolling back as they open. The bud is nested shells (`Bud`), taller than wide.
 */
export const ROSE: FloralDiagram = {
  name: 'rose',
  bud: { centre: 0.009, elongation: 1.35 },
  rings: [
    {
      kind: 'whorl',
      organ: 'sepal',
      count: 5,
      offset: 0,
      radius: 0.0062,
      height: 0,
      closed: 0.25,
      open: 2.2,
      shape: petal({ ...SEPAL, length: 0.025, width: 0.25 }),
    },
    {
      kind: 'spiral',
      organ: 'petal',
      count: 40,
      divergence: GOLDEN_ANGLE,
      radius: [0.006, 0.0018],
      height: [0.0005, 0.0045],
      closed: [0, 0],
      open: [1.45, 0.3],
      inner: 0.45,
      // The innermost lean in over the middle, their tips short of the axis.
      curl: [-0.8, 0.6],
      shape: petal({
        length: 0.04,
        width: 1.05,
        widest: 0.62,
        tip: 0,
        cup: 0.55,
        curl: -0.8,
        excess: 0.03,
        fringe: 0.25,
        roll: 0.45,
      }),
    },
  ],
};

/** Camellias: a looser spiral of fewer, broader petals round a boss of stamens. */
export const CAMELLIA: FloralDiagram = {
  name: 'camellia',
  rings: [
    {
      kind: 'spiral',
      organ: 'petal',
      count: 21,
      divergence: GOLDEN_ANGLE,
      radius: [0.006, 0.0025],
      height: [0, 0.006],
      closed: [0.2, 0.05],
      open: [1.5, 0.6],
      inner: 0.6,
      curl: [-0.25, 0.6],
      shape: petal({
        length: 0.04,
        width: 0.95,
        widest: 0.65,
        tip: 0,
        notch: 0.03,
        cup: 0.3,
        curl: -0.25,
        excess: 0.02,
      }),
    },
    {
      kind: 'spiral',
      organ: 'stamen',
      count: 55,
      divergence: GOLDEN_ANGLE,
      radius: [0.0035, 0.0015],
      height: [0.004, 0.006],
      closed: [0.15, 0.05],
      open: [0.5, 0.2],
      inner: 0.8,
      shape: petal({ ...STAMEN, length: 0.014 }),
    },
  ],
};

/**
 * *Hibiscus trionum*, the flower-of-an-hour: five broad pale petals with a dark base, whose cuticle
 * is striated into a diffraction grating (Whitney et al.), and a column of stamens fused round the
 * style, the mallows' monadelphous column, with anthers along it.
 */
export const HIBISCUS: FloralDiagram = {
  name: 'hibiscus',
  rings: [
    {
      kind: 'whorl',
      organ: 'sepal',
      count: 5,
      offset: 0,
      radius: 0.003,
      height: 0,
      closed: 0.2,
      open: 1.5,
      shape: petal({ ...SEPAL, length: 0.014, width: 0.45, cup: 0.4 }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 5,
      offset: 0.5,
      radius: 0.0035,
      height: 0.0005,
      closed: 0.15,
      open: 1.3,
      shape: petal({
        length: 0.03,
        width: 0.95,
        widest: 0.68,
        tip: 0,
        claw: 0.06,
        cup: 0.25,
        curl: -0.2,
        excess: 0.025,
        fringe: 0.3,
      }),
    },
    // The fused column, upright, then its anthers spiralling up it.
    {
      kind: 'whorl',
      organ: 'stamen',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.001,
      closed: 0,
      open: 0,
      shape: petal({ ...STAMEN, length: 0.012, width: 0.12, widest: 0.5 }),
    },
    {
      kind: 'spiral',
      organ: 'stamen',
      count: 21,
      divergence: GOLDEN_ANGLE,
      radius: [0.0009, 0.0006],
      height: [0.004, 0.011],
      closed: [0.3, 0.3],
      open: [1.3, 1.1],
      inner: 0.8,
      shape: petal({ ...STAMEN, length: 0.0028 }),
    },
  ],
};

/**
 * Morning glory ('Heavenly Blue'): five petals fused nearly to their tips into a funnel that flares
 * into a limb, waved where the five petals were. It turns from purple to blue as it opens: Yoshida et al. found the
 * vacuole's pH rise from 6.6 to 7.7 in the hours before (the effect's `bud` pigments).
 */
export const MORNING_GLORY: FloralDiagram = {
  name: 'morning glory',
  rings: [
    {
      kind: 'whorl',
      organ: 'sepal',
      count: 5,
      offset: 0,
      radius: 0.0025,
      height: 0,
      closed: 0.15,
      open: 0.35,
      shape: petal({ ...SEPAL, length: 0.012, width: 0.35 }),
    },
    // Fused nearly to the edge: one funnel flaring into a limb, waved into its five petals.
    {
      kind: 'whorl',
      organ: 'petal',
      count: 0,
      offset: 0.5,
      radius: 0.0022,
      height: 0.0005,
      closed: 0,
      open: 0,
      tube: { length: 0.05, rim: [0.004, 0.045], flare: 3, waves: 5, ruffle: 0.05 },
      shape: FLAT_PETAL,
    },
    {
      kind: 'whorl',
      organ: 'stamen',
      count: 5,
      offset: 0,
      radius: 0.0012,
      height: 0.002,
      closed: 0.05,
      open: 0.15,
      shape: petal({ ...STAMEN, length: 0.022 }),
    },
    {
      kind: 'whorl',
      organ: 'carpel',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.002,
      closed: 0,
      open: 0,
      shape: petal({ ...CARPEL, length: 0.025, width: 0.05 }),
    },
  ],
};

/**
 * Daffodil: six tepals spread flat round a corona, a trumpet that is not petals at all but a
 * fused outgrowth of the perianth, ruffled at its rim.
 */
export const DAFFODIL: FloralDiagram = {
  name: 'daffodil',
  rings: [
    {
      kind: 'whorl',
      organ: 'petal',
      count: 3,
      offset: 0,
      radius: 0.004,
      height: 0,
      closed: 0.15,
      open: 1.45,
      shape: petal({
        length: 0.035,
        width: 0.55,
        widest: 0.5,
        tip: 0.55,
        cup: 0.15,
        curl: -0.15,
        excess: 0.01,
      }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 3,
      offset: 0.5,
      radius: 0.0038,
      height: 0.0005,
      closed: 0.12,
      open: 1.35,
      shape: petal({
        length: 0.033,
        width: 0.55,
        widest: 0.5,
        tip: 0.5,
        cup: 0.18,
        curl: -0.1,
        excess: 0.01,
      }),
    },
    // The corona alone: a tube with no lobes.
    {
      kind: 'whorl',
      organ: 'petal',
      count: 0,
      offset: 0,
      radius: 0.0035,
      height: 0.001,
      closed: 0,
      open: 0,
      tube: { length: 0.026, rim: [0.005, 0.013], flare: 1.6, waves: 7, ruffle: 0.06 },
      shape: FLAT_PETAL,
    },
    {
      kind: 'whorl',
      organ: 'stamen',
      count: 6,
      offset: 0,
      radius: 0.0015,
      height: 0.002,
      closed: 0.05,
      open: 0.12,
      shape: petal({ ...STAMEN, length: 0.018 }),
    },
    {
      kind: 'whorl',
      organ: 'carpel',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.002,
      closed: 0,
      open: 0,
      shape: petal({ ...CARPEL, length: 0.022, width: 0.05 }),
    },
  ],
};

/**
 * Ox-eye daisies (story 12.3): a composite head, a capitulum. A ring of green bracts under it, about
 * 21 white ray florets, each one strap-shaped petal, and a convex yellow disc of tiny florets packed
 * as Vogel's spiral.
 */
export const DAISY: FloralDiagram = {
  name: 'daisy',
  rings: [
    {
      kind: 'spiral',
      organ: 'sepal',
      count: 21,
      divergence: GOLDEN_ANGLE,
      radius: [0.0062, 0.0055],
      height: [-0.0006, 0],
      closed: [0.3, 0.3],
      open: [1.75, 1.6],
      inner: 0.9,
      shape: petal({ ...SEPAL, length: 0.0045, width: 0.35 }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 21,
      offset: 0,
      radius: 0.0068,
      height: 0.0006,
      closed: 0.25,
      open: 1.5,
      shape: petal({
        length: 0.019,
        width: 0.21,
        widest: 0.55,
        tip: 0.05,
        notch: 0.05,
        cup: 0.12,
        curl: -0.15,
      }),
    },
    {
      kind: 'spiral',
      organ: 'carpel',
      count: 130,
      divergence: GOLDEN_ANGLE,
      vogel: true,
      radius: [0.0066, 0.0002],
      height: [0.0008, 0.0034],
      closed: [0.25, 0],
      open: [0.55, 0],
      inner: 0.85,
      shape: petal({ ...CARPEL, length: 0.0016, width: 0.7, widest: 0.5 }),
    },
  ],
};

/**
 * Cornflowers (story 12.3): an urn of green bracts, about eight enlarged outer florets, each a
 * fan whose toothed rim is the blue (a notched, frilled tip on a narrow claw), round a tuft of
 * small purple inner florets.
 */
export const CORNFLOWER: FloralDiagram = {
  name: 'cornflower',
  rings: [
    {
      kind: 'spiral',
      organ: 'sepal',
      count: 13,
      divergence: GOLDEN_ANGLE,
      radius: [0.0042, 0.0036],
      height: [-0.004, 0.001],
      closed: [0.15, 0.1],
      open: [0.35, 0.25],
      inner: 0.9,
      shape: petal({ ...SEPAL, length: 0.006, width: 0.55, cup: 0.4 }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 8,
      offset: 0,
      radius: 0.0035,
      height: 0.005,
      closed: 0.3,
      open: 1.25,
      shape: petal({
        length: 0.016,
        width: 0.7,
        widest: 0.85,
        tip: 0,
        claw: 0.4,
        notch: 0.09,
        cup: 0.25,
        curl: -0.2,
        excess: 0.08,
        fringe: 0.35,
      }),
    },
    {
      kind: 'spiral',
      organ: 'stamen',
      count: 26,
      divergence: GOLDEN_ANGLE,
      vogel: true,
      radius: [0.003, 0.0003],
      height: [0.005, 0.0062],
      closed: [0.2, 0],
      open: [0.6, 0.1],
      inner: 0.85,
      shape: petal({ ...STAMEN, length: 0.008, width: 0.18 }),
    },
  ],
};

/**
 * Sunflowers (story 12.4): a capitulum 12 cm across. Leafy bracts under it, 34 ray florets (a
 * Fibonacci number, as the rays usually are), and 610 disc florets packed as Vogel's spiral, each
 * the golden angle from the last at a radius growing as the square root of its number: the
 * parastichies, 34 and 55 spirals, are what the eye picks out.
 */
export const SUNFLOWER: FloralDiagram = {
  name: 'sunflower',
  rings: [
    {
      kind: 'spiral',
      organ: 'sepal',
      count: 34,
      divergence: GOLDEN_ANGLE,
      radius: [0.062, 0.052],
      height: [-0.012, -0.003],
      closed: [0.5, 0.4],
      open: [1.95, 1.75],
      inner: 0.8,
      shape: petal({ ...SEPAL, length: 0.032, width: 0.45, widest: 0.3, tip: 0.9, curl: -0.4 }),
    },
    {
      kind: 'spiral',
      organ: 'petal',
      count: 34,
      divergence: GOLDEN_ANGLE,
      radius: [0.064, 0.061],
      height: [0, 0.002],
      closed: [0.35, 0.3],
      open: [1.52, 1.44],
      inner: 0.92,
      shape: petal({
        length: 0.075,
        width: 0.3,
        widest: 0.45,
        tip: 0.6,
        cup: 0.18,
        curl: -0.25,
        excess: 0.02,
      }),
    },
    {
      kind: 'spiral',
      organ: 'carpel',
      count: 610,
      divergence: GOLDEN_ANGLE,
      vogel: true,
      radius: [0.06, 0.0008],
      height: [0.003, 0.011],
      closed: [0.2, 0],
      open: [0.25, 0],
      inner: 0.8,
      shape: petal({ ...CARPEL, length: 0.0042, width: 0.85, widest: 0.5, tip: 0 }),
    },
  ],
};

/**
 * Moonflowers (story 12.5, _Ipomoea alba_): a long narrow tube flaring at its end into a broad flat
 * white limb, 14 cm across, folded into five by greener bands. The bud is a twisted spire that
 * unfurls at dusk; a few stamens and the style show at the throat.
 */
export const MOONFLOWER: FloralDiagram = {
  name: 'moonflower',
  rings: [
    {
      kind: 'whorl',
      organ: 'sepal',
      count: 5,
      offset: 0,
      radius: 0.0032,
      height: 0,
      closed: 0.12,
      open: 0.3,
      shape: petal({ ...SEPAL, length: 0.02, width: 0.3 }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 0,
      offset: 0.5,
      radius: 0.0028,
      height: 0.0005,
      closed: 0,
      open: 0,
      tube: {
        length: 0.1,
        rim: [0.0065, 0.07],
        flare: 5.5,
        waves: 5,
        ruffle: 0.035,
        twist: 2.6,
        folds: 0.45,
      },
      shape: FLAT_PETAL,
    },
    {
      kind: 'whorl',
      organ: 'stamen',
      count: 5,
      offset: 0,
      radius: 0.0015,
      height: 0.002,
      closed: 0.02,
      open: 0.08,
      shape: petal({ ...STAMEN, length: 0.1 }),
    },
    {
      kind: 'whorl',
      organ: 'carpel',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.002,
      closed: 0,
      open: 0.03,
      shape: petal({ ...CARPEL, length: 0.104, width: 0.03 }),
    },
  ],
};

/**
 * Tulips (story 12.6): two whorls of three broad tepals held as a cup, incurved at their tips,
 * six dark stamens and a three-lobed pistil. A tulip opens wide in the warmth and closes in the
 * cool of the evening (thermonasty: van Doorn and van Meeteren).
 */
export const TULIP: FloralDiagram = {
  name: 'tulip',
  rings: [
    {
      kind: 'whorl',
      organ: 'petal',
      count: 3,
      offset: 0,
      radius: 0.0042,
      height: 0,
      closed: 0.06,
      open: 0.5,
      shape: petal({
        length: 0.058,
        width: 0.74,
        widest: 0.58,
        tip: 0.3,
        cup: 0.55,
        curl: 0.3,
        excess: 0.01,
      }),
    },
    {
      kind: 'whorl',
      organ: 'petal',
      count: 3,
      offset: 0.5,
      radius: 0.0036,
      height: 0.001,
      closed: 0.04,
      open: 0.42,
      shape: petal({
        length: 0.056,
        width: 0.8,
        widest: 0.58,
        tip: 0.2,
        cup: 0.6,
        curl: 0.35,
        excess: 0.01,
      }),
    },
    {
      kind: 'whorl',
      organ: 'stamen',
      count: 6,
      offset: 0,
      radius: 0.002,
      height: 0.002,
      closed: 0.05,
      open: 0.15,
      shape: petal({ ...STAMEN, length: 0.022 }),
    },
    {
      kind: 'whorl',
      organ: 'carpel',
      count: 1,
      offset: 0,
      radius: 0,
      height: 0.002,
      closed: 0,
      open: 0.02,
      shape: petal({ ...CARPEL, length: 0.02, width: 0.35 }),
    },
  ],
};

export const FLOWERS = {
  lily: LILY,
  buttercup: BUTTERCUP,
  cherry: CHERRY,
  poppy: POPPY,
  rose: ROSE,
  camellia: CAMELLIA,
  hibiscus: HIBISCUS,
  'morning glory': MORNING_GLORY,
  daffodil: DAFFODIL,
  daisy: DAISY,
  cornflower: CORNFLOWER,
  sunflower: SUNFLOWER,
  moonflower: MOONFLOWER,
  tulip: TULIP,
};
export type FlowerName = keyof typeof FLOWERS;

/** The flower's floral diagram, as a botanist draws it: organs on rings seen from above. */
export function diagramSvg(diagram: Readonly<FloralDiagram>, size = 240): string {
  // The receptacle is under everything; a diagram leaves it out.
  const organs = arrange(diagram).filter((o) => o.organ !== 'receptacle' && o.organ !== 'tube');
  const kinds: OrganKind[] = ['sepal', 'petal', 'stamen', 'carpel', 'receptacle', 'tube', 'stem'];
  const ringOf = (o: Organ, i: number) => {
    const ring = diagram.rings.findIndex((r) => r.organ === o.organ);
    return ring + (diagram.rings[ring]?.kind === 'spiral' ? i / organs.length : 0);
  };
  const c = size / 2;
  const step = (size * 0.42) / Math.max(diagram.rings.length, 1);
  const marks = organs.map((o, i) => {
    const r = c * 0.92 - step * ringOf(o, i) - (o.organ === 'carpel' ? c : 0);
    const radius = Math.max(r, 0);
    const x = c + radius * Math.sin(o.azimuth);
    const y = c - radius * Math.cos(o.azimuth);
    const k = kinds.indexOf(o.organ);
    const fill = ['#5d7d3a', '#d98b9b', '#d6b13a', '#7a9a4a'][k];
    const w = o.organ === 'stamen' ? 3 : o.organ === 'carpel' ? 9 : 10 * o.scale;
    const turn = (o.azimuth * 180) / Math.PI;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(w * 1.4).toFixed(1)}" ry="${(w * 0.5 + 1).toFixed(1)}" transform="rotate(${turn.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${marks.join('')}</svg>`;
}
