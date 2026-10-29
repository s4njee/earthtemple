import type { FlowerName } from './diagram.ts';
import { leafColours } from '../optics/leaf.ts';
import type { PetalPigments } from '../optics/petal.ts';

// Stories 11.3 and 11.5: how each of the floral diagrams' flowers looks, from its pigments, and the
// stem it stands on. Shared by every effect that draws them (src/gpu/flower/render.ts).

type Vec3 = [number, number, number];

/** A flower's petals and parts: pigments for the petal and its throat, and its surface. */
export interface FlowerLook {
  petal: PetalPigments;
  /** The throat, at the petal's base: out to `throat` of its length, fading over `edge` of it. */
  base: PetalPigments;
  throat: number;
  edge?: number;
  filament: Vec3;
  anther: Vec3;
  /** A glossy epidermis over an air gap (the buttercup's), 0 to 1. */
  gloss: number;
  /** The sepals' and stem's colours, a leaf's (story 4.1) unless given; and the carpels'. */
  sepal?: { reflect: Vec3; transmit: Vec3 };
  carpel?: Vec3;
  /** The petal's pigments in the bud, when it changes colour as it opens. */
  bud?: PetalPigments;
  /** A fused tube's colour, from its base to its rim; the throat's and the petal's if not given. */
  tube?: { base: PetalPigments; rim: PetalPigments };
  /** Cuticle striations at the throat: their spacing, nm, and how strongly they diffract. */
  grating?: [number, number];
  /**
   * A funnel's five midpetaline bands (story 12.5), where the fused petals' midribs run to the rim:
   * how far they take the tube's base colour out to the mouth, 0 to 1.
   */
  bands?: number;
  /**
   * How many times slower than the others it opens and closes. A rose's bloom is a filled disc
   * growing as it opens, which the motion check reads as a zoom: at the others' pace, twice the cap;
   * at an eighth of it (a minute to open), under it everywhere in the cycle.
   */
  pace?: number;
  /**
   * How much of the view it fills, against the others. A lily's six tepals and six stamens are a
   * rosette of eight pairs, and swaying it is a moving pattern, whose limit is 0.25 of the central
   * field: framed as the others, it covered 0.34.
   */
  fill?: number;
}

export const SEPAL = leafColours({ chlorophyll: 40, carotenoids: 10, brown: 0, layers: 1.8 });
export const LOOKS: Record<FlowerName, FlowerLook> = {
  // A pink oriental lily, green-yellow in the throat.
  lily: {
    petal: { anthocyanin: 3.5, pH: 4.5, layers: 1.8 },
    base: { chlorophyll: 3, carotenoids: 8, layers: 1.8 },
    throat: 0.35,
    filament: [0.6, 0.62, 0.4],
    anther: [0.35, 0.08, 0.02],
    gloss: 0.04,
    fill: 0.8,
  },
  // Carotenoids, and flavonols at the base: a bee sees a dark centre (story 16.1).
  buttercup: {
    petal: { carotenoids: 45, layers: 1.8 },
    base: { carotenoids: 45, flavonols: 40, layers: 1.8 },
    throat: 0.3,
    filament: [0.55, 0.5, 0.08],
    anther: [0.85, 0.65, 0.05],
    gloss: 0.6,
  },
  // Nearly white, flushed pink towards the base.
  cherry: {
    petal: { anthocyanin: 0.5, pH: 4, layers: 2.6 },
    base: { anthocyanin: 3, pH: 4, layers: 2.2 },
    throat: 0.3,
    filament: [0.85, 0.8, 0.75],
    anther: [0.75, 0.55, 0.1],
    gloss: 0.02,
  },
  // Scarlet from anthocyanin and carotenoid together, with a black blotch of dense pigment.
  poppy: {
    petal: { anthocyanin: 22, pH: 3, carotenoids: 5, layers: 1.3, velvet: 0.5 },
    base: { anthocyanin: 140, pH: 5.5, layers: 1.3, velvet: 0.5 },
    throat: 0.18,
    filament: [0.03, 0.025, 0.03],
    anther: [0.05, 0.04, 0.06],
    gloss: 0.02,
  },
  // A red rose's velvet: conical cells over dense anthocyanin.
  rose: {
    petal: { anthocyanin: 70, pH: 3.5, carotenoids: 4, layers: 1.5, velvet: 1 },
    base: { anthocyanin: 12, pH: 4, carotenoids: 8, layers: 1.5, velvet: 1 },
    throat: 0.2,
    filament: [0.7, 0.6, 0.2],
    anther: [0.8, 0.6, 0.1],
    gloss: 0.02,
    pace: 8,
  },
  camellia: {
    petal: { anthocyanin: 7, pH: 4.5, layers: 1.8, velvet: 0.2 },
    base: { anthocyanin: 1, pH: 4.5, layers: 2.6 },
    throat: 0.1,
    filament: [0.85, 0.8, 0.55],
    anther: [0.85, 0.65, 0.08],
    gloss: 0.08,
  },
  // Cream petals, a maroon base whose striations diffract (Whitney et al.: about 1.3 µm apart).
  hibiscus: {
    petal: { carotenoids: 3, layers: 2.4 },
    base: { anthocyanin: 400, pH: 5.5, layers: 1.3, velvet: 0.4 },
    throat: 0.4,
    edge: 0.06,
    filament: [0.75, 0.7, 0.35],
    anther: [0.85, 0.7, 0.1],
    gloss: 0.05,
    grating: [1300, 0.6],
  },
  // Blue when open, purple in the bud (vacuole pH 7.7 against 6.6), white deep in the funnel.
  'morning glory': {
    petal: { anthocyanin: 9, pH: 7.7, layers: 1.6 },
    bud: { anthocyanin: 9, pH: 6.6, layers: 1.6 },
    base: { anthocyanin: 9, pH: 7.7, layers: 1.6 },
    throat: 0,
    tube: { base: { carotenoids: 2, layers: 2.8 }, rim: { anthocyanin: 9, pH: 7.7, layers: 1.6 } },
    filament: [0.85, 0.85, 0.8],
    anther: [0.9, 0.88, 0.8],
    gloss: 0.04,
  },
  // Yellow tepals round a deeper yellow trumpet.
  daffodil: {
    petal: { carotenoids: 28, layers: 2 },
    base: { carotenoids: 28, chlorophyll: 2, layers: 2 },
    throat: 0.15,
    tube: { base: { carotenoids: 60, layers: 1.8 }, rim: { carotenoids: 80, layers: 1.8 } },
    filament: [0.8, 0.75, 0.4],
    anther: [0.85, 0.7, 0.1],
    gloss: 0.05,
    // Six tepals: a rosette, as the lily's.
    fill: 0.85,
  },
  // Story 12.3's field flowers, coloured as the grass engine's far heads are (wildflowers.ts).
  // White rays from scattering alone, round a yellow disc of carotenoids.
  daisy: {
    petal: { layers: 3 },
    base: { layers: 3 },
    throat: 0,
    filament: [0.9, 0.75, 0.1],
    anther: [0.9, 0.75, 0.1],
    carpel: [0.85, 0.62, 0.04],
    gloss: 0.02,
  },
  // Story 12.6: a red tulip with a yellow heart; the tulips effect has the rest of the field.
  tulip: {
    petal: { anthocyanin: 48, pH: 3.2, carotenoids: 3, layers: 1.5 },
    base: { carotenoids: 40, layers: 1.7 },
    throat: 0.16,
    filament: [0.25, 0.2, 0.1],
    anther: [0.05, 0.04, 0.03],
    carpel: [0.45, 0.5, 0.2],
    gloss: 0.12,
  },
  // Story 12.5: white from scattering alone, greener deep in the tube and along the bands.
  moonflower: {
    petal: { layers: 3.2 },
    base: { chlorophyll: 0.5, carotenoids: 1.5, layers: 2.8 },
    throat: 0,
    tube: {
      base: { chlorophyll: 1.6, carotenoids: 1, layers: 2.4 },
      rim: { layers: 3.2 },
    },
    filament: [0.9, 0.9, 0.82],
    anther: [0.92, 0.9, 0.75],
    carpel: [0.9, 0.92, 0.82],
    gloss: 0.03,
    bands: 0.4,
  },
  // Story 12.4: carotenoids, deep in the rays, round a disc of dark florets.
  sunflower: {
    petal: { carotenoids: 60, layers: 1.8 },
    base: { carotenoids: 75, layers: 1.8 },
    throat: 0.15,
    filament: [0.4, 0.25, 0.05],
    anther: [0.1, 0.05, 0.02],
    carpel: [0.045, 0.024, 0.01],
    gloss: 0.03,
  },
  // Protocyanin: an anthocyanin held by iron and magnesium, blue, round purple inner florets.
  cornflower: {
    petal: { anthocyanin: 10, pH: 5, metal: 1, layers: 1.4 },
    base: { anthocyanin: 25, pH: 5, metal: 0.6, layers: 1.4 },
    throat: 0.35,
    filament: [0.25, 0.12, 0.45],
    anther: [0.12, 0.04, 0.22],
    gloss: 0.03,
  },
};

/** A stem's length and radius, m, and the head's mass, kg (story 11.5). */
export interface StemSize {
  length: number;
  radius: number;
  headMass: number;
}

/**
 * Story 11.5: each flower's stem (or pedicel, for a flower on a branch): its length, radius and the
 * head's mass. Green stems are taken at 1 GPa and water's density; the head's area facing the wind
 * is its open reach's disc.
 */
export const STEMS: Record<FlowerName, StemSize> = {
  lily: { length: 0.6, radius: 0.004, headMass: 0.012 },
  buttercup: { length: 0.3, radius: 0.0009, headMass: 0.0004 },
  cherry: { length: 0.025, radius: 0.0005, headMass: 0.0003 },
  poppy: { length: 0.5, radius: 0.0015, headMass: 0.001 },
  rose: { length: 0.4, radius: 0.0035, headMass: 0.008 },
  camellia: { length: 0.03, radius: 0.0025, headMass: 0.006 },
  hibiscus: { length: 0.06, radius: 0.0012, headMass: 0.002 },
  'morning glory': { length: 0.05, radius: 0.001, headMass: 0.0015 },
  daffodil: { length: 0.35, radius: 0.003, headMass: 0.006 },
  daisy: { length: 0.5, radius: 0.0015, headMass: 0.0006 },
  cornflower: { length: 0.5, radius: 0.0012, headMass: 0.0005 },
  sunflower: { length: 1.7, radius: 0.012, headMass: 0.35 },
  moonflower: { length: 0.12, radius: 0.0025, headMass: 0.004 },
  tulip: { length: 0.42, radius: 0.0035, headMass: 0.01 },
};
