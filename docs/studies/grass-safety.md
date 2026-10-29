# Grass and the safety rules (story 2.10)

Grass is many thin, moving, high-contrast lines: whole-field motion when it sways, travelling bands when a gust crosses it, a grating when it is dense and near, and flicker when a thin blade slides across a pixel. Each case was measured with The Hero's Journey's analysers and with the shimmer test (story 2.7), at the default and at the strong dose (0.7). The limits found apply to Epic 3.

## Swaying fields: whole-field motion

| Effect, preset              | Rotation, °/s | Zoom, doublings/s | Drift, widths/s (peak) |
| --------------------------- | ------------: | ----------------: | ---------------------: |
| `grass-footer`, default     |          1.07 |             0.004 |          0.022 (0.050) |
| `grass-footer`, strong      |          1.55 |            -0.023 |          0.039 (0.064) |
| `grass-footer`, golden hour |         -1.85 |             0.030 |          0.030 (0.063) |
| `meadow`, every preset      |    under 0.08 |      under 0.0015 |                  0.001 |
| Caps                        |             5 |               0.1 |                   0.05 |

- **Blades lean from their roots,** so a gust moves a strip's tops and not its bases, and optical flow reads that as a zoom. Before the strong end was lowered, the footer read 0.12 zoom doublings a second, and then 0.058 widths a second of drift when the wind blew straight across the view. Wind partly into the view, and gusts near the default's strength at the strong end, keep it inside.
- **The motion check cannot follow grass.** The meadow reads almost nothing in every preset, including walking through the grass at 0.8 m/s. A field of fine, similar blades gives block matching too little to lock onto, as faint snow did for Snow Temple. So the meadow's own camera is checked against the caps instead (`tests/meadow.test.ts`): walking towards a 9 m focus at 0.8 m/s is 0.13 zoom doublings a second, over the 0.1 cap, and `walk through` is declared and gated. The sideways drift of 0.12 m/s is 0.017 widths a second.

## Gust waves: travelling bands

Pattern `none` in every preset of both effects. A gust's sheen and lean travel as a soft value-noise front, not as a set of regular bands, and nothing in the field repeats.

## Dense thin blades: a grating?

- **A row of evenly spaced blades is one.** `hello`'s blades, rooted one to a slot, read as stripes over the area limit when tall. Rooted anywhere across three slots, they read `low`.
- **A view among the blades is one.** With the meadow's eye at 0.62 m, among 0.6 m grass at golden hour, the nearest blades are tall, blurred, nearly vertical stripes. The held frame read `high` (0.046 of the area counted at the analyser's coarser scale), and the near blades swept the view faster than the motion caps allow. The golden hour is framed from just above the grass instead (eye 0.95 m), and reads `none`. A view from inside the grass needs either a much softer foreground or a gate, and the held-frame rule (every preset's held frame passes) rules out the gate.
- **The engine's field is not one.** Roots jittered over whole cells and blades leaning every way read `none` everywhere, and the field's placement has no autocorrelation peak above 0.2 at any offset (`tests/grass.test.ts`).

## Shimmer: flicker at the scale of a pixel

The flash analyser's 24 × 14 cells average shimmer away. The shimmer test (`tests/shimmer.test.ts`) runs the same analysis over 5 × 5 pixel regions, at four starting moments, and asks that the area flashing more than three times a second stays under the flash rule's area limit (21,824 display pixels). What it found:

| Case                                                    | Flashing area, px | What fixed it                                                                                       |
| ------------------------------------------------------- | ----------------: | --------------------------------------------------------------------------------------------------- |
| Meadow, a view among the blades, without depth of field |           151,200 | Depth of field: near blades out of focus, as in a photograph (17,600). Then the higher camera.      |
| Footer, golden hour, strong dose                        |            56,400 | Less light through the blades, and a dimmer sheen, against the dark page (13,600)                   |
| Footer, lawn, after the normals faced the viewer        |            47,200 | Flutter scaled by stiffness: a short blade sways as one over its frequency squared (0)              |
| Footer, meadow grass, strong dose                       |            33,200 | Gusts and flutter near the default's at the strong end (20,000: the narrowest margin in the family) |

Two lessons. **Brightness against a dark page is the hazard, not the motion alone:** the lawn passed while its blades were lit wrongly and three times dimmer, and failed as soon as they were lit correctly. And **a check can pass because nothing was drawn:** a shader that failed to compile left the field empty, and the shimmer test passed it. The grass tests, which compare the shader with its CPU twin, caught that.

## Mown stripes

Not measured: mowing is story 3.4, in M2. Stripes are a grating by construction, so their contrast will be held under the pattern step, and full contrast gated.

## Limits for Epic 3

- Strips over a dark page keep the strong dose's gusts and flutter near the default's: the footer's intensity hardly rises past it.
- Views from inside the grass need their nearest blades out of focus, and a softer foreground than depth of field alone gives; until then, frame from just above the grass.
- Camera motion through grass is held from the camera's own transform, never from optical flow.
- Every grass preset runs through the shimmer test, at the default and the strong dose.
