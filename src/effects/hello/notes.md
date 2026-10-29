## How it works

One instanced draw of up to 4000 flat blades (`blades.wgsl`) into the HDR scene, then the shared tail with its tonemap off, over the page. A blade is a triangle strip of four rows and a tip, rooted somewhere along the bottom of the view and bent along a parabola. Everything about it is a pure function of its index and the time: where it stands, how tall it is, its lean, and its sway. There is no state, so a held frame and a poster are the same grass.

The wind is a slow wave travelling along the strip, so blades lean together in groups, plus each blade's own small sway at its own rate. `dose` ("intensity") sets how hard it blows. A blade every 3 CSS pixels at density 1.

## Cost

On an Apple M1 Max on Dawn ([docs/studies/epic-1.md](../../../docs/studies/epic-1.md)): 0.35 ms per frame at 1080p, the output pass included. In Chrome, one frame on a 1920 × 1080 canvas reads 0.47 ms (`npm run browser-check`): Tier A on this machine. 1.0 kB gzipped of its own, 25 kB with the shared chunks.

## Pitfalls

- **Evenly spaced blades are a grating.** Rooted one to a slot, the blades of the `tall` preset made a row of regular stripes, and the pattern check read it over the limit. Each blade is now rooted anywhere across three slots, and `tall` reads `low`.
- **Flat.** A 2D strip has no depth, no clumps and no light through its blades. `grass-footer` is the same strip from the blade engine.

## Safety

Flash `none`, pattern `none` (`tall`: `low`), motion inside the caps up to the strong dose.

## When to use it

As the template for a new effect. For grass on a page, `grass-footer`.

## References

- Earth Temple [plan.md](../../../plan.md), story 1.2.
