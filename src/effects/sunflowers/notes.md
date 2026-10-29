## How it works

Rows of sunflowers against a summer sky whose heads follow the pointer as young sunflowers follow the sun (story 12.4).

- **Heliotropism.** Atamian et al. (_Science_, 2016) found that a young sunflower's stem grows faster on its east side by day, turning the head west after the sun, and on its west side by night, turning it back to face the dawn; the cycle is set by its circadian clock. Turning by growth is slow, so here each head eases towards the pointer with a lag of its own (0.7 to 1.5 s, scaled by `lag`) and no faster than a stem can grow, 0.9 rad a second sped up for the page, about an axis between where it faces and where the light is, over the top when the two are opposite. When the pointer leaves, night falls, and the heads drift back to face the east (`turnHead` in `src/gpu/flower/heliotropism.ts`). The pointer is the sun, so a head that has turned to it is lit full on.
- **The head.** A capitulum 12 cm across, from the shared flower renderer (`SUNFLOWER` in `src/gpu/flower/diagram.ts`): 34 leafy bracts beneath, 34 ray florets, and 610 disc florets packed as Vogel's spiral, each the golden angle from the last at a radius growing as the square root of its number (story 4.4's phyllotaxis). Its parastichies, 34 and 55 spirals, are what the eye picks out close up.
- **The plant.** A stem 1.7 m tall swaying as a cantilever under its heavy head (story 11.5), with eleven heart-shaped leaves on long stalks up it, the golden angle round and smaller towards the top: the renderer's new stem leaves, which ride the bending stem.
- **The field.** Three staggered rows, 28 plants, the back ones a little taller, with a haze; a sky from a hazy horizon to a deep zenith, and the field below it running away into the haze.

## Cost

On an Apple M1 Max at 1080p: 2.25 ms a frame on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)) and 5.73 ms in Chrome (5.62 to 5.90 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)): **Tier B**, close to its 6 ms. At this distance a floret is under a pixel and a half, so the disc florets are not drawn and the receptacle shows the disc's colour; drawn, they were 3.8 ms on Dawn and 6.6 in Chrome.

## Pitfalls

- **Heads that flip.** Blending two facing directions passes through zero when they are opposite, and a head turning from west to east did that. It turns about an axis, over the top.
- **A seam at the horizon.** The field's colour started from a darker haze than the sky's, a line across the view.
- **Lollipops.** Without leaves the stems are sticks under their heads; the renderer grew stem leaves for them.

## Safety

Flash `none`, pattern `none`: the disc's spirals are dark on dark and too small to count at this distance, and the stems' vertical lines are too irregular. The heads turn locally, not as one field, and inside the motion caps.

## When to use it

A summer or harvest hero, a seed company's or farm shop's page, an interactive landing page where the visitor is the sun.

## References

- Hagop Atamian et al., "Circadian regulation of sunflower heliotropism, floral orientation, and pollinator visits", _Science_ (2016).
- Helmut Vogel, "A better way to construct the sunflower head", _Mathematical Biosciences_ (1979).
- Przemyslaw Prusinkiewicz and Aristid Lindenmayer, _The Algorithmic Beauty of Plants_ (1990), chapter 4: phyllotaxis.
