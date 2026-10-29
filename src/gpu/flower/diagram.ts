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

export type OrganKind = 'sepal' | 'petal' | 'stamen' | 'carpel';

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

export interface Whorl extends Ring {
  kind: 'whorl';
  count: number;
  /** Turn from the whorl outside it, as a fraction of the angle between members (0.5 alternates). */
  offset: number;
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
}

export interface FloralDiagram {
  name: string;
  /** Outside in. */
  rings: readonly (Whorl | Spiral)[];
}

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
}

export function arrange(diagram: Readonly<FloralDiagram>): Organ[] {
  const organs: Organ[] = [];
  let turn = 0;
  let previous = 1;
  for (const [r, ring] of diagram.rings.entries()) {
    if (ring.kind === 'whorl') {
      // Turned from the whorl outside it by `offset` of that whorl's spacing, so whorls of the
      // same count alternate.
      turn += (ring.offset * 2 * Math.PI) / previous;
      for (let k = 0; k < ring.count; k++) {
        organs.push({
          organ: ring.organ,
          azimuth: turn + (2 * Math.PI * k) / ring.count,
          radius: ring.radius,
          height: ring.height,
          closed: ring.closed,
          open: ring.open,
          scale: 1,
          shape: ring.shape,
          order: r,
          curl: ring.shape.curl,
        });
      }
      previous = ring.count;
    } else {
      for (let k = 0; k < ring.count; k++) {
        const t = ring.count > 1 ? k / (ring.count - 1) : 0;
        const mix = (r: [number, number]) => r[0] + (r[1] - r[0]) * t;
        organs.push({
          organ: ring.organ,
          azimuth: turn + k * ring.divergence,
          radius: mix(ring.radius),
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
  return organs;
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
      open: 0.45,
      shape: petal({ ...STAMEN, length: 0.05 }),
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
      count: 34,
      divergence: GOLDEN_ANGLE,
      radius: [0.0022, 0.0012],
      height: [0.001, 0.0015],
      closed: [0.3, 0.2],
      open: [0.95, 0.5],
      inner: 0.8,
      shape: petal({ ...STAMEN, length: 0.004 }),
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

/** Roses: five sepals, then a golden-angle spiral of petals, the outer open and curled back. */
export const ROSE: FloralDiagram = {
  name: 'rose',
  rings: [
    {
      kind: 'whorl',
      organ: 'sepal',
      count: 5,
      offset: 0,
      radius: 0.004,
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
      radius: [0.005, 0.0008],
      height: [0.001, 0.006],
      closed: [0.25, 0.02],
      open: [1.45, 0.35],
      inner: 0.45,
      curl: [-0.8, 0.9],
      shape: petal({
        length: 0.04,
        width: 1.05,
        widest: 0.62,
        tip: 0,
        cup: 0.55,
        curl: -0.8,
        excess: 0.03,
        fringe: 0.25,
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

export const FLOWERS = {
  lily: LILY,
  buttercup: BUTTERCUP,
  cherry: CHERRY,
  poppy: POPPY,
  rose: ROSE,
  camellia: CAMELLIA,
};
export type FlowerName = keyof typeof FLOWERS;

/** The flower's floral diagram, as a botanist draws it: organs on rings seen from above. */
export function diagramSvg(diagram: Readonly<FloralDiagram>, size = 240): string {
  const organs = arrange(diagram);
  const kinds: OrganKind[] = ['sepal', 'petal', 'stamen', 'carpel'];
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
