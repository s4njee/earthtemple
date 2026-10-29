## How it works

One flower, built from its floral diagram (story 11.2, `src/gpu/flower/diagram.ts`) with grown petals (story 11.1, `src/gpu/flower/petal.ts` and its twin `src/wgsl/petal.wgsl`), coloured by its pigments (11.3), opening by differential growth (11.4) on a stem that sways (11.5). There is no compute: the diagram's organs go to a storage buffer once per flower and size on screen, and each frame only the opening, the sway and the light change. Nine flowers: lily, buttercup, cherry blossom, poppy, rose, camellia, _Hibiscus trionum_, morning glory and daffodil.

- **The diagram.** Whorls of sepals, petals, stamens and carpels, each with its count and its turn from the whorl outside it (half a member's angle when they alternate, as a lily's two whorls of three tepals do), or a spiral placed by Vogel's model, each member the golden angle (137.5°) from the last, moving inwards and getting smaller: a rose's petals, a buttercup's or a poppy's stamens. A whorl can be fused into a tube, a surface of revolution whose rim widens as it opens, with the members' free lobes on the rim: a morning glory is one funnel flaring into its limb, a daffodil's corona a trumpet ruffled at the rim. Every flower stands on a receptacle, a low dome, so nothing shows through its middle.
- **The petal.** A surface over (u, v), along and across. Its outline is a bump `u^a (1 - u)^b`, widest where it says, with a round or pointed tip, a claw at the base and a notch at the tip (a cherry blossom's). It cups across and curls along. Its edge ruffles because the margin grew more than the middle, after Liang and Mahadevan's lily. The excess length is taken up by a wave out of the surface, whose amplitude follows from the excess, A = λ √excess / π, and whose wavelength shortens as the excess grows. No excess, no ruffle; a poppy's crumpled petals are a large one.
- **Drawing.** Each organ is an instance of a grid pulled in the vertex shader, its size an override constant: the coarsest of five, from 48 × 24 down to 5 × 3, whose chord error at the organ's length on screen is within a pixel. The rows are spaced as u = s²(3 − 2s), closer at the base and the tip, where a round petal's width runs as √(1 − u) and no evenly spaced grid can follow it. Tubes and the receptacle get a grid fine round the axis. Normals come from the surface's own derivatives. It is drawn with 4x multisampling and depth, straight into the scene.
- **Opening** (story 11.4, `src/gpu/flower/opening.ts`). A petal is a bilayer, and a strain difference Δε between its faces bends it by Timoshenko's κ = 3Δε / 2h. A 4 cm petal 0.3 mm thick needs only a 1% difference to turn through 2 rad, from wrapped round the bud to curled back. Its blade curls and its basal hinge tilts it, each from its bud strain to its open one, ring by ring from the outside in. Ruffles grow in as it opens.
- **Colour** (story 11.3, `src/gpu/optics/petal.ts`). The leaf's plate model with petal pigments: anthocyanins, whose band moves from red in acid through violet to blue as the vacuole's pH rises and further when a metal ion holds them; carotenoids; betalains; chlorophyll; and flavonols, which only a bee sees, dark in the ultraviolet. Reflectance and transmittance both come from it, so light through a backlit petal is the petal's own. A morning glory turns from purple in the bud to blue open, as its vacuole goes from pH 6.6 to 7.7 (Yoshida et al.).
- **Surface.** Velvet where the petal has conical cells (a red rose's): a longer path through the pigment, no gloss, and a soft brightening at grazing views. Gloss where it has a flat epidermis over an air gap (the buttercup's): a sharp, bright highlight. A diffraction grating of cuticle striations at _Hibiscus trionum_'s dark eye, which diffracts its first order at λ = d |sin θout − sin θin| into bands of colour near the mirror direction.
- **Stem** (story 11.5, `src/gpu/flower/stem.ts`). A cantilever under its head, swaying as a damped oscillator at f = (1/2π)√(k/m), with k = 3EI/L³ and the head's mass plus 33/140 of the stem's: a poppy about 0.4 Hz, a cherry blossom's short pedicel many times faster. A gusty breeze pushes the head by its drag, the stem bends as a cantilever under a tip load, and the head tilts with the stem's tip.

## Cost

On an Apple M1 Max on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)): 0.2 to 0.5 ms a frame at 1080p for every flower, and 0.8 ms in Chrome (0.67 to 1.13 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)): **Tier A**. With the levels of detail, a poppy with its 89 stamens is about 40,000 vertices at 1080p, its petals finely gridded and its stamens 5 × 3. These were measured while other work on the machine was using the GPU, so they are upper bounds.

## Pitfalls

- **A rose's petals pass through each other.** Petals in the middle of the spiral, half open, cut through their neighbours. A rose's inner petals curl in and its outer ones curl back, and the spiral now runs between the two, which fixed the heart of the flower. The rest is story 12.2's: petals that touch push each other apart.
- **Lilies hang if tilted past level.** Lily tepals open to a little past horizontal and recurve from there. Tilted to 100°, they hung like a fuchsia's.
- **A grid cannot draw a round tip.** At first even a 48 × 24 grid missed the surface by several pixels on a large petal, because a round tip's width has an infinite slope at the end. Rows spaced closer at both ends made the 48 × 24 grid unnecessary for any petal up to 200 px long.
- **A hole in the middle.** Petals rise from a ring a few millimetres out, and through a clawed petal's narrow base the page showed. The receptacle fills it.
- **Lobes on a rim meet it at a point.** A morning glory's lobes, drawn as petals on its funnel's rim, floated free of it. Its limb is fused nearly to the edge, so it is one flaring tube waved into its five petals.
- **Stamens outside the petals.** A poppy's stamens were first placed wider on the receptacle than its petals, and opened before them. The opening order is the diagram's, ring by ring, not by radius.

## Safety

Flash `low` (one transition in one cell over four seconds) and pattern `none` at its default, the poppy. The lily is declared over the pattern rule and starts behind the gate. Motion inside the caps up to the strong dose. What the checks found:

- **A turning flower is whole-field rotation.** At 0.06 turns a second it read 14° a second against a cap of 5. The spin is capped at 0.012 turns a second (4.3°), and its default is 0.008.
- **A lily is a pattern.** Filling the view, its six tepals and six stamens are a rosette of eight pairs, and once its stem sways the picture counts as moving, held to 0.25 of the central field rather than 0.4. Framed smaller, it passed at first, but fully open its three lower tepals hang as bright bars on the dark ground, a grating at 0.98 contrast covering 0.41. It is declared and gated, and the default flower is the poppy. The daffodil's six tepals are framed smaller for the same reason, at 0.21 of 0.25.
- **The breeze is light air.** Sway grows as the wind's square, and a swaying rosette is a moving pattern, so the breeze is 0.18 m/s at the default and 0.3 at the strong dose.
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
