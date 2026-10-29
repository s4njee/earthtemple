import { describe, expect, it } from 'vitest';
import { linearToOklch } from '../src/gpu/colour/oklab.ts';
import {
  anthocyaninPeak,
  gratingWavelength,
  petalColours,
  type PetalPigments,
} from '../src/gpu/optics/petal.ts';

// Story 11.3: petal colours follow their pigments the way flowers' do.

/** OKLCH hue in degrees, 0 to 360. */
const hue = (p: PetalPigments) =>
  ((((linearToOklch(petalColours(p).reflect)[2] * 180) / Math.PI) % 360) + 360) % 360;
const lightness = (p: PetalPigments) => linearToOklch(petalColours(p).reflect)[0];

describe('petal optics', () => {
  it('turns anthocyanin from red in acid through purple to blue as the pH and metal rise', () => {
    expect(anthocyaninPeak(3)).toBeLessThan(anthocyaninPeak(6));
    expect(anthocyaninPeak(6)).toBeLessThan(anthocyaninPeak(8));
    expect(anthocyaninPeak(8, 1)).toBeGreaterThan(anthocyaninPeak(8));
    const red = hue({ anthocyanin: 12, pH: 3, layers: 1.3 });
    const purple = hue({ anthocyanin: 12, pH: 6, layers: 1.3 });
    const blue = hue({ anthocyanin: 12, pH: 7.5, metal: 1, layers: 1.3 });
    // OKLCH hue: red near 20-30°, purple near 320, blue near 260. Red to purple is backwards round
    // the circle; purple to blue goes down.
    expect(red < 60 || red > 340).toBe(true);
    expect(purple).toBeGreaterThan(280);
    expect(purple).toBeLessThan(345);
    expect(blue).toBeGreaterThan(200);
    expect(blue).toBeLessThan(purple);
  });

  it('turns a morning glory from purple to blue as its vacuole goes from pH 6.6 to 7.7', () => {
    // Yoshida et al. (1995): the pH rise in the hours before it opens.
    const bud = hue({ anthocyanin: 9, pH: 6.6, layers: 1.6 });
    const open = hue({ anthocyanin: 9, pH: 7.7, layers: 1.6 });
    expect(bud).toBeGreaterThan(285);
    expect(open).toBeLessThan(270);
    expect(open).toBeGreaterThan(200);
  });

  it('makes carotenoids yellow, betaxanthins yellow and betacyanins magenta', () => {
    const yellow = hue({ carotenoids: 25, layers: 1.5 });
    expect(yellow).toBeGreaterThan(75);
    expect(yellow).toBeLessThan(115);
    const beet = hue({ betacyanin: 10, layers: 1.3 });
    expect(beet > 330 || beet < 15).toBe(true);
    const xanthin = hue({ betaxanthin: 8, layers: 1.5 });
    expect(xanthin).toBeGreaterThan(70);
    expect(xanthin).toBeLessThan(115);
  });

  it('makes an unpigmented petal near white, whiter with more scattering', () => {
    const white = petalColours({ layers: 3 }).reflect;
    for (const c of white) expect(c).toBeGreaterThan(0.6);
    expect(Math.max(...white) - Math.min(...white)).toBeLessThan(0.05);
    expect(lightness({ layers: 3 })).toBeGreaterThan(lightness({ layers: 1.3 }));
  });

  it('deepens a petal’s colour with conical cells, as Noda et al.’s petunias without them pale', () => {
    const flat = linearToOklch(petalColours({ anthocyanin: 6, pH: 4, layers: 1.3 }).reflect);
    const velvet = linearToOklch(
      petalColours({ anthocyanin: 6, pH: 4, layers: 1.3, velvet: 1 }).reflect,
    );
    expect(velvet[0]).toBeLessThan(flat[0]);
  });

  it('darkens the ultraviolet with flavonols and leaves the visible colour as it was', () => {
    const plain = petalColours({ carotenoids: 25, layers: 1.5 });
    const guided = petalColours({ carotenoids: 25, flavonols: 30, layers: 1.5 });
    expect(guided.uv).toBeLessThan(plain.uv * 0.6);
    for (let i = 0; i < 3; i++) expect(guided.reflect[i]).toBeCloseTo(plain.reflect[i]!, 2);
  });

  it('diffracts by the grating equation, in the visible only', () => {
    expect(gratingWavelength(1200, 0, 0.4)).toBeCloseTo(480, 9);
    expect(gratingWavelength(1200, 0.2, -0.3)).toBeCloseTo(600, 9);
    expect(gratingWavelength(1200, 0, 0.1)).toBe(0);
    expect(gratingWavelength(1200, -0.4, 0.4)).toBe(0);
  });
});
