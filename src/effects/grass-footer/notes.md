## How it works

The blade engine (stories 2.1 to 2.4, `src/gpu/grass/`), framed as a strip along the bottom of the page. The camera stands at the edge of a field, its eye a little below the tallest tips, looking level. The horizon is set low by shifting the lens rather than tilting the camera, so blades stay upright. Above the tallest blades the canvas is clear, and the page shows through.

Each frame, nothing kept from the last:

1. **Placement** (`field.wgsl`). A compute pass runs once per cell of a grid anchored to the ground, a blade's worth of ground each, over the patch the camera sees. A cell always grows the same blade, so nothing reshuffles. The root is jittered over the whole cell, so no grid shows, and density varies in soft patches.
2. **Clumps.** After Ghost of Tsushima, each blade takes the nearest of a jittered set of clump centres. Blades in a clump share a height scale and a facing, and lean away from its centre.
3. **Distance.** Far blades are dropped at random, more with distance, and the ones kept are widened, so a far field is fewer, wider blades with the same coverage.
4. **Culling.** Blades outside the view, and blades edge-on and too thin to see, are dropped.
5. **Wind** (`wind.wgsl`). Gust fronts travel across the field at the gust speed, so neighbours lean together and the gust reads as a wave. Under them is a steady lean with a slow veer. Each blade also flutters at its own natural frequency, faster for short blades, with its own phase, and by less the stiffer it is: as one over its frequency squared.
6. **The pointer** parts the near blades: those whose tips are above it and near it across the view bend away. A hand in the grass, not a hole through the field.
7. **Shape.** After Jahrmann and Wimmer, the tip goes where the forces put it. The curve's guide point follows from the tip, and both are rescaled about the root so the blade keeps its length.
8. **Lists.** Survivors are appended to one of three lists by distance, the bands' edges dithered so a change of detail never runs along a line, and each list's instance count in the indirect draw arguments is counted up with an atomic.

Then three indirect draws (`draw.wgsl`) pull the blades from the lists: 15, 7 and 3 vertices a blade, near to far. They draw into a 4x multisampled target with depth, over a soil ground that fades out before the far blades thin. Far blades narrower than a pixel are drawn a pixel wide, and cover only their true share of the pixel's samples; near ones are left to multisampling. The normals are tilted across each blade, so flat blades shade as if folded, and face the viewer, chosen once per blade.

The shading is story 2.6's (`grass-shade.wgsl`), shared with the meadow: colours from leaf pigments (`src/gpu/optics/leaf.ts`), diffuse light, light through the blades, a broad sheen, and canopy occlusion that darkens the roots. Stems carry seed heads; wildflowers are left to the meadow.

Only the rows the grass can reach are multisampled (`strip.ts`), then copied into the bottom of the scene.

## Cost

On an Apple M1 Max on Dawn ([docs/studies/epic-3.md](../../../docs/studies/epic-3.md)): 0.83 ms per frame at 1080p, with about 35,000 blades drawn from 170,000 cells. Placement is 0.15 ms of it. In Chrome, one 1920 × 1080 frame reads 2.07 ms ([browser-check.md](../../../docs/studies/browser-check.md)), most of it filling the near blades, which overlap. That is just over Tier A's 2 ms in Chrome, so the effect is Tier B by budget, provisional.

The cost follows the blade count. Density 0.25 costs 0.39 ms on Dawn, and 1 costs 1.11. The lawn costs 0.68 ms. Blade lists are 31 MB (48 bytes a blade, four lists of 160,000).

## Pitfalls

- **A camera in the grass sees blades sweep across the whole view.** Blades rooted between the eye and the bottom of the view rise past the lens. The field starts just before the bottom edge, as if the camera stood at its border.
- **Close up is a macro shot.** With the eye near the nearest blades, a few huge blades fill the strip. Standing back about 12 eye heights, the strip keeps its height on screen, but its blades are many and fine.
- **The page shows between the blades at the bottom.** Real grass shows soil there, hence the ground under the blades.
- **Multisampling the whole canvas is waste.** At DPR 2, 4x colour and depth over a full 1080p canvas are 160 MB, for a strip in its bottom half.
- **Several frames in one command buffer.** The draw arguments are reset by the compute pass itself. Reset by a buffer write, every frame in a cost study's command buffer started from the last one's counts.
- **Writing coverage costs early depth rejection.** The sample mask and `discard` cost about 15% of the blade pass in Chrome.
- **Bright blades against a dark page shimmer.** The strip is the family's worst case for the shimmer test (story 2.7): thin lit blades crossing a black page flip pixels between grass and page. Light through backlit blades, gusts and flutter are all held near the default at the strong end, so the intensity control hardly rises past it.

## Safety

Flash `low`: single transitions in single cells, far under the limit. Pattern `low` (0.09 of the area, under the 0.25 limit). Motion inside the caps up to the strong dose: at most 0.039 screen widths a second of drift and 0.03 zoom doublings. The shimmer test passes every preset, with the narrowest margin in the family: the meadow grass at the strong dose reads 20,000 of the 21,824 px allowed ([docs/studies/grass-safety.md](../../../docs/studies/grass-safety.md)). A held frame is a lull, with no gust.

## When to use it

A footer, the edge of a section, or the bottom of a spring or outdoor hero. Keep text off it: it is busy. SVG blades swaying with CSS are the honest fallback for a few dozen blades (story 3.8). They cannot clump, part around the pointer or carry light through the blades.

## References

- Eric Wohllaib, "Procedural Grass in _Ghost of Tsushima_", GDC 2021: clumps, rounded normals, blade LODs.
- Klemens Jahrmann and Michael Wimmer, "Responsive Real-Time Grass Rendering for General 3D Scenes", I3D 2017: the blade curve and its length.
- Tiago Sousa, "Vegetation Procedural Animation and Shading in Crysis", _GPU Gems 3_ (2007): the main bend plus detail flutter, which the wind's lean and flutter follow.
- [plan.md](../../../plan.md), stories 2.1 to 2.7 and 3.1.
