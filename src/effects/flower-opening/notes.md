## How it works

One flower, built from its floral diagram (story 11.2, `src/gpu/flower/diagram.ts`) with grown petals (story 11.1, `src/gpu/flower/petal.ts` and its twin `src/wgsl/petal.wgsl`). There is no compute and no state beyond the diagram's organs, written to a storage buffer once per flower.

- **The diagram.** Whorls of sepals, petals, stamens and carpels, each with its count and its turn from the whorl outside it (half a member's angle when they alternate, as a lily's two whorls of three tepals do), or a spiral placed by Vogel's model, each member the golden angle (137.5°) from the last, moving inwards and getting smaller: a rose's petals, a buttercup's or a poppy's stamens.
- **The petal.** A surface over (u, v), along and across. Its outline is a bump `u^a (1 - u)^b`, widest where it says, with a round or pointed tip, a claw at the base and a notch at the tip (a cherry blossom's). It cups across and curls along. Its edge ruffles because the margin grew more than the middle, after Liang and Mahadevan's lily. The excess length is taken up by a wave out of the surface, whose amplitude follows from the excess, A = λ √excess / π, and whose wavelength shortens as the excess grows. No excess, no ruffle; a poppy's crumpled petals are a large one.
- **Drawing.** Each organ is an instance of a 22 × 11 grid, pulled in the vertex shader. Normals come from the surface's own derivatives. It is drawn with 4x multisampling and depth, straight into the scene.
- **Opening** (story 11.4's model, in its simplest form). A petal opens because its inner face grows more than its outer one, so it bends outwards. Here its curl runs from wrapped round the bud to its own open curl, and it tilts from its bud angle to its open one, ring by ring from the outside in. Ruffles grow in as it opens.
- **Shading.** A petal colour with a throat at the base and faint veins, light through the petal from behind (tinted twice by the pigment, as the leaf plate passes it), a sky term, and gloss for the buttercup. Story 11.3's petal optics will replace these colours with pigments and surfaces.

## Cost

Not measured yet: it comes with Epic 12's cost study. About 1300 vertices an organ, so a poppy with its 89 stamens is about 120,000 vertices, with no compute.

## Pitfalls

- **A rose's petals pass through each other.** Petals in the middle of the spiral, half open, cut through their neighbours. A rose's inner petals curl in and its outer ones curl back, and the spiral now runs between the two, which fixed the heart of the flower. The rest is story 12.2's: petals that touch push each other apart.
- **Lilies hang if tilted past level.** Lily tepals open to a little past horizontal and recurve from there. Tilted to 100°, they hung like a fuchsia's.
- **Stamens outside the petals.** A poppy's stamens were first placed wider on the receptacle than its petals, and opened before them. The opening order is the diagram's, ring by ring, not by radius.

## Safety

Flash `low` (the buttercup and cherry blossom at most one transition in one cell), pattern `low` (a lily's six tepals, 0.20 of the area against 0.25), motion inside the caps up to the strong dose. Three things the checks found:

- **A turning flower is whole-field rotation.** At 0.06 turns a second it read 14° a second against a cap of 5. The spin is capped at 0.012 turns a second (4.3°), and its default is 0.008.
- **A lily filling the view is a rosette.** Six tepals with nearly full contrast against a dark ground read 0.26 of the area, over the limit. Framed to fill two thirds of the shorter side, it reads 0.20.
- **An opening rose is a zoom.** The rose's bloom is a filled disc that grows as it opens, and optical flow reads that as a zoom of 0.22 doublings a second against a cap of 0.1. It was not the spin (a turning spiral can look like it is expanding, but the zoom stayed with the spin off) and not the petals' flutter. The rose opens and closes at an eighth of the others' pace, about a minute, and measured across its whole cycle its zoom stays at or under 0.083.

A held frame is the moment the clock stood at, part way open, so it is never brighter than the flower plays.

## When to use it

A hero's centrepiece, a section divider that opens as it scrolls into view, a florist's or a spring page.

## References

- Takashi Ijiri, Shigeru Owada, Makoto Okabe and Takeo Igarashi, "Floral diagrams and inflorescences: interactive flower modeling using botanical structural constraints", SIGGRAPH 2005.
- Haiyi Liang and L. Mahadevan, "Growth, geometry, and mechanics of a blooming lily", _PNAS_ (2011).
- Eran Sharon et al., "Buckling cascades in free sheets", _Nature_ (2002): wavelengths shortening with growth towards an edge.
- Helmut Vogel, "A better way to construct the sunflower head", _Mathematical Biosciences_ (1979).
- Wouter van Doorn and Uulke van Meeteren, "Flower opening and closure: a review", _Journal of Experimental Botany_ (2003).
