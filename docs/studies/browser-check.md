# Browser check

Every registered effect, loaded in Google Chrome 156.0.8078.48 (headless, this machine's GPU) on 2026-10-29 by `npm run browser-check`.

Views per effect: `hero-light` (1280 × 900), `hero-dark` (1280 × 900), `cards-dark` (1280 × 900), `band-light` (1280 × 900), `backdrop-dark` (1280 × 900), `phone-light` (390 × 844 at 2x), `phone-dark` (390 × 844 at 2x), `hud-1080p` (1920 × 1080). The layouts are the mock pages of the effect page; "light" and "dark" are the page tone of the stage.

- **Started** counts the views in which the effect got a canvas and drew more than a flat fill, with no fallback notice and no console error.
- **Animates** means two captures a second apart differ by more than dither in at least one view.
- **HUD** is what the performance HUD showed on a 1920 × 1080 canvas: frames per second, and the GPU time of one frame as the browser reports it (first pass start to last pass end), as the median of several page loads with the range beside it. The range is wide for the lightest effects: when there is little to draw the GPU idles, and the same page reads either near the timing floor or about twice that from one load to the next.

The HUD time is not the number the cost studies report. It is one frame measured alone, through Chrome's coarse timestamps, on a GPU that idles between frames, so it carries a floor and reads higher than the per-frame cost in `docs/studies/epic-*.md`. It is here because it is what a visitor's browser actually does. This check says nothing about how an effect looks: the screenshots do.

| Effect         | Started | Animates | HUD at 1080p                                |
| -------------- | ------: | -------- | ------------------------------------------- |
| grass-footer   |  8 of 8 | yes      | 60 fps, 2.07 ms (2.03 to 2.15 over 5 loads) |
| hello          |  8 of 8 | yes      | 60 fps, 0.37 ms (0.37 to 0.44 over 5 loads) |
| meadow         |  8 of 8 | yes      | 60 fps, 6.21 ms (6.01 to 6.30 over 5 loads) |
| lawn           |  8 of 8 | yes      | 60 fps, 3.87 ms (3.68 to 4.46 over 5 loads) |
| mowing         |  8 of 8 | yes      | 60 fps, 4.14 ms (4.02 to 5.31 over 5 loads) |
| grass-growth   |  8 of 8 | yes      | 60 fps, 5.21 ms (4.61 to 5.31 over 5 loads) |
| grass-edges    |  8 of 8 | yes      | 60 fps, 1.99 ms (1.86 to 2.54 over 5 loads) |
| fur-text       |  8 of 8 | yes      | 60 fps, 2.52 ms (2.43 to 2.96 over 5 loads) |
| flower-opening |  8 of 8 | yes      | 60 fps, 0.80 ms (0.67 to 1.13 over 5 loads) |

No view logged a console error.

The five Epic 3 rows after the first three were measured later the same day, by `npm run browser-check -- --effects … --hud-runs 5`, with the other views checked in a separate run (8 of 8 started, no console errors). Repeated runs on the same build moved by up to a millisecond either way, `grass-edges` reading anywhere from 0.6 to 2.0 ms, so these are a reading, not a constant.
