import { petalColours, type PetalPigments } from '../optics/petal.ts';

/*
 * Story 11.6: the meadow's wildflowers, coloured by their pigments (src/gpu/optics/petal.ts), not
 * by hand. The order is the drift maps' in wildflowers.wgsl.
 */

export interface Wildflower {
  name: string;
  petal: PetalPigments;
  centre: PetalPigments;
  petals: number;
  /** How much of the meadow it claims, against the others. */
  abundance: number;
}

export const WILDFLOWERS: readonly Wildflower[] = [
  // White rays from scattering alone, round a yellow disc of carotenoids.
  {
    name: 'ox-eye daisy',
    petal: { layers: 3 },
    centre: { carotenoids: 40, layers: 1.6 },
    petals: 13,
    abundance: 1,
  },
  {
    name: 'buttercup',
    petal: { carotenoids: 45, layers: 1.8 },
    centre: { carotenoids: 45, layers: 1.8 },
    petals: 5,
    abundance: 1,
  },
  {
    name: 'poppy',
    petal: { anthocyanin: 40, pH: 3, carotenoids: 5, layers: 1.3, velvet: 0.5 },
    centre: { anthocyanin: 140, pH: 5.5, layers: 1.3 },
    petals: 4,
    abundance: 0.9,
  },
  // Cornflower blue is an anthocyanin held by iron and magnesium ions (protocyanin).
  {
    name: 'cornflower',
    petal: { anthocyanin: 10, pH: 5, metal: 1, layers: 1.4 },
    centre: { anthocyanin: 25, pH: 5, metal: 0.6, layers: 1.4 },
    petals: 8,
    abundance: 0.8,
  },
];

/** The look uniforms: petal colour and count, centre colour. */
export function wildflowerLook(): { flower_petal: Float32Array; flower_centre: Float32Array } {
  const petal = new Float32Array(16);
  const centre = new Float32Array(16);
  WILDFLOWERS.forEach((w, k) => {
    petal.set([...petalColours(w.petal).reflect, w.petals], 4 * k);
    centre.set([...petalColours(w.centre).reflect, 0], 4 * k);
  });
  return { flower_petal: petal, flower_centre: centre };
}

export const FLOWER_MIX = WILDFLOWERS.map((w) => w.abundance) as [number, number, number, number];

/** The mean head's area, m²: heads are 1.8 to 3.5 cm across (field.wgsl). */
export const HEAD_AREA = Math.PI * 0.0265 ** 2;
