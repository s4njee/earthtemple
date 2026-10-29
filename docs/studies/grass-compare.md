# A grass strip four ways (story 3.8)

Measured 2026-10-29 by `node experiments/grass-compare.mjs`, in headless Chrome at 1280 × 720 on this machine (an Apple M1 Max), 4 s per row after 2.5 s to settle. Main thread and style come from Chrome's Performance metrics; compositor and GPU process are the busy time of those threads in a trace. All in milliseconds of work per second of wall time: 1000 would be a thread that is never idle. The strip is the bottom quarter of the view.

| Method                                  | Blades | fps | Main thread (ms/s) | of which style | Compositor (ms/s) | GPU process (ms/s) |
| --------------------------------------- | -----: | --: | -----------------: | -------------: | ----------------: | -----------------: |
| nothing (the page alone)                |      0 |  70 |                7.1 |            0.0 |               6.6 |               11.3 |
| CSS gradient layers, masked and sheared |      — |  61 |               16.0 |            4.1 |              10.6 |               18.3 |
| SVG paths, CSS rotation                 |    100 |  60 |               38.0 |           11.2 |              27.5 |               38.4 |
| Canvas 2D                               |    100 |  60 |               20.3 |            1.7 |              13.1 |               34.0 |
| SVG paths, CSS rotation                 |    400 |  60 |              118.8 |           39.7 |              76.1 |              142.2 |
| Canvas 2D                               |    400 |  60 |               24.8 |            1.9 |              17.0 |               52.0 |
| SVG paths, CSS rotation                 |   1600 |  60 |              473.0 |          165.1 |             331.7 |              557.6 |
| Canvas 2D                               |   1600 |  60 |               47.2 |            2.0 |              15.9 |              110.9 |
| SVG paths, CSS rotation                 |   6400 |  19 |              723.4 |          278.4 |             858.1 |             1108.8 |
| Canvas 2D                               |   6400 |  60 |              134.0 |            2.3 |              17.5 |              351.7 |
| SVG paths, CSS rotation                 |  25600 |  19 |              912.2 |            0.0 |             919.1 |               96.1 |
| Canvas 2D                               |  25600 |  48 |              415.6 |            2.3 |              12.5 |             1006.3 |
| WebGPU `grass-footer`                   |  10796 |  60 |               31.7 |            0.0 |              15.5 |               55.5 |
| WebGPU `grass-footer`                   |  42801 |  60 |               30.6 |            0.0 |              13.5 |               49.8 |
| WebGPU `grass-footer`                   |  85869 |  60 |               31.0 |            0.0 |              13.0 |               49.7 |
| WebGPU `grass-footer`                   | 107451 |  60 |               30.3 |            0.0 |              13.6 |               50.2 |

WebGPU's blade count is what `grass-footer` drew in the last frame at that density (its near, middle and far bands together), placed, culled and bent in compute.

## What it shows

- **CSS only** is the cheapest moving grass (16 ms/s of main thread, most of it the page's own), but it is one silhouette sheared as a whole: no blade moves on its own, nothing parts around the pointer, and its masked conic stripes are a grating, so their contrast would need holding under the pattern step. It is a fallback, not grass.
- **SVG with CSS rotations** costs about 0.3 ms of main thread per blade per second. Rotating an SVG child is painted on the main thread, not composited. It is fine to about 400 blades (12% of a core). It costs half a core at 1600 and drops to 18 fps by 6400. A few hundred blades are a sparse fringe, not a lawn.
- **Canvas 2D** holds 60 fps to 6400 blades, at 134 ms/s of main thread and 350 ms/s in the GPU process for its rasterising. At 25,600 it drops to 48 fps, with the GPU process saturated. It is the right choice for a strip of a few thousand flat blades, with no light through them, no depth and no multisampling.
- **WebGPU `grass-footer`** draws 11,000 to 107,000 blades at a flat 30 ms/s of main thread, the same at every density, because placement, culling and bending happen in compute and the draws are indirect. The GPU process line undercounts it: Dawn records its work on threads this trace does not group, so its GPU time is the study's per-frame timing in `docs/studies/epic-3.md` instead.

So the crossover is in the low thousands: below about 400 blades, SVG is simplest; up to a few thousand, Canvas 2D; past that, or wherever the grass needs light, depth, wind fields or trampling, WebGPU. `grass-footer` keeps its Tier B, and `hello` (a few thousand blades, one instanced draw) is the WebGPU strip at Canvas 2D's count.
