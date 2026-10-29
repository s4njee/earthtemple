// Story 2.6: leaf colours from pigments, by a plate model after PROSPECT (Jacquemoud and Baret,
// 1990). A leaf is N layers. Each layer absorbs by its pigments and scatters at its surfaces, and
// the stack's reflectance and transmittance follow from Stokes' equations, as in PROSPECT.
//
// What is PROSPECT's: the plate model, its elementary-layer transmission (with the exponential
// integral), the 59 degree incidence on the top surface and the stack of N - 1 diffuse layers.
//
// What is not: the absorption spectra. PROSPECT ships measured specific absorption coefficients at
// every nanometre; these are sums of Gaussian bands placed at the pigments' known peaks (chlorophyll
// a and b in the blue and red, carotenoids in the blue-green, a brown pigment of dead leaves that
// absorbs more towards the blue), scaled so a typical green leaf comes out with a typical green
// reflectance. The colours are plausible, not measured: good enough to move a blade along
// "young, mature, senescent, dry" by physical amounts rather than by hand-picked greens.
//
// Colour: spectra from 400 to 700 nm under a 6504 K black body (close to D65), through the CIE 1931
// colour matching functions (Wyman, Sloan and Shirley's multi-lobe fit, 2013), to linear sRGB, with
// white mapped to white.

export interface Pigments {
  /** Chlorophyll a + b, ug/cm2. A green leaf is 30 to 60. */
  chlorophyll: number;
  /** Carotenoids, ug/cm2. Usually a quarter of the chlorophyll; they stay when it goes. */
  carotenoids: number;
  /** Brown pigment of dead tissue, arbitrary units 0 to 1. */
  brown: number;
  /** Structure parameter: about 1.5 for grasses (monocots), 2 or more for thick dicot leaves. */
  layers: number;
}

export interface LeafColours {
  /** Linear RGB reflectance, top surface. */
  reflect: [number, number, number];
  /** Linear RGB transmittance. */
  transmit: [number, number, number];
}

const LAMBDAS = Array.from({ length: 61 }, (_, i) => 400 + 5 * i);

const gauss = (x: number, mu: number, s1: number, s2 = s1) => {
  const s = x < mu ? s1 : s2;
  return Math.exp(-0.5 * ((x - mu) / s) ** 2);
};

/** Specific absorption of chlorophyll a + b, cm2/ug: Soret bands in the blue, Q bands in the red. */
export function chlorophyllK(l: number): number {
  return (
    0.06 * gauss(l, 432, 14) +
    0.045 * gauss(l, 405, 22) +
    0.05 * gauss(l, 458, 12) +
    0.03 * gauss(l, 666, 13) +
    0.016 * gauss(l, 642, 10) +
    0.008 * gauss(l, 688, 9) +
    0.009 * gauss(l, 605, 30) +
    0.011 * gauss(l, 540, 70)
  );
}

/** Specific absorption of carotenoids, cm2/ug: three bands in the blue-green, nothing past 530. */
export function carotenoidK(l: number): number {
  return 0.12 * gauss(l, 450, 16) + 0.11 * gauss(l, 478, 14) + 0.07 * gauss(l, 425, 14);
}

/** The brown pigment: falling smoothly from the blue to the red. */
export function brownK(l: number): number {
  return 1.6 * Math.exp(-(l - 400) / 110);
}

/** The cuticle's refractive index, nearly flat across the visible. */
const refractive = (l: number) => 1.47 - 0.00004 * (l - 400);

/** Unpolarised Fresnel transmittance at incidence `theta` (radians) into index `n`. */
function fresnelT(theta: number, n: number): number {
  const s = Math.sin(theta) / n;
  if (s >= 1) return 0;
  const ci = Math.cos(theta);
  const ct = Math.sqrt(1 - s * s);
  const rs = ((ci - n * ct) / (ci + n * ct)) ** 2;
  const rp = ((ct - n * ci) / (ct + n * ci)) ** 2;
  return 1 - 0.5 * (rs + rp);
}

/** Average transmittance of light arriving isotropically within `alpha` degrees of the normal. */
export function tav(alphaDeg: number, n: number, steps = 256): number {
  const alpha = (alphaDeg * Math.PI) / 180;
  let num = 0;
  for (let i = 0; i < steps; i++) {
    const t = ((i + 0.5) / steps) * alpha;
    num += fresnelT(t, n) * Math.sin(2 * t);
  }
  return (num * (alpha / steps)) / Math.sin(alpha) ** 2;
}

/** The exponential integral E1(x), x > 0, by series below 1 and continued fraction above. */
function expint(x: number): number {
  if (x < 1) {
    let sum = 0;
    let term = 1;
    for (let k = 1; k < 30; k++) {
      term *= -x / k;
      sum -= term / k;
    }
    return -0.5772156649 - Math.log(x) + sum;
  }
  let f = 0;
  for (let k = 40; k >= 1; k--) f = k / (1 + k / (x + f));
  return Math.exp(-x) / (x + f);
}

/** PROSPECT's transmission of an elementary layer of absorption `k`, for isotropic light. */
function layerTau(k: number): number {
  if (k <= 0) return 1;
  return (1 - k) * Math.exp(-k) + k * k * expint(k);
}

/** Reflectance and transmittance of the leaf at one wavelength. */
export function leafSpectrum(p: Pigments, l: number): { r: number; t: number } {
  const k = p.chlorophyll * chlorophyllK(l) + p.carotenoids * carotenoidK(l) + p.brown * brownK(l);
  return plateSpectrum(k, p.layers, l);
}

/**
 * The plate model at one wavelength: a stack of `layers` elementary layers absorbing `k` in all
 * (the sum over pigments of amount times specific absorption, cm2/ug times ug/cm2). Shared by the
 * leaf and the petal (src/gpu/optics/petal.ts), which differ only in their pigments and layers.
 */
export function plateSpectrum(
  kTotal: number,
  layers: number,
  l: number,
  surface = 1,
): { r: number; t: number } {
  const n = refractive(l);
  const N = Math.max(layers, 1.0001);
  const k = kTotal / N;
  const tau = layerTau(k);
  // `surface` scales the top face's own reflection, the light that never enters: a petal's conical
  // cells (story 11.3) trap most of it.
  const ralf = (1 - tav(59, n)) * surface;
  const talf = 1 - ralf;
  const t12 = tav(90, n);
  const r12 = 1 - t12;
  const t21 = t12 / (n * n);
  const r21 = 1 - t21;
  // The top layer, lit at 59 degrees.
  let denom = 1 - r21 * r21 * tau * tau;
  const Ta = (talf * tau * t21) / denom;
  const Ra = ralf + r21 * tau * Ta;
  // An inner layer, lit diffusely.
  const t = (t12 * tau * t21) / denom;
  const r = r12 + r21 * tau * t;
  // Stokes: N - 1 such layers.
  let Rsub: number;
  let Tsub: number;
  if (r + t >= 0.999999) {
    Tsub = t / (t + (1 - t) * (N - 1));
    Rsub = 1 - Tsub;
  } else {
    const D = Math.sqrt((1 + r + t) * (1 + r - t) * (1 - r + t) * (1 - r - t));
    const a = (1 + r * r - t * t + D) / (2 * r);
    const b = (1 - r * r + t * t + D) / (2 * t);
    const bN = b ** (N - 1);
    const bN2 = bN * bN;
    denom = a * a * bN2 - 1;
    Rsub = (a * (bN2 - 1)) / denom;
    Tsub = (bN * (a * a - 1)) / denom;
  }
  denom = 1 - Rsub * r;
  return { r: Ra + (Ta * Rsub * t) / denom, t: (Ta * Tsub) / denom };
}

// CIE 1931 2 degree colour matching functions, Wyman, Sloan and Shirley's multi-lobe fit.
const cmf = (l: number): [number, number, number] => [
  1.056 * gauss(l, 599.8, 37.9, 31.0) +
    0.362 * gauss(l, 442.0, 16.0, 26.7) -
    0.065 * gauss(l, 501.1, 20.4, 26.2),
  0.821 * gauss(l, 568.8, 46.9, 40.5) + 0.286 * gauss(l, 530.9, 16.3, 31.1),
  1.217 * gauss(l, 437.0, 11.8, 36.0) + 0.681 * gauss(l, 459.0, 26.0, 13.8),
];

const planck = (l: number, kelvin: number) => {
  const m = l * 1e-9;
  return 1 / (m ** 5 * (Math.exp(0.014388 / (m * kelvin)) - 1));
};

const XYZ_TO_SRGB = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.204, 1.057],
] as const;

function toRgb(spectrum: (l: number) => number): [number, number, number] {
  const xyz = [0, 0, 0];
  for (const l of LAMBDAS) {
    const e = planck(l, 6504) * spectrum(l);
    const c = cmf(l);
    for (let i = 0; i < 3; i++) xyz[i]! += e * c[i]!;
  }
  return XYZ_TO_SRGB.map((row) => row[0] * xyz[0]! + row[1] * xyz[1]! + row[2] * xyz[2]!) as [
    number,
    number,
    number,
  ];
}

const WHITE = toRgb(() => 1);

/** Linear sRGB of a spectrum under the black body, with a perfect white at (1, 1, 1). */
export function spectrumRgb(spectrum: (l: number) => number): [number, number, number] {
  const c = toRgb(spectrum);
  return [c[0] / WHITE[0], c[1] / WHITE[1], c[2] / WHITE[2]];
}

const cache = new Map<string, LeafColours>();

/** A leaf's reflected and transmitted colour, linear sRGB. */
export function leafColours(p: Pigments): LeafColours {
  const key = `${p.chlorophyll},${p.carotenoids},${p.brown},${p.layers}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const spectra = new Map(LAMBDAS.map((l) => [l, leafSpectrum(p, l)]));
  // A saturated green can fall just outside sRGB (a negative blue): clamp it in.
  const clamp = (c: [number, number, number]) => c.map((x) => Math.max(x, 0)) as typeof c;
  const out: LeafColours = {
    reflect: clamp(spectrumRgb((l) => spectra.get(l)!.r)),
    transmit: clamp(spectrumRgb((l) => spectra.get(l)!.t)),
  };
  cache.set(key, out);
  return out;
}
