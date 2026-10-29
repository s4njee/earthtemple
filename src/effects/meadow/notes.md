## How it works

The grass engine's showpiece (stories 2.1 to 2.8 and 3.2): a meadow at eye level running to the horizon.

- **Blades.** The engine grows them afresh each frame in compute, out to 26 to 34 m (`src/gpu/grass/field.wgsl`). Past 5 to 7 m they thin as the inverse square of distance, the ones kept widened to keep the field's coverage. They clump, lean with gusts that travel across the field, and flutter at their own frequency, less the stiffer they are. A few are dry; some are flowering stems with seed heads; in drifts, some carry a flower (ox-eye daisy, buttercup, poppy, cornflower).
- **The far field.** Beyond the blades, the ground is the canopy seen from afar (`ground.wgsl`): the same shading averaged over pseudo-blades leaning with the wind, so it meets the blades without a seam and its sheen moves with the gusts. Shells are an option (`far grass`), and add nothing visible at eye level.
- **Colour.** From leaf pigments through a plate model after PROSPECT (`src/gpu/optics/leaf.ts`): chlorophyll, carotenoids and a brown pigment, root to tip, lush to pale, dead and chaff. Not picked greens.
- **Light** (`grass-shade.wgsl`):
  - diffuse on the sun's side, and translucency on the other: the leaf's transmittance, which is what makes a backlit meadow glow;
  - a broad sheen along the blades, faded on blades too thin to resolve it;
  - canopy occlusion by the Beer-Lambert law at the leaf area index, so roots are dark;
  - shadows from the clouds drawn in the sky (`src/wgsl/clouds.wgsl`), and aerial perspective towards the horizon's haze.
- **Sky.** A gradient, the sun and its glow, cumulus 1.5 km up, and a hedgerow or tree line hazed along the horizon (`sky.wgsl`).
- **Lens.** Depth of field by a scatter-as-gather pass over the strip's distances (`dof.wgsl`), only where something blurs by 2 px or more. Pollen hangs in the light, bright against the sun, its light kept constant however small it is (`pollen.wgsl`).
- **The pointer** brushes a path through the grass: a ray to half the canopy's height presses the trample field (`src/gpu/wind/trample.wgsl`), along the pointer's motion, and the grass springs back over a few seconds, without overshoot, to exactly upright.

The camera drifts sideways slowly, and is level, its horizon set by shifting the lens. Multisampled colour, distance and depth cover only the rows the grass reaches (`strip.ts`).

## Cost

On an Apple M1 Max at 1080p ([docs/studies/epic-3.md](../../../docs/studies/epic-3.md)): 2.1 ms a frame on Dawn at midday, 3.4 at golden hour (depth of field 1.4 of it), 3.6 at dusk. In Chrome, one 1920 × 1080 frame reads 6.2 ms at midday, 7.7 at golden hour and 6.5 at dusk ([browser-check.md](../../../docs/studies/browser-check.md)): **Tier C**, provisional. At half the density it reads 4.8 ms in Chrome, inside Tier B's 6 ms: the `sparse` preset is that version.

About 75,000 blades from 1.4 million cells at midday; placement is 0.5 to 0.65 ms of it, most of the cells rejected beyond the fade. Clouds and their shadows cost 0.6 ms, multisampling 0.6, sheen 0.2 ([docs/studies/grass-realism.md](../../../docs/studies/grass-realism.md)). Blade lists 42 MB (four of 220,000 at 48 bytes), the trample field 0.5 MB.

## Pitfalls

- **The strip must reach the horizon.** Grass lower than the eye rises towards the horizon with distance, so rows cut at the nearest tallest blade left a band of sky below the horizon.
- **A grid as wide as the far plane is waste.** The cells are bounded by the view's width at the blades' reach, not at the depth buffer's 3 km.
- **Focus where a photographer would.** Most of the frame is nearer than the middle distance; focused far, nearly all of it blurred.
- **Normals facing the viewer, once per blade.** By the triangle's winding, a backlit blade was lit by reflection and translucency did nothing. Chosen per pixel or per vertex, a nearly edge-on blade's normal passed through zero and shimmered.
- **A view among the blades** makes the near ones a grating and moves them past the motion caps (docs/studies/grass-safety.md). Golden hour is framed from just above the grass.
- **Walking through** is a zoom the motion check cannot see: it is held from the camera's own motion, and gated.

## Safety

Flash `low` at golden hour (single transitions in single cells), `none` otherwise. Pattern `none`. Motion inside the caps but for `walk through` (0.13 zoom doublings a second, declared and gated). The shimmer test passes every preset at four frame phases and the strong dose with no region over the limit at all: at most three flashes a second in any 5 × 5 pixel region. A held frame is a lull, with no gust.

## When to use it

A hero for an outdoor, travel or seasonal brand, with text on a plate over the sky. It needs its own sky: it does not sit over a page. A photograph or a looping video is the honest fallback, and on most phones the better choice.

## References

- Eric Wohllaib, "Procedural Grass in _Ghost of Tsushima_", GDC 2021; Klemens Jahrmann and Michael Wimmer, I3D 2017.
- Stéphane Jacquemoud and Frédéric Baret, "PROSPECT: a model of leaf optical properties spectra" (1990).
- Jerome Lengyel et al., "Real-Time Fur over Arbitrary Surfaces", I3D 2001 (shells).
- Chris Wyman, Peter-Pike Sloan and Peter Shirley, "Simple Analytic Approximations to the CIE XYZ Color Matching Functions", JCGT (2013).
- [plan.md](../../../plan.md), stories 2.5 to 2.10 and 3.2.
