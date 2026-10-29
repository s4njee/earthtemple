## How it works

A rose opening from a tight bud, close up and slow: the flower model's hardest flower (story 12.2). Forty petals in a golden-angle spiral (Vogel), inside five sepals, drawn by the flower renderer the blooms share (`src/gpu/flower/render.ts`) from the rose's floral diagram (`ROSE` in `src/gpu/flower/diagram.ts`). The flower model's petals, colours and opening are the ones `flower-opening` uses (stories 11.1 to 11.5). What is new is how a spiral of forty cupped petals opens without any passing through another.

- **The bud is nested shells.** In a rose's bud each petal wraps the ones inside it. So each petal lies on its own sphere round a common centre on the axis, through its base: its midline on the sphere's meridian (a constant curl of its length over the sphere's radius) and its blade wrapped across at the sphere's curvature (a new `wrap` in the petal model: the cross-section an arc of a circle, its arc length kept, so a petal wider than its circle wraps round it). Shells round one centre never cross, and the spiral's petals move inwards and up, so each shell is inside the last. A petal too long for its shell is shorter in the bud and grows as it opens. The closed bud is stretched upwards, which keeps the shells nested (any affine map does), so it is taller than it is wide.
- **Opening is nested bowls.** As it opens each petal stays on a surface of revolution through its midline, a bowl that flattens and then turns back, wrapped across to that bowl's curvature, row by row: a parallel of radius ρ on a surface whose meridian leans t from the axis curves across by cos t / ρ (`bowlWrap` in `src/gpu/flower/opening.ts`; on a sphere it is 1 / R everywhere, so the bud and the bowls are one rule). Nested bowls do not cross either. A petal's own fixed cup could not do this: deep enough to read, it lifts the edges of the outer petals through the ones above.
- **Rolled margins.** A rose's petal edges roll back as it opens, which points its outer petals: the band outside 0.55 of the half-width bends back round an axis along the petal at a constant curvature, by half a turn at most, growing in from a third of the way up (`roll` in `src/gpu/flower/petal.ts`).
- **No ruffles in the bud.** Pressed between its neighbours a nested petal cannot ruffle; the edge's excess grows in only as it opens.
- **Colour.** Every rose petal has conical cells, velvet, and in the petal model they now also trap most of the light a flat face reflects white (Gorton and Vogelmann): a velvet red stays deep in the light where a flat one went pink. Five varieties from their pigments: a red of dense anthocyanin in a thin petal, pink, white, yellow and peach.

The test (`tests/rose.test.ts`, with `tests/nesting.ts`) samples every petal and counts its points on the outer side of a petal that opens before it, over that petal's surface. Before: 0.85 of the inner petals' points in the bud, and 0.12 once open. Now none in the bud and under half a percent through the opening, the deepest at the innermost two petals at the very middle of the open rose.

## Cost

On an Apple M1 Max at 1080p: 0.68 ms a frame on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)) and 1.52 ms in Chrome (1.49 to 1.57 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)): **Tier A**, though it was planned as B. Forty petals at the finer grids their rolled margins need, five sepals, the receptacle and a stem.

## Pitfalls

- **A bud of crossed petals.** With one bud curl for every petal, a long outer petal wrapped past the axis and through every petal inside it: 85% of the inner petals' points were outside an outer petal. The shells fixed the bud.
- **Ruffles through the next shell.** Shells are 0.14 mm apart; the edge's ruffle was 0.4 mm. In the bud, no ruffle.
- **A parabola is not a sphere.** The first wrap used the petal's cup, a parabola across: a rose petal is wider than its shell, and the parabola's edges stood 3 mm outside the sphere. The wrap keeps the arc length on a circle.
- **The cup is not the bowl.** Opening with a fixed cup crossed at 12% of the points; the bowl's curvature at the widest point cut it to 1.5%, and row by row to under half a percent.
- **Tips through the middle.** Leaning in with a curl of 0.9, the innermost petals' tips met beyond the axis and passed through each other; at 0.6 they stop short of it.
- **Blank first frames in shots.** A shot at 0 s renders no frame at all; ask for a time after the first.

## Safety

Flash `none` and pattern `none`. A rose opening is a filled disc that grows, which optical flow reads as a zoom: it opens over 64 s and closes over 40, as the `flower-opening` rose does, and stays under the zoom cap. Turning is capped at 0.012 turns a second (4.3°), default 0.006.

## When to use it

A florist's or a wedding page's hero, a Valentine's or anniversary page, a perfume launch; on scroll, a section that blooms as it is read.

## References

- Helmut Vogel, "A better way to construct the sunflower head", _Mathematical Biosciences_ (1979).
- Stephen Timoshenko, "Analysis of bi-metal thermostats", _JOSA_ (1925): the bilayer opening.
- Haiyi Liang and L. Mahadevan, "Growth, geometry, and mechanics of a blooming lily", _PNAS_ (2011): edges that grow more than the middle.
- Heather Gorton and Thomas Vogelmann, "Effects of epidermal cell shape and pigmentation on optical properties of _Antirrhinum_ petals at visible and ultraviolet wavelengths", _Plant Physiology_ (1996): conical cells and the petal's look.
- Takashi Ijiri et al., "Floral diagrams and inflorescences", SIGGRAPH 2005.
