## How it works

The meadow (story 3.2) in flower (story 12.3). Everything about the grass is the meadow's: the same effect, built with whole flowers switched on (`meadowEffect` in `src/effects/meadow/index.ts`), and the wildflowers turned up from 0.35 to 0.85.

- **Drifts.** The grass field grows its wildflowers in drifts, each species its own (story 11.6, `src/gpu/grass/wildflowers.wgsl`): ox-eye daisies, buttercups, poppies and cornflowers. Only a flowering stem can carry a flower. Far off a head is a point of colour, and the far canopy is tinted where a drift is by the share of ground its heads cover.
- **Near heads drawn whole.** When the field places a head nearer than the near distance, it puts it in one of two small lists of its own, by distance, instead of the dots' (`nearList` in `src/gpu/grass/field.ts`). Each record is the head at its stem's tip, the stem's direction there, its size and its species, all after the wind and the pointer have bent the stem. The flower renderer (`src/gpu/flower/render.ts`) draws those whole from the daisy's, buttercup's, poppy's and cornflower's floral diagrams, turned along the stem's tip and scaled to the field's head size, with indirect draws: a tiny compute pass turns each list's count into each level of detail's instance count, so nothing is read back. A head of a species with fewer organs than the most leaves its other slots empty.
- **Two bands.** Heads drawn whole out to where one 5 cm across is about 4 px (at most 14 m); those within 2.2 times the nearest grass distance get the levels of detail their nearest needs, the rest those of that boundary.
- **The daisy and the cornflower** are composite heads, capitula: a ring of bracts, ray florets each one strap-like petal (21 for the daisy) or enlarged fringed funnels (8 for the cornflower), round a disc of florets packed as Vogel's golden-angle spiral, radius as the square root of the count inside.
- **Into the meadow's light and focus.** They draw in the grass pass, into its colour and distance targets and its depth, lit by the same sun and sky, and so share its depth of field.

## Cost

On an Apple M1 Max at 1080p: 3.19 ms a frame on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)), against the meadow's 2.53, and 8.06 ms in Chrome (7.87 to 8.25 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)), against its 6.21: **Tier C**, as the meadow. The whole heads are under a millisecond on Dawn: a small head's stamens, florets and bracts are not drawn (the receptacle shows their colour), and each species has its own lists, so no head draws another's organs. Before those, 10.2 ms.

## Pitfalls

- **A list as big as the field's.** The near heads first had a fifth list of the field's full 220,000 capacity, 10 MB for a few hundred heads. They have two of 4,096, after the four lists.
- **Heads floating off their stems.** Placing heads from the CPU twin of the field would have been a frame behind the GPU's wind, and blind to the pointer's trampling: the field lists them itself.
- **Faceted near heads.** One level of detail for every near head was either too coarse for the nearest or too costly for the rest: two bands.

## Safety

As the meadow's: flash `low`, pattern `none`; walking through is a zoom over the cap and is declared. The heads are small and sway with the grass, and add nothing the checks pick up.

## When to use it

A spring or summer hero, a garden centre's or a seed company's page, an outdoor brand.

## References

- Helmut Vogel, "A better way to construct the sunflower head", _Mathematical Biosciences_ (1979).
- Klemens Jahrmann and Michael Wimmer, "Responsive real-time grass rendering for general 3D scenes", I3D 2017: the blades the heads grow on.
- Takashi Ijiri et al., "Floral diagrams and inflorescences", SIGGRAPH 2005.
