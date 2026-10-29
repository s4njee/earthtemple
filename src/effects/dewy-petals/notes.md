## How it works

A macro close-up of a rose's petals beaded with dew (story 12.8). Three passes:

1. **The rose**, from the shared flower renderer, fully open and turning slowly, drawn sharp into an HDR target with each pixel's distance.
2. **The dew.** 700 drops on the petals' faces towards the sky, a radius from 0.25 to 2 mm as a power law, mostly small. They are placed by the CPU twin of the petal shader (`organPoint` in `src/gpu/flower/opening.ts`), so they sit on the surface the GPU draws, and each sits as a near-sphere: rose petals are the textbook hydrophobic surface, contact angles near 150° (Feng et al.'s "petal effect"). Each is drawn as a disc facing the camera over the sharp picture, with Water Temple's drop optics (its `droplets.wgsl`): a drop is a strong lens, so it shows a flipped, shrunk view of what is around it; its edge darkens; Fresnel takes in the sky at its rim; the sun makes a glint near its top and the light it gathers lands as a bright crescent on its far side. A drop behind a nearer petal is dropped by comparing its distance with the petal's.
3. **Depth of field**, the meadow's (64 taps here) (story 3.2's `dof.wgsl`), a gather over a Vogel disc, focused a few centimetres away with a macro lens's shallow depth.

## Cost

On an Apple M1 Max at 1080p: 2.71 ms a frame on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)) and 7.17 ms in Chrome (7.00 to 7.25 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)): **Tier C**, over the B it was planned for. The blur's 64 taps a pixel at full resolution are most of it; a half-resolution blur would be the saving.

## Pitfalls

- **Not macro.** At first the whole rose was in view and the blur hardly showed. The lens is 5 cm from the petals, and the aperture wide.
- **Stars in the bokeh.** A gather of 40 taps over a 26 px disc shows a bright glint as an asterisk of its taps. The meadow's tap count is now a pipeline constant: 40 there, 64 here, with a little of the stars left.
- **Dew in the wrong place.** Drops scattered over the whole rose left the view nearly dry; they are placed within reach of the axis the flower turns about.

## Safety

Flash `none`. Pattern `low`: the overlapping petal edges, turning, read as a weak rosette, 0.24 of the 0.4 limit for a still pattern. Glints are small and slow.

## When to use it

A perfume or skincare hero, a florist, a wedding or spa page.

## References

- Lin Feng et al., "Petal effect: a superhydrophobic state with high adhesive force", _Langmuir_ (2008).
- Martijn Steinrucken, rainy window shader tutorial: the drop as a flipped lens, as Water Temple's rain-glass uses it.
- Helmut Vogel, "A better way to construct the sunflower head" (1979): the blur's disc.
