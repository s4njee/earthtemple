## How it works

A Dutch bulb field in coloured beds running away to the horizon (story 12.6).

- **Beds.** The field is cut into beds 2.6 m across with bare furrows between, each bed one cultivar: red, yellow, pink, purple, white or orange, each from its pigments (story 11.3). A bed's cultivar and its furrow's width are hashed from its number (`bedAt`, and its twin `bed_at` in `field.wgsl`, hash for hash), so the near tulips and the far field agree.
- **Near tulips drawn whole.** Bulbs are planted on a jittered grid 19 cm apart in the beds out to 8 m, each a whole tulip from the shared flower renderer (`TULIP` in `src/gpu/flower/diagram.ts`): two whorls of three broad cupped tepals, incurved at their tips, six dark stamens, a pistil, and two broad leaves arching from the ground. They are drawn in three bands by distance, each with the levels of detail its nearest needs. Each sways on its stem in the grass engine's gusting wind (`groundWind`, story 2.4), the head tilting with the stem's tip.
- **The far field.** Past the drawn tulips the ground takes its bed's colour, as heads seen at a grazing angle cover it, patchy where bulbs failed, into the haze; the drawn tulips shrink away into it over the last 2.5 m, as its colour comes up.
- **Evening.** Tulips open in the warmth and close in the cool (thermonasty). In the evening the light goes over a minute and a half and the field closes, each tulip a little behind or ahead of the next, then opens again in the morning.

## Cost

On an Apple M1 Max at 1080p: 4.06 ms a frame on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)) and 8.77 ms in Chrome (8.60 to 8.99 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)): **Tier C**, over the B it was planned for. First measured at 24 ms on Dawn, 16 million vertices with three leaves a tulip at the finest grids. The renderer's savings (one-sided normals, small parts culled), bulbs 19 cm apart drawn whole out to 8 m, two leaves and a tolerance of 2 px brought it down; the rest is the count of tulips, about 1,500 in view. Fewer, or a lower resolution, would make it B.

## Pitfalls

- **Beds are a grating.** Stripes of colour across the view are a regular pattern. A bed's cultivar is drawn at random, so beds of one colour run together and the stripes' widths vary.
- **A WGSL precedence error.** `a * b ^ c * d` does not parse in WGSL: mixed operators need parentheses. The shader failed to compile and the held first frame was black, which the still-frame test caught.
- **Orange reds.** A red tulip with as much carotenoid as anthocyanin reads orange; a red has little.

## Safety

Flash `none`, pattern `none`: with random cultivars the beds do not repeat regularly. Gusts stay inside the motion caps.

## When to use it

A spring hero, a travel page for the Netherlands, a bulb or garden retailer.

## References

- Wouter van Doorn and Uulke van Meeteren, "Flower opening and closure: a review", _Journal of Experimental Botany_ (2003): tulips' thermonasty.
- Klemens Jahrmann and Michael Wimmer, "Responsive real-time grass rendering for general 3D scenes", I3D 2017: the wind.
