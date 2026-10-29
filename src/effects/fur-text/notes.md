## How it works

A heading grown over with a coat of fur, grass or moss, by shells (Lengyel et al.) in one fullscreen pass (`fur.wgsl`), over the heading's distance field (Temple of Time's text field, in device pixels, negative inside the letters).

- **Strands.** One strand to a cell of a grid on the skin (2.2 CSS px for fur), present by the cell's hash and only where its root is inside the letters, thinning over a cell and a half at the edges. That is worked out once per heading and coat, into a strand map with a texel per cell: whether it grows a strand, how tall, where its root sits in the cell, and its tone. A strand bends along the comb: at height t it sits `lean × t²` from its root, so the tips lie over and the roots stand.
- **Layers.** Each pixel walks the coat's 28 layers from the tips down. At each layer it finds the strand whose root is under it (the pixel less the lean at that height) and takes it if it is close enough. Between two layers a strand is a capsule from one height to the next, so a strand laid well over is a streak, not a row of dots. Coverage is soft over a pixel and composited front to back, stopping once the pixel is covered. The skin shows where nothing covers it.
- **Comb.** A 96-column grid of leans, kept on the CPU and uploaded each frame. At rest a coat lies downwards, its direction turning gently across the letters, as a pelt's flow does. A pointer stroke lays the strands under it along its direction, along the whole segment it moved, so a fast stroke combs its path. The grid relaxes back to rest over `relax` (4 s). When the pointer is idle, a slow figure of eight combs the letters by itself. A little wind sways it.
- **Shading.** Kajiya and Kay's strand model, with the strand's tangent from its bend. Diffuse light goes by the sine of the angle to the light, plus a white highlight and a broader one tinted by the strand's colour (after Marschner's second lobe). Tone darkens towards the roots, as the coat shadows itself. Tufts of nearby strands share a tone, from value noise over seven cells.
- **Coats.** Fur is long, fine and lying over. Grass is sparser, thicker and upright, in the meadow's pigment colours. Moss is short, dense and velvety.

The coat grows in over `grow` (3 s): strands lengthen from stubble.

## Cost

1.00 ms per frame at 1080p on Dawn, and 2.52 ms in Chrome (2.43 to 2.96 over 5 loads): **Tier B**. Pixels too far from the letters for any strand to reach skip the layers, and each layer reads one texel of the strand map. Before the strand map, each layer sampled the letters and hashed its cell again, and Chrome read about 7 ms, near Tier B's limit.

## Pitfalls

- **A strand whose lean differs from its pixel's.** The cell is found from the lean at the pixel, not the strand's own, so a strand is clipped where it leaves its cell. Strands therefore share the smooth comb field and vary only in length and tone, not in direction.
- **Gaps between layers.** With a long lean, a strand moves more than its width between layers and reads as dots. The capsule between heights closes them.
- **Finding the same thing 28 times.** Each layer sampled the letters at its strand's root and hashed the cell again, and Chrome took about 7 ms a frame. Worked out once into a strand map, a texel per cell, it takes 2.5.
- **Pale straw.** The first fur was too light and too even, with bright highlights. It was darkened and given tufts.

## Safety

Flash `none`, pattern `none`, motion inside the caps: the strands move only where the pointer or the idle comb passes, and the wind sways them a little. The shimmer test passes every preset at the default and strong doses. Held, the coat is fully grown and still.

## When to use it

A playful or tactile hero heading: a pet, textile or outdoor brand. Keep it to a short word at heading size. Body text is too small for strands.

## References

- Jerome Lengyel, Emil Praun, Adam Finkelstein and Hugues Hoppe, "Real-Time Fur over Arbitrary Surfaces", I3D 2001: shells.
- James Kajiya and Timothy Kay, "Rendering Fur with Three Dimensional Textures", SIGGRAPH 1989: the strand lighting model.
- Stephen Marschner et al., "Light Scattering from Human Hair Fibers", SIGGRAPH 2003: the tinted second highlight.
