# Safety

Earth Temple inherits The Hero's Journey's checks, unchanged: the WCAG 2.3.1 flash and red-flash analyser, the regular-pattern analyser after the ITC (Ofcom) guidance, whole-field motion caps from optical flow, red-capped colour, the start gate and held frames. Their rules, sources and limits are written up in [The Hero's Journey's docs/safety.md](../../herosjourney/docs/safety.md). Every effect and preset here runs through them in `npm test`, at the default and at the strong dose (0.7).

What this family has found so far:

- **A row of evenly spaced blades is a grating.** `hello` first rooted one blade in each slot along the strip. With tall blades (its `tall` preset) the pattern analyser read the row as stripes over its area limit. Rooting each blade anywhere across three slots broke the spacing up, and the preset reads `low` (0.15 of the area). The engine's field never had the problem: its roots are jittered over whole cells and its blades lean every way.
- **Blades lean from their roots, and optical flow reads that as a zoom.** A strong gust moves a strip's tips and not its bases: `grass-footer` read 0.12 zoom doublings a second until the strong end's gusts were lowered and the wind turned partly into the view.
- **The motion check cannot follow grass.** The meadow read almost nothing even while walking through the grass at 0.8 m/s, so its camera is held to the caps from its own motion (`tests/meadow.test.ts`), and walking is declared and gated.
- **Grass shimmers at the scale of a pixel.** Thin bright blades sliding across pixels flicker, below the flash analyser's cells. A shimmer test (`tests/shimmer.test.ts`) runs the flash analysis over 5 × 5 pixel regions. What it found: near blades must be out of focus; a short stiff blade must flutter less than a tall one; and bright blades over a dark page are the worst case, so the footer's intensity hardly rises past its default.
- **A view among the blades is a grating.** The nearest blades of a view from inside the grass are tall, near-vertical stripes; its held frame failed the pattern rule. The meadow's views are from above the grass.

The full study is [docs/studies/grass-safety.md](studies/grass-safety.md).

- **Held frames are lulls.** A paused grass effect draws at the default intensity or less, and with no gust, so the frame a paused page shows is still grass, not a field caught mid-gust.
