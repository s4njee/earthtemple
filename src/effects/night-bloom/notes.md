## How it works

A moonflower (_Ipomoea alba_) unfurling at dusk (story 12.5), from the shared flower renderer.

- **The flower.** A long narrow tube flaring at its end into a broad flat limb 14 cm across (`MOONFLOWER` in `src/gpu/flower/diagram.ts`), a few stamens and the style at the throat, five sepals, and two heart-shaped leaves on the vine below it. The limb is folded into five by greener midpetaline bands, where the fused petals' midribs run to the rim (the look's `bands`).
- **The twisted bud.** In the bud the limb is furled, its five pleats twisted round the axis as a spire. A tube gains `twist`, how far its rim is turned round the axis in the bud, and `folds`, how deep the pleats are: twisting a smooth surface of revolution changes nothing you can see, so the pleats are what show the twist. As it opens it untwists, the pleats fall out and the limb flares.
- **Fast enough to watch.** It opens over 40 s, holds open, closes at dawn over 24 and rests.
- **Moonlight and dark-adapted eyes.** It is lit by a cool moon to one side and a dark blue sky, and the tail shows it as dark-adapted eyes see it: Moon Temple's night vision (its story 5.6, now in `src/gpu/post/night.ts`), after Thompson, Shirley and Ferwerda. By moonlight the rods take over: colour drains, blue holds up and red falls away (the Purkinje shift), and acuity drops. So the white limb glows, with bloom, and the leaves sink into a grey dark. `starlit` goes further; `true colour` turns it off.

## Cost

On an Apple M1 Max at 1080p: 0.76 ms a frame on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)) and 1.31 ms in Chrome (1.21 to 1.41 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)), night vision included: **Tier A**.

## Pitfalls

- **Stamens as spokes.** Every organ took the bud's curl, 1.6 rad, so the moonflower's 10 cm stamens bent into five white paddles round the bud. Only petals and sepals wrap the bud now; stamens and carpels keep their own curl.
- **A twist that does not show.** See the twisted bud: the pleats carry it.
- **The flower at the foot of the frame.** It faces up and out, so the camera aims at the middle of its open limb, out along its axis, not at its receptacle.

## Safety

Flash `none`, pattern `none`. A funnel flaring open is a growing disc, which optical flow reads as a zoom; over 40 s it stays under the cap. The glow is bloom over a slow change, not a flash.

## When to use it

A dark hero, an evening event's page, a fragrance or candle brand.

## References

- William Thompson, Peter Shirley and James Ferwerda, "A spatial post-processing algorithm for images of night scenes", _Journal of Graphics Tools_ (2002).
- Wouter van Doorn and Uulke van Meeteren, "Flower opening and closure: a review", _Journal of Experimental Botany_ (2003).
