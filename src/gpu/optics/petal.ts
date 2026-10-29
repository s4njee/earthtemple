import { carotenoidK, chlorophyllK, plateSpectrum, spectrumRgb } from './leaf.ts';

/*
 * Story 11.3: petal colours from petal pigments, on the leaf's plate model (leaf.ts). A petal is a
 * thinner plate than a leaf, a layer or two of cells, and what colours it is a different set of
 * pigments:
 *
 * - Anthocyanins, red to blue. The same molecule changes colour with the acidity of the vacuole
 *   it sits in: the red flavylium cation in acid, the violet quinoidal base near neutral, the blue
 *   anionic base above. Its absorption band moves from about 520 nm towards 600 as the pH rises.
 *   Blue flowers mostly get there by holding the pigment with a metal ion (aluminium in the
 *   hydrangea, iron and magnesium in the cornflower), which moves the band further: `metal`.
 * - Carotenoids, yellow and orange (the leaf's own band, with more of it).
 * - Betalains, in the beets and cacti instead of anthocyanins: betacyanins red-violet (538 nm) and
 *   betaxanthins yellow (480 nm).
 * - Chlorophyll, which green petals and the base of many keep.
 * - Flavonols, colourless to us: they absorb in the near ultraviolet (about 350 nm), and where a
 *   petal holds them it is dark to a bee. Nectar guides are flavonols at a petal's base. `uv` is
 *   the petal's reflectance at 360 nm for story 16.1's bee vision.
 *
 * The specific absorptions are Gaussian bands at the pigments' known peaks, scaled from their
 * molar absorption (cyanidin glucoside about 27,000 L/mol/cm at 520 nm, betanin 60,000 at 538,
 * quercetin glycosides about 20,000 at 350), so amounts are in µg/cm² as the leaf's are. As for the
 * leaf: plausible colours, not measured ones.
 *
 * A white petal is no pigment and a lot of scattering: air spaces between its cells, here more
 * layers. Conical epidermal cells (`velvet`) send light that would have reflected off the surface
 * into the petal, so more of it passes through the pigment: Noda et al.'s petunias without them are
 * paler. That is modelled as a longer path through the pigment; the velvet look in the shader is
 * the loss of gloss and a soft brightening at grazing angles.
 */

export interface PetalPigments {
  /** Anthocyanins, µg/cm², and the pH of the vacuole they sit in. */
  anthocyanin?: number;
  pH?: number;
  /** How far a metal ion holds the anthocyanin towards blue, 0 to 1. */
  metal?: number;
  carotenoids?: number;
  betacyanin?: number;
  betaxanthin?: number;
  chlorophyll?: number;
  /** Flavonols, µg/cm²: invisible to us, dark in the ultraviolet. */
  flavonols?: number;
  /** Structure: about 1.2 for a thin coloured petal, 2.5 or more for a white one. */
  layers: number;
  /** Conical epidermal cells, 0 (flat) to 1: a longer path through the pigment. */
  velvet?: number;
}

export interface PetalColours {
  /** Linear sRGB reflectance of the upper face. */
  reflect: [number, number, number];
  /** Linear sRGB transmittance. */
  transmit: [number, number, number];
  /** Reflectance at 360 nm, in the near ultraviolet. */
  uv: number;
}

const gauss = (x: number, mu: number, s1: number, s2 = s1) => {
  const s = x < mu ? s1 : s2;
  return Math.exp(-0.5 * ((x - mu) / s) ** 2);
};

/**
 * Where the anthocyanin band peaks, nm: the flavylium cation's red in acid, the quinoidal base's
 * violet from about pH 6, its anion's blue from about 7 to 8, and further with a metal ion.
 */
export function anthocyaninPeak(pH: number, metal = 0): number {
  const step = (a: number, b: number) => {
    const t = Math.min(Math.max((pH - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
  };
  return 518 + 30 * step(3, 6) + 55 * step(6.5, 8) + 40 * Math.min(Math.max(metal, 0), 1);
}

/** Specific absorption of anthocyanins, cm²/µg, at a given pH and metal binding. */
export function anthocyaninK(l: number, pH = 3, metal = 0): number {
  const mu = anthocyaninPeak(pH, metal);
  // A broad band, steeper on its red side, with a weak shoulder in the blue.
  return 0.06 * gauss(l, mu, 42, 30) + 0.01 * gauss(l, 420, 25);
}

export function betacyaninK(l: number): number {
  return 0.11 * gauss(l, 538, 32, 26);
}

export function betaxanthinK(l: number): number {
  return 0.16 * gauss(l, 480, 26, 20);
}

/** Flavonols: a band at 350 nm, its tail barely reaching the visible. */
export function flavonolK(l: number): number {
  return 0.043 * gauss(l, 350, 22, 18);
}

function absorption(p: Readonly<PetalPigments>, l: number): number {
  const path = 1 + 0.5 * (p.velvet ?? 0);
  return (
    path *
    ((p.anthocyanin ?? 0) * anthocyaninK(l, p.pH ?? 3, p.metal ?? 0) +
      (p.carotenoids ?? 0) * 1.4 * carotenoidK(l) +
      (p.betacyanin ?? 0) * betacyaninK(l) +
      (p.betaxanthin ?? 0) * betaxanthinK(l) +
      (p.chlorophyll ?? 0) * chlorophyllK(l) +
      (p.flavonols ?? 0) * flavonolK(l))
  );
}

/** Reflectance and transmittance of the petal at one wavelength. */
export function petalSpectrum(p: Readonly<PetalPigments>, l: number): { r: number; t: number } {
  return plateSpectrum(absorption(p, l), p.layers, l);
}

const cache = new Map<string, PetalColours>();

export function petalColours(p: Readonly<PetalPigments>): PetalColours {
  const key = JSON.stringify(p);
  const hit = cache.get(key);
  if (hit) return hit;
  const clamp = (c: [number, number, number]) => c.map((x) => Math.max(x, 0)) as typeof c;
  const out: PetalColours = {
    reflect: clamp(spectrumRgb((l) => petalSpectrum(p, l).r)),
    transmit: clamp(spectrumRgb((l) => petalSpectrum(p, l).t)),
    uv: petalSpectrum(p, 360).r,
  };
  cache.set(key, out);
  return out;
}

/**
 * Story 11.3's structural colour: a diffraction grating of cuticle striations, after Whitney et
 * al.'s *Hibiscus trionum*. Light leaving at sin θout from light arriving at sin θin (both measured
 * across the striations) is diffracted in its first order at λ = d |sin θout - sin θin|, nm for d
 * in nm. Returns that wavelength, or 0 when it falls outside the visible.
 */
export function gratingWavelength(spacing: number, sinIn: number, sinOut: number): number {
  const l = spacing * Math.abs(sinOut - sinIn);
  return l >= 400 && l <= 700 ? l : 0;
}
