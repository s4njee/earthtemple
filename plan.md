# Earth Temple — WebGPU grass, plants and ground research site

A research site that implements, measures and documents the living ground and the ground under it: realistic grass first, then leaves and flowers in the wind, things that grow (roots, vines, moss, trees), sand and soil (dunes, raked gravel, drying mud) and rock and terrain. It asks one question of each: **would you actually ship this on a website?** Every effect gets a live demo, readable source, a write-up and a practicality scorecard. A sibling of [Fire Temple](../firetemple/plan.md), [Water Temple](../watertemple/plan.md), [Storm Temple](../stormtemple/plan.md) and [Snow Temple](../snowtemple/plan.md), on the same page structure and the shared temple core. It is §4.4 (Wind and growth) of the holofx [research list](../research.md), widened to the ground the grass grows from.

Realistic grass is a solved problem in games, by a recipe that is now well documented (Ghost of Tsushima, Jahrmann and Wimmer, Horizon Zero Dawn). Its realism is not one technique but a stack of small, cheap ones:

- blades as curved, tapering geometry, not cards;
- blades in clumps that share a height and a lean, not scattered evenly;
- colour that varies blade to blade and runs dark at the roots;
- light through the blades when the sun is behind them;
- a waxy sheen along each blade, which is what shows the wind's waves crossing a field;
- wind that arrives in gusts and travels across the field, rather than every blade swaying in step;
- blades that stay at least a pixel wide in the distance, so the field does not shimmer.

Each needs a lot of blades placed, culled and drawn on the GPU each frame. Browsers could not do that until WebGPU gave them compute and indirect draws. This family's first job is to bring the recipe to the web and find out how much of it a page can afford.

The rest of the family follows the same rule as the other temples: start from the mechanism, and the look follows.

- **Falling leaves.** A falling leaf flutters or tumbles depending on its size and weight, as a falling plate does.
- **Seed heads.** A sunflower head is florets placed at the golden angle. A dandelion seed flies on a vortex ring.
- **Roots, veins and trees.** These grow by competing for space (space colonisation).
- **Dunes.** They form when slabs of sand hop downwind and avalanche.
- **Drying mud.** It cracks at right angles, and relaxes towards hexagons over many wet and dry cycles.
- **Mountains.** Their shapes come from water carrying sediment downhill.

Flowers get the second half of the plan (Epics 11 to 18), on the same rule. A petal ruffles because its edge grows faster than its middle. It opens because its inner face grows faster than its outer one. It looks velvety because its surface cells are cones. Floral design follows it, as people made it: Morris's repeats, Mucha's borders, block prints, crests, stained glass, origami and embroidery, each read from how it was made.

## Goals

- **Make grass that reads as real**, judged against photographs:
  - a lawn, a meadow at midday, a meadow backlit at golden hour, and dry grass;
  - each shown side by side with the effect set to match;
  - an ablation that shows which parts of the recipe matter and what each costs.
- **Cover the main kinds of earth visual, each from its mechanism:**
  - **grass:** fields, lawns that the cursor parts and treads, mowing, grass growing along page elements, and fur on text;
  - **leaves and flowers:** leaves that fall by their aerodynamics, petals, flowers that open by phyllotaxis, a dandelion clock that can be blown, foliage with dappled light, and a meadow through the seasons;
  - **growing things:** roots, vines, moss and trees grown by space colonisation, revealed by scroll;
  - **sand and soil:** dunes, raked gravel, falling sand, an hourglass, and drying mud cracks;
  - **rock and terrain:** eroded mountains, a geological cross-section to scroll through, and stone surfaces.
- **Ship effects shaped like website parts:**
  - a meadow hero for an outdoor brand, and a grass strip along the footer that parts around the pointer;
  - grass growing on the headline and cards for spring, and falling leaves gathering on the cards for autumn;
  - a lawn the cursor mows as a progress widget, and fur text;
  - roots growing down a sustainability page as it scrolls, and a section that scrolls down through rock strata;
  - a zen-garden widget, and an hourglass loader.
  - flowers opening as a loader or as the page scrolls, a bouquet picker, floral text, and a wreath;
  - floral repeats, borders, plates, prints and crests, made the way their traditions made them.
- **Say plainly when SVG or CSS does the job.** A strip of SVG blades swaying with CSS is a footer, and the baseline to beat (3.8).
- **Keep motion safe:**
  - a whole field swaying is whole-field motion, and wind waves crossing a lawn are travelling bands;
  - thin blades alias into shimmer, which is flicker;
  - mown stripes, raked gravel and rock strata are stripes;
  - a sunflower head is a spiral of many arms.

  Every effect runs through The Hero's Journey's flash, pattern and motion checks.

- **Build the reusable parts once,** shaped to move into `@mk7s/hologpu-temple-core`:
  - the blade engine (placement, culling, indirect drawing);
  - the ground wind field and blade physics;
  - the leaf optics;
  - leaf aerodynamics;
  - space colonisation;
  - the erosion and sand models.

## Non-goals

- **Forests.** A tree is in scope (5.5), and so is a foliage edge (4.7). A forest to the horizon is a game's open world, not a page effect.
- **Scanned assets.** Everything is procedural, so the bundle stays small and every blade is the shader's own. Reference photographs are for judging, never textures.
- **Botanical accuracy.** L-systems and space colonisation are used because they give the right shapes cheaply. The notes cite the models and claim no botany.
- **Granular simulation of sand grains** (DEM or the material point method). Sand here is height fields and cellular automata, and no story depends on grains.
- **Effects over live page pixels.** A canvas cannot read the page (Fire Temple's [backdrop strategy](../firetemple/docs/backdrop-strategy.md)). Grass on the page grows from element geometry (Fire Temple's `dom-rects.ts`), as Snow Temple's snow settles.
- **Earthquakes and screen shake.** Shaking the page is a motion hazard and never a good idea. No story builds it.
- **Flags, banners and cloth.** These are wind, but not earth. They stay with hologpu's unbuilt `cloth` stretch.
- **Sound.**

## Decisions

These are defaults chosen so work can start. Each is cheap to revisit before Epic 1 is finished.

| Decision         | Default                                                                                                                                                                             | Why                                                                                                                                                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation       | Snow Temple's shell (from The Hero's Journey, via Moon Temple, Storm Temple, The Bazaar and Fire Temple) on `@mk7s/hologpu-temple-core`                                             | It is the newest copy. It has the flash, pattern and motion checks, the start gate, OKLab colour, the study harness and the browser check, plus several pieces this family reuses: the height fields on element edges, the footprint field, the arrival-time growth reveal and the font distance field. |
| Build tooling    | Vite + TypeScript (strict), with WGSL `#include` resolved per effect at build time                                                                                                  | Same as every temple, so shader text never reaches the first load.                                                                                                                                                                                                                                      |
| Rendering API    | Raw WebGPU + WGSL, thin helpers                                                                                                                                                     | The research subject is WebGPU itself.                                                                                                                                                                                                                                                                  |
| Colour pipeline  | Linear HDR `rgba16float` scene → bloom → tonemap → sRGB, OKLab for colour operations. The grass pass is drawn with 4× MSAA and resolved before the tail                             | Backlit blades and sunlit sheen are brighter than paper white. Blades a pixel wide need multisampling to stay still.                                                                                                                                                                                    |
| Blade geometry   | Generated by compute into storage buffers each frame, culled and compacted, and drawn with `drawIndirect` by vertex pulling. No vertex buffers, tessellation or mesh shaders        | WebGPU has neither tessellation nor mesh shaders, so this is how a browser places and draws a million blades. Moon Temple's sprite bokeh (its 3.5) already draws indirectly from compute.                                                                                                               |
| Blade motion     | Stateless wind by default: a pure function of position and time. Stateful bending only where something touches the grass, kept in a trample field per area of ground, not per blade | Per-blade state costs memory for every blade drawn. A trample field costs memory per area, as Snow Temple's footprints do, and only where it is needed.                                                                                                                                                 |
| Intensity        | Hero's Journey's shared `dose` control, labelled "intensity" in the controls: wind strength, gust frequency, leaf count and growth speed together. Default 0.35                     | One control a page can turn down, and the analysers' contract already holds up to its strong end. The key stays `dose` so the contract matches across families.                                                                                                                                         |
| Safety checks    | Flash, red-flash, pattern and motion checks over every effect and preset, at the default and at the strong dose, in `npm test`, plus a shimmer test for every grass preset (2.7)    | Grass shimmer is flicker, a swaying field is whole-field motion, and stripes and spiral seed heads are patterns.                                                                                                                                                                                        |
| Realism check    | Reference photographs licensed CC0 or CC BY (Wikimedia Commons), credited in `docs/realism/`, or the user's own. Each grass and plant effect is shown beside them                   | Realism is the family's hard case, as the light page was Snow Temple's. A side by side is a judgement, not a metric, so it is made in the open, with the pictures.                                                                                                                                      |
| Accent           | Terracotta clay (`#e38b6d` dark, `#a3462b` light). The tier colours are checked against it in story 1.1                                                                             | No colour was named. Grass green would be taken for Tier A, and avocado is Temple of Time's. Clay is the earth's own colour. It sits near Fire Temple's amber, so check it beside Fire Temple; moss (`#7bc47f`) is the alternative if the tier colours move. Revisit if the user names one.             |
| Neutrals         | Warm, soil-toned greys, light and dark equally                                                                                                                                      | Grass reads differently on a light page and a dark one, and both are tested.                                                                                                                                                                                                                            |
| CSS prefix, port | `et-`, dev port 5490, launch config `earthtemple`                                                                                                                                   | Unused by the other families. 5373, 5390, 5410 to 5480 and 5441 are taken by the other holofx projects.                                                                                                                                                                                                 |
| Hosting          | Cloudflare Pages (classic) project `earthtemple`, direct upload                                                                                                                     | No server needed. Create the project with `wrangler pages project create --force`, or wrangler converts the repo to Workers.                                                                                                                                                                            |
| No-WebGPU        | A poster per effect, and an SVG or CSS version where one is honest (story 9.4)                                                                                                      | SVG grass is a real fallback for a footer strip. It is not one for a meadow.                                                                                                                                                                                                                            |

## Carried over from the other temples

These findings shape this plan, so they need not be rediscovered.

- **Indirect draws from compute** (Moon Temple 3.5). Sprites appended in compute with an atomic counter and drawn with `drawIndirect`: the same shape as culled blades.
- **The wind field** (Snow Temple 2.1, 2.2). Curl-noise swirl, with gust fronts that sweep across. Here it moves over the ground.
- **Height fields on page shapes** (Snow Temple 3.1). Rows of `r32float` columns along each element's top edge, keyed by element, resampled on resize. Grass on the page (3.5) holds blade length where snow held depth.
- **The footprint field** (Snow Temple 3.4). A height field per area of ground that the pointer presses into and that recovers. The trample field (2.5) and raked sand (6.2) use the same structure.
- **Grow once, reveal by arrival** (Storm Temple 4.1, Snow Temple 4.1). Record when each cell or segment was reached, then reveal by threshold, so growth can be scrubbed by scroll for free. Roots, vines, moss and cracks use it.
- **The font distance field** (Temple of Time 1.6, also in Snow Temple). Fur on text and grass on headings grow from it.
- **Lattices fail the pattern rule** (Temple of Time). Halftone dots were a lattice to the analyser. Grass placed on a grid, or a tile of grass repeated across a field, is a lattice too. Placement must not repeat where it shows. Thresholding or posterising hardens soft stripes into gratings.
- **A rosette is a regular pattern** (The Hero's Journey M1, Snow Temple 4.4). Six or more light-dark pairs about a centre fail the pattern rule at a discernible step. A daisy is a rosette, and a sunflower head is 34 and 55 spiral arms.
- **Parallax breaks up whole-field motion** (Snow Temple 2.1). Things at one depth moving together read as whole-field drift, and things at many depths do not. A field swaying in step is the bad case, and gusts and depth are the cure.
- **Optical flow cannot see sparse, faint particles** (Snow Temple 2.4). Falling leaves, petals and seeds are checked against the motion caps from the effect's own transform as well.
- **Driving into a scene is vection at walking pace** (Snow Temple 2.4). A camera moving through a meadow is the same zoom, and is capped or gated.
- **Near things are out of focus** (Snow Temple 2.1). The nearest blades and leaves are large and fast. Drawn sharp, they trip the flash check. A thin-lens blur fixes it, and is how photographs show them anyway.
- **Glitter is flicker** (Fire Temple `flicker.wgsl`, Snow Temple 6.4). Dew glints and dappled light are built from band-limited signals with a capped rate.
- **A scene that does not change is drawn once** (Snow Temple 4.2). Sky, distant terrain and the soil between blades are cached per size.
- **Half-float writes truncate on Apple GPUs** (Fire Temple 5.6). Anything that accumulates small amounts (trampling, sand, erosion, moss) is stored in `r32float`.
- **Uniforms written between passes in one command buffer all arrive with the last value** (Moon Temple). Multi-step simulations keep per-step values in a buffer.
- **CI's software Vulkan crashes on a texture read after a workgroup barrier** (Snow Temple, Mesa 25.2's lavapipe). Compute shaders read textures before their first barrier.
- **Scratch work needs a home.** Long sweeps and probes go in `experiments/`, outside test, typecheck and lint.

## Findings so far

- **A row of evenly spaced blades is a grating.** Blades rooted one to a slot along a strip read as regular stripes to the pattern analyser once they were tall. Roots jittered over a wider span, or over whole cells as the engine's are, break it up.
- **Stand back from the grass.** With the eye close to the nearest blades, a few huge blades fill the strip. Twelve eye heights back, the strip keeps its height on screen, but its blades are many and fine: a long lens on a meadow's edge. Blades rooted between the eye and the bottom of the view sweep across the whole picture, so the field starts just before the bottom edge.
- **Multisample only what is drawn.** WebGPU's sample counts are 1 or 4. Over a whole canvas at DPR 2, 4x colour and depth are 160 MB, for grass in its bottom half.
- **Coverage tricks cost early depth rejection.** Writing `sample_mask` or discarding costs about 15% of the blade pass. Near blades, which multisampling covers without help, draw without them.
- **Multisampled thin geometry needs centroid interpolation.** A pixel centre just outside a blade extrapolates its attributes, and `pow()` of the negative result is NaN, drawn as white specks. It showed in headless Chrome 156 and not in Chrome 152 on the same GPU.
- **Reset per-frame counters in the command buffer, not by a buffer write.** A write lands before the whole command buffer, so several frames encoded in one (a cost study) each started from the last one's counts and drew too many blades. This is Moon Temple's finding about uniforms, again.
- **The cost is the near blades' fill.** About 35,000 blades cost 0.15 ms to place and 0.83 ms a frame on Dawn, but 2.4 ms in Chrome, most of it the near blades, which are big and overlap. That makes the footer Tier B in Chrome; sorting the near list front to back is the next thing to try.
- **Translucency is golden hour's look, and canopy occlusion is depth.** Switched off one at a time, these two take the most from the picture, and cost nothing. Then aerial perspective, which makes the horizon, and the clouds' moving shadows. Clumps, colour variation, dry blades, rounded normals and sheen each add a little.
- **An ablation is a test.** Translucency first did nothing, which was a bug: normals taken from the triangles' winding pointed away from the viewer, so backlit blades were lit by reflection. Chosen per pixel or per vertex instead, edge-on blades shimmered. They face the viewer, chosen once per blade.
- **Grass shimmers below the flash analyser's cells.** Run over 5 × 5 pixel regions, the flash analysis finds thin bright blades flickering where the coarse cells see nothing. Near blades must be out of focus (151,200 px of shimmer without depth of field in a view among them), stiff short blades must sway less, and bright blades over a dark page are the worst case.
- **The motion check cannot follow grass, and reads leaning blades as a zoom.** Walking through the meadow read a zoom of 0.001, so camera motion is held from the camera's own transform. A strip leaning in a strong gust read 0.12 zoom doublings a second, because its tips move and its roots do not.
- **A view among the blades is a grating.** Its nearest blades are tall, near-vertical stripes the pattern rule counts. Meadows are framed from just above the grass.
- **A strip of grass must reach the horizon.** Grass lower than the eye rises towards it with distance: cut at the nearest tallest blade, the far field was missing.
- **Focus where a photographer would.** Most of an eye-level view is nearer than the middle distance; a far focus blurred nearly all of it.
- **Beside photographs, the render is one species in tame light.** Real meadows mix grasses and forbs, each with its own colour and seed head; dry fields are mostly feathery panicles; a low sun floods the frame with glare and haze. Those, not the blades, are what still give the render away.
- **Several trample steps in one command buffer see only the last one's brushes.** They share one uniform buffer, so all a frame's brushes go into one step, and a mower's brush is a whole pass along its row.
- **Mown stripes need nothing painted, but laid grass lies further over than wind bends it.** At the wind's lean the stripes barely showed; at 1.2 of the blade's height they read as a striped lawn, and swap as the view turns.
- **Fur by shells is a lookup problem.** Re-deriving each strand at every layer cost Chrome 7 ms; a strand map made once per heading took it to 2.5.
- **SVG grass stops at a few hundred blades, Canvas 2D at a few thousand.** Past that, or wherever grass needs light and depth, WebGPU (story 3.8).
- **The meadow is Tier C at full density, Tier B at half.** 6.2 ms in Chrome at midday, 7.7 at golden hour, 4.8 at half density; on Dawn 2.1 and 3.4 ms. Depth of field is 1.4 ms of golden hour's cost, and is skipped where nothing blurs by 2 px.

## Overlaps and who owns what

| Nearby work                                                     | Where                           | Earth Temple's part                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `foliage-sway`, `falling-leaves`: pixel-art sprites in the wind | The Eightfold Path              | Realistic grass geometry and leaf aerodynamics. The pixel versions stay The Eightfold Path's, and 4.2 compares them.                 |
| `cloud-shadows`: an equalised tiling noise                      | The Eightfold Path              | Used for the meadow's cloud shadows (2.6), with credit.                                                                              |
| `falling-sand`, `sandpile`, `erosion`, `terrain` (planned)      | hologpu                         | Built here properly (6.3, 7.1, 7.2). If hologpu builds them first they are used as they are; either way they meet in the core (9.6). |
| Shallow water, wet sand on the shoreline                        | Water Temple                    | Not rebuilt. Mud's wet look and puddles use Water Temple's optics.                                                                   |
| Wildfire on terrain (unbuilt 8.8)                               | Fire Temple                     | 7.1's eroded terrain can be handed to it.                                                                                            |
| Fur, shag and velvet                                            | Temple of Time (its 5.5)        | Shell-and-strand fur is here (3.6). Temple of Time keeps flat textile surfaces, and named this family as fur's home.                 |
| `crack` in ice (unbuilt 5.2), the stroke renderer               | Snow Temple, Storm Temple       | Mud cracks come from shrinkage, not impact, a different mechanism. Both use the stroke renderer and the arrival reveal.              |
| `dust-in-light`, `dust-motes`                                   | Moon Temple, The Eightfold Path | Pollen in the meadow uses Moon Temple's energy-conserving point renderer.                                                            |
| Snow on page edges, footprints                                  | Snow Temple                     | Reused as structures for grass on edges and trampling. Snow on grass is not this family's.                                           |
| `cloth`, `ribbons` (unbuilt)                                    | hologpu                         | Not here (non-goals).                                                                                                                |

## Practicality tiers

Every effect is tagged with a tier. Budgets are starting targets, to be validated in Epic 10.

| Tier            | Meaning                                             | Shape                                                                              | GPU budget @1080p                   |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------- |
| **A** Drop-in   | Safe as ambient decoration, including mobile        | One or two passes, no compute, or a few thousand instances: a strip of blades      | ≤ 2 ms on integrated GPU            |
| **B** Feature   | Hero sections and interactive set pieces            | Compute placement and culling, up to a few hundred thousand blades, a height field | ≤ 6 ms on integrated GPU            |
| **C** Showpiece | Dedicated page or landing experience, desktop-first | A million blades at eye level, erosion running live, full-screen growth            | ≤ 12 ms on discrete / Apple Silicon |

Budgets include the HDR tail and MSAA resolve. Grass studies report blades drawn and blades culled beside milliseconds. Effects that keep state report its memory.

## Architecture sketch

```
earthtemple/
  index.html
  vite.config.ts
  src/
    main.ts            bootstrap: one shared GPU session, mounts an effect
    gpu/               device, canvas, frame loop, shaders, uniforms, targets, passes, post/
                       (bloom, tonemap, colour stage), dom-rects, pointer, scroll, safety/
                       (dose, pattern, motion, colour caps, gate), text/ and pile/ (from
                       Snow Temple), plus
                       grass/ (blade model, placement and clumps, culling, LOD, indirect draws),
                       wind/ (ground wind field, gusts, trample field, blade physics),
                       optics/ (leaf reflectance and transmittance, sheen, canopy occlusion),
                       leaf/ (fluttering and tumbling aerodynamics),
                       plant/ (space colonisation, phyllotaxis),
                       sand/ (dune slabs, block automaton, raking),
                       erosion/ (hydraulic and thermal) and crack/ (shrinkage cracks)
    wgsl/              shared chunks: hash, noise, sdf, oklab, plus blade, wind, leaf-optics,
                       shell and strata
    effects/<id>/      meta.ts (eager), index.ts + *.wgsl (lazy chunk), notes.md, poster.webp
    shell/             app frame, gallery, effect page, contexts, controls, notes, scorecard, HUD
    lib/               the library entry: mount an effect on a caller's canvas
  tests/               vitest on Dawn's Node bindings: real WebGPU, no browser
                       (flash.ts, pattern.ts and motion.ts run over every effect and preset)
  experiments/         scratch sweeps and probes; not part of the test run
  docs/                research output: support matrix delta, cost studies, realism/ (reference
                       photographs, credits and side-by-sides), findings
```

The effect contract is Snow Temple's, unchanged, `dose` included, so effects and shell code move between the families. Effects that grow on the page read element rectangles through the context, as Snow Temple's settling snow does.

## Definition of done (per effect story)

1. **Budget.** It runs inside its tier budget on the reference devices, with the numbers recorded. Until the device matrix exists (10.2), the only reference device is the development machine, an M1 Max. It is measured per frame on Dawn and as one frame in Chrome, and gets the lowest tier whose budget neither number exceeds. An A or B label is provisional until 10.2, and the scorecard says so.
2. **Parameters.** They are exposed through the schema with `dose` honoured, and there are at least two presets.
3. **Lifecycle.** It handles resize, DPR changes, device loss, offscreen pause and `prefers-reduced-motion`. The held frame shows a calm moment: the wind at a lull, never mid-gust. Grass on the page survives a resize and a scroll without tearing.
4. **Flash, red flash, pattern and motion.** It stays under all four at its defaults and at the strong dose. Every preset that goes over is declared and starts behind the gate. Grass presets also pass the shimmer test (2.7) at many frame phases.
5. **State.** Where it keeps state (trampling, raked sand, moss, erosion), the state recovers or decays when it should, and nothing is left after resize, pause or a parameter change.
6. **Realism.** For grass and plants, it is shown beside its reference photographs in `docs/realism/`, and the notes say what still gives it away.
7. **Contexts.** It is shown in at least one realistic web context, over a dark and a light page and at phone size, and its screenshots have been looked at.
8. **Notes.** `notes.md` is written: how it works and what the mechanism is, cost, pitfalls, safety, when to use it, and references. Where an SVG or CSS version exists, the notes say how close it gets.
9. **Release.** The scorecard is filled in and the fallback poster captured.

## Milestones

| Milestone                 | Scope                         | Proves                                                                            |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------------------- |
| **M0** Vertical slice     | Epic 1, stories 2.1–2.4, 3.1  | Tooling → blades placed, culled and drawn from compute → wind → the drop-in strip |
| **M1** Realistic grass    | Rest of Epic 2, 3.2           | Shading, anti-aliasing and distance, judged against photographs: the meadow       |
| **M2** Grass on the page  | Rest of Epic 3                | Lawns, mowing, grass on page elements and fur text, against SVG                   |
| **M3** Leaves and flowers | Epic 4                        | Aerodynamics, phyllotaxis and leaf colour as page parts                           |
| **M4** Growing things     | Epic 5                        | Space colonisation revealed by scroll                                             |
| **M5** The ground         | Epics 6 and 7                 | Sand, cracks, erosion and strata                                                  |
| **M6** On the page        | Epic 8, stories 9.1–9.5, 10.2 | Web-native usefulness, on more than one device                                    |
| **M7** Release            | Rest of Epics 9 and 10        | Published findings, shared pieces moved into the core                             |
| **M8** The flower model   | Epic 11                       | Petals grown, not painted: geometry, floral diagrams, optics, opening, wind       |
| **M9** Blooms             | Epic 12                       | Single flowers opening, and the meadow with wildflowers in it                     |
| **M10** Floral design     | Epic 13                       | Repeats, borders, plates, prints, crests and glass from how they were made        |
| **M11** Made by hand      | Epic 14                       | Folded, cut, pressed and stitched flowers                                         |
| **M12** Flowers on page   | Epic 15                       | Loaders, cursors, text, wreaths, petal bursts, bouquets, dividers                 |
| **M13** Flower science    | Epic 16                       | Bee vision, pollinators, samaras, a flower clock, and flowers' safety cases       |
| **M14** Floral pages      | Epic 17                       | A florist, a wedding, a perfume launch, a garden's scroll story, a greeting       |
| **M15** Flowers released  | Epic 18                       | Flower realism, design and cost studies, SVG against WebGPU, into the core        |

Grass comes first and gets the most care. M4 and M5 depend only on Epic 1, so either can run alongside M1 to M3. M8 depends on Epic 2 (the blade engine and the wind) and the leaf optics; Epic 4's flowers (4.4, 4.6) wait for it. M10 and M11 need only the fold library and the stroke renderer, so they can run alongside M8 and M9.

Story format: `ID Title [tier] (size)`. Sizes: S ≈ a day or less, M ≈ a few days, L ≈ a week or more.

---

## Epic 1 — Foundation and tooling

- [x] **1.1 Scaffold** (S) — Snow Temple's committed tree copied (`git archive HEAD`). Its effects and its cold-only code (snow, frost and ice shading, the Reiter automaton) are removed. The pile rows, the footprint field, the arrival-time reveal, the text field, the fold library (flowers are dihedral), the palettes and the safety checks stay. The `sn-` prefix is renamed `et-`; watch template literals such as `` `--sn-${string}` ``. Terracotta accent and soil-toned neutrals, with the tier colours checked against it. Dev port 5490, launch config `earthtemple`. `dose` is labelled "intensity". The inherited modules' story numbers are marked as their family's.

  _Done from Snow Temple's commit 52c321d. Removed: its ten effects, the snow, frost, ice and Reiter code, the snow piles (3.5 copies Snow Temple's edge rows back when it needs them), its studies, experiments and standalone demo page. `sn-` is now `et-`, port 5490, launch config `earthtemple`. Terracotta accent on warm, soil-toned neutrals in both themes; the tier colours (green, violet, amber) stay clear of it, and `tests/contrast.test.ts` passes. `dose` is labelled "intensity"._

- [x] **1.2 `hello`** [A] (S) — the smallest effect: a strip of a few thousand blades in one instanced pass with no compute, swaying in a stateless wind, with `dose` wired from the start.

  _`hello`: up to 4000 flat 2D blades, a pure function of index and time, in one instanced draw. 0.35 ms on Dawn, 0.5 to 0.9 ms in Chrome: Tier A. Rooted one to a slot, the `tall` preset's blades were a row of evenly spaced stripes, which the pattern check read over its limit; rooted across three slots, it reads `low`._

- [x] **1.3 Repository and CI** (S) — its own git repository (`s4njee/earthtemple`, created private and made public on the user's word, since private repositories cannot run Actions on this account). The CI workflow runs on software Vulkan (lint, format, typecheck, tests, build) and is green once.

  _Public repository `s4njee/earthtemple`, created private and made public on the user's word. M0 and M1 went in as one commit (b586a27)._

- [x] **1.4 Deploy** (S) — Cloudflare Pages project `earthtemple` (classic, created with `--force`), and an `npm run deploy` that builds, checks the bundle and uploads `dist`.

  _Live at <https://earthtemple.pages.dev>, deployed from b586a27 (classic Pages project, created with `--force`)._

- [ ] **1.5 Posters, catalogue and the holofx site** (S) — posters from held frames, `catalogue.json`, and Earth Temple in the holofx site's dropdown, lab and effect pages.

  _Posters (16 and 71 kB) and `catalogue.json` done. `grass-footer` is listed as a demo, not ready, because it needs compute. Still to do: the holofx site._

- [x] **1.6 Support matrix delta** (S) — what this family leans on beyond Fire Temple's [support matrix](../firetemple/docs/support-matrix.md):
  - `drawIndirect` from buffers written in compute, and the optional `indirect-first-instance` feature;
  - storage buffers read in the vertex stage (vertex pulling);
  - `maxStorageBufferBindingSize` and `maxBufferSize`, for a million blades;
  - 4× MSAA on `rgba16float` with alpha-to-coverage;
  - atomics for append counters;
  - `subgroups` where offered, for compacting culled blades.

  _[docs/support-matrix.md](docs/support-matrix.md), Chrome 152 on this Mac: `drawIndirect` from counts written in the same frame's compute pass works, `indirect-first-instance` and `subgroups` are offered but not needed, and storage buffers read in the vertex stage work. 4x multisampled `rgba16float` with depth works, but over a whole canvas at DPR 2 it is 160 MB, so the grass multisamples only its strip. Writing `sample_mask` (or discarding) costs about 15% of the blade pass by losing early depth rejection._

## Epic 2 — Blades

The engine behind every grass effect, and the part that has to be right. Ghost of Tsushima's recipe, Jahrmann and Wimmer's physics, and Horizon Zero Dawn's GPU placement, rebuilt for WebGPU and measured.

- [x] **2.1 Blade model** [—] (M) — `src/gpu/grass/blade.{ts,wgsl}`. Each blade is a quadratic Bézier curve after Jahrmann and Wimmer:
  - a root, a guide point and a tip, a facing direction, and a length that is kept as it bends;
  - a width that tapers to the tip, with pointed, rounded or split tips;
  - a slight twist, and a fold along the midrib, so the cross-section is a shallow V with two normals;
  - 15, 7 or 3 vertices by distance, as Ghost of Tsushima uses.

  A species table sets the rest: fine lawn, tall meadow grass with seed heads, tussock, reeds and dry grass. Tested: a blade's length is kept within 1% however it bends, and no blade passes under the ground.

  _`src/gpu/grass/blade.ts` and `src/wgsl/blade.wgsl`. The tip goes where the forces put it, the guide follows from the tip, and both are rescaled about the root twice, so the blade keeps its length within 0.7% for any sideways bend up to three heights. Rescaling about the root also keeps the whole curve above the ground. Four species (lawn, meadow, tussock, dry), with colours picked by eye until 2.6. The midrib fold is in the shading (rounded normals), not the geometry. Seed heads wait for 3.2. A tip pushed straight down is outside what the estimate handles (36% long); no force here does that, and 2.5's physics will have to._

- [x] **2.2 Placement and clumping** [—] (M) — compute places blades per ground tile from density, height and species maps:
  - **No grid.** Placement is jittered with blue noise, because a grid is a lattice the pattern rule counts.
  - **Clumps.** Blades are grouped in Voronoi clumps (Ghost of Tsushima). Blades in a clump share a height and a facing, and lean towards or away from the clump's centre.
  - **Variety.** A fraction of blades are dry or broken. The grass thins and shortens at paths and edges.
  - **Stability.** A world position hashes to the same blades every frame, so nothing reshuffles as the view moves.

  Tested: no tile repeats within the view (by autocorrelation), and placement is stable under camera motion.

  _`src/gpu/grass/field.wgsl`, with a CPU twin (`place.ts`) and twins of the shader hashes (`src/gpu/hash.ts`). One cell per blade at the species' full density, anchored to the ground; the root is jittered over the whole cell and density is thinned by rejection in soft patches, so a blade stays put at any density. Voronoi clumps share a height scale and a facing, and blades lean away from the clump's centre. There are no density, height or species maps yet, only one species per field. Tested: no autocorrelation peak above 0.2 at any offset, and the same blades from the same ground when the view moves._

- [x] **2.3 Culling, LOD and indirect drawing** [—] (M) — compute culls blades:
  - outside the frustum;
  - beyond their distance band;
  - edge-on and thinner than a pixel.

  Survivors are compacted into per-LOD lists with atomic counters, which write the `drawIndirect` arguments. Vertices are pulled from storage. Measured: blades per millisecond, and the count at which this beats one instanced draw with no compute. Tested: the indirect count equals the CPU's count for a known scene.

  _Culling by a sphere against the view, by distance (blades dropped at random and the rest widened past `fade`) and edge-on below 0.04 px. Survivors go to three lists by distance with an atomic append that also counts the indirect arguments; a clamp keeps counts within the lists. The arguments are reset by the compute pass itself: reset by a buffer write, every frame in a command buffer holding several (a cost study's) started from the last one's counts. Near blades draw without thickening or a sample mask, since 4x multisampling covers them; far blades are thickened to a pixel and cover their true share of its samples. All varyings are centroid-interpolated: otherwise a pixel centre just outside a thin blade extrapolates them, and pow() of a negative made NaN specks in Chrome 156 but not in 152. Tested: the GPU draws the same blades as its CPU twin, in the same lists, within a handful of f32 edge cases. 0.15 ms of placement for about 35,000 blades from 170,000 cells at 1080p. Not measured yet: the count at which this beats one instanced draw with no compute, which 3.8 covers._

- [x] **2.4 Wind** [—] (M) — `src/gpu/wind/`. Snow Temple's gust field, carried over and laid on the ground:
  - **Gust fronts** travel across the field. The waves seen crossing a meadow are blades bent together showing their sheen.
  - **A slow base lean** sits under the gusts.
  - **Flutter** gives each blade its own frequency, set by its length and stiffness.

  The wind is stateless, a pure function of position and time, so it stores nothing. It is compared with Sousa's Crysis vegetation bending (main bend plus detail). Tested: neighbouring blades move together and distant ones do not, and no blade moves faster than its natural frequency allows.

  _`src/wgsl/wind.wgsl` and its twin `src/gpu/wind/wind.ts`: a value-noise gust field carried along the wind, a steady lean with a slow veer, and flutter at each blade's natural frequency (shorter blades faster) with its own phase. The structure is Sousa's main bend plus detail; no side-by-side with it was built. Tested: blades 6 cm apart move together (correlation over 0.85) and 9 m apart do not, and no tip moves faster than its flutter and the passing gusts allow._

- [x] **2.5 Trampling and blade physics** [—] (M) — Jahrmann and Wimmer's forces (gravity, recovery towards rest, wind, collision), where something touches the grass. The bend is kept in a trample field per area of ground, after Snow Temple's footprint field, rather than per blade. Each cell holds a bend direction and amount, which recovers over seconds at the grass's stiffness. The pointer and tracked page elements are the colliders. Tested: trampled grass recovers to exactly rest, a field pressed and left decays to nothing, and nothing is left after a pause.

  _`src/gpu/wind/trample.{ts,wgsl}`, with a CPU twin: a window of cells (in the `meadow`, 256 × 256 at 6 cm) holding each cell's bend, pressed by up to four brushes along their motion or out from their centres, recovering as an overdamped spring (exp(-dt / tau), tau 2.5 s), snapped to exactly zero below a thousandth of a height. Addressed modulo its size, so it follows the camera without copying. The field reads it bilinearly at each root. Tested: the shader matches its twin; pressed grass recovers without overshoot to exactly zero; a pause changes nothing; a pressed cell stays put on the ground as the window moves. The pointer is the only collider so far: page elements resting on grass are 3.5's. The full Jahrmann and Wimmer forces (gravity, recovery, collision per blade) are not built: per-area recovery is what a page needs._

- [x] **2.6 Shading** [—] (L) — what makes grass real, each term switchable for 2.9's ablation:
  - **Leaf optics.** Reflectance and transmittance colours come from a PROSPECT-style leaf model of chlorophyll, carotenoids, water and dry matter. Young, mature and dry blades lie along a few physical parameters rather than hand-picked greens.
  - **Translucency.** A blade with the sun behind it glows with the light through it, attenuated by its thickness. This is the main reason a backlit meadow at golden hour looks real.
  - **Sheen.** A specular lobe from the waxy cuticle, stretched along the blade and with Fresnel. It is what the wind's waves show.
  - **Rounded normals** across each blade's width (Ghost of Tsushima), so flat geometry shades like a folded blade.
  - **Canopy occlusion.** Light falls off with depth into the canopy by the blade density (Beer–Lambert), so the roots are dark. It is cheaper than per-blade shadow maps, and better.
  - **Shadows.** A sun shadow map for the ground and large objects, and cloud shadows sweeping across (The Eightfold Path's equalised noise).
  - **Ground and sky.** Sky ambient from above, the soil showing between sparse blades, and aerial perspective in the distance.

  _`src/gpu/optics/leaf.ts` (tested: energy kept at every wavelength, a green leaf reflects 14% at 550 nm and 6% in the red, yellowing then browning as chlorophyll goes) and `src/gpu/grass/grass-shade.wgsl`, shared by the blades and the far ground. The leaf model is a plate model after PROSPECT, with its own Gaussian fits for the pigments' absorption (PROSPECT's measured coefficients are not to hand), integrated against the CIE functions to colours. Diffuse, translucency, a broad Kajiya-Kay sheen with Fresnel (faded on edge-on and on sub-4-pixel blades, where it glinted), rounded normals, Beer-Lambert canopy occlusion at the leaf area index, cloud shadows from the sky's own clouds, sky light and aerial perspective. Seed heads on stems; wildflowers as heads drawn from a fourth list. Each term is a flag for 2.9's ablation. Not built: the sun shadow map, since no scene here has large objects to cast one. Normals face the viewer, chosen once per blade at its root: by the winding, backlit blades were lit by reflection and translucency did nothing; per pixel or per vertex, edge-on blades shimmered._

- [x] **2.7 Anti-aliasing and shimmer** [—] (M) — thin blades alias, and swaying makes them shimmer. That is flicker to the flash analyser and a moving grating to the pattern analyser. The fixes:
  - 4× MSAA, with alpha-to-coverage for the tips;
  - blades thickened to at least a pixel in the distance, with opacity scaled to their true coverage (Ghost of Tsushima's view-space thickening);
  - LOD changes by thinning blades out, never by popping.

  A shimmer test runs every grass preset with a still camera and moving wind. It checks flash at many frame phases, and that no region's luminance alternates faster than three times a second above the flash threshold.

  _`tests/shimmer.test.ts`: the flash analysis over 5 × 5 pixel regions, at four frame phases, at the default and the strong dose, for every grass preset. Near blades are drawn without thickening or a sample mask, far ones thickened to a pixel with their true coverage; every varying centroid-interpolated; LOD bands dithered. What it found: a view among the blades without depth of field shimmered over seven times the limit; a short stiff blade must sway less (flutter as one over frequency squared); bright blades over a dark page are the worst case. Alpha-to-coverage is not used: a sample mask chosen by a per-pixel hash does the same with the colour kept premultiplied. See [docs/studies/grass-safety.md](docs/studies/grass-safety.md)._

- [x] **2.8 Distance and the horizon** [—] (M) — beyond the blades, grass continues as shells (Lengyel's shell texturing), then as a textured ground. That ground's colour and sheen are fitted to the near field's statistics, so the three meet without a seam. Blade budgets per tier are set here.

  _Beyond the blades' reach (26 to 34 m), the ground is the canopy seen from afar: the blade shading averaged over pseudo-blades leaning with the wind (`ground.wgsl`), so it meets the blades by construction and its sheen moves with the gusts. Blades thin as (fade / d)^2 and widen to keep coverage. Shells (`shells.wgsl`, Lengyel's) are built and cost 0.19 ms more, but add nothing visible at eye level, where the slices are seen edge-on; seen from above (the lawn, 3.3) they add a little texture to the thin far band at the top of the view for 0.7 ms more, which is not worth it, so the canopy stays the default there too. A hazed hedgerow along the horizon gives the field an edge. Blade budgets: about 35,000 for the footer, 75,000 for the full meadow, about half that for Tier B. The cell grid is bounded by the view's width at the blades' reach; most of its 1.4 million cells are rejected past the fade, and a coarser grid there is the next saving._

- [x] **2.9 Realism study** [—] (M) — `docs/studies/grass-realism.md`, the family's central study:
  - **Photographs and matches.** Reference photographs (CC0 or CC BY, credited) of a lawn, a meadow at midday, a backlit meadow at golden hour, and dry grass. The engine is set to match each, and the two are shown side by side.
  - **The ablation.** One at a time, the study turns off:
    - clumping;
    - colour variation;
    - dry blades;
    - translucency;
    - sheen;
    - rounded normals;
    - canopy occlusion;
    - gusts;
    - anti-aliasing.

    For each, it records what the cost was and how much the look lost, with screenshots.

  - **Blind pairs** for the user to judge: photograph against render, and full recipe against ablated.
  - **The answer:** the cheapest recipe that still reads as real, at Tier A and at Tier B.

  _[docs/studies/grass-realism.md](docs/studies/grass-realism.md): the meadow at midday and golden hour with each part switched off, with its cost. Translucency and canopy occlusion carry the look and cost nothing; aerial perspective is nearly free and makes the horizon; clouds (0.6 ms) and multisampling (0.6 ms) come next; sheen, clumps, variation, dry blades and rounded normals each add a little. Tier A: a strip without sky, clouds or depth of field (2.07 ms in Chrome, just over). Tier B: the meadow at half density. Five Commons photographs (public domain, CC0, CC BY, credited) sit beside renders matched to them. What they say the engine lacks: mixed species, feathery seed panicles, the glare and haze of a low sun, views from above for lawns, and context. Blind pairs (`docs/studies/realism/blind.html`) are built for the user to judge; their verdict is not recorded yet._

- [x] **2.10 Grass and the safety rules** [—] (S) — each case measured with the analysers:
  - a field swaying (whole-field motion);
  - gust waves (travelling bands);
  - dense thin blades (a grating?);
  - mown stripes (stripes).

  The limits it sets apply to Epic 3.

  _[docs/studies/grass-safety.md](docs/studies/grass-safety.md). Swaying is inside the motion caps once a strip's strong-end gusts are lowered (blades leaning from their roots read as a zoom); the motion check cannot follow grass at all, so camera motion through it is held from the camera's own transform. Gust waves read pattern `none`. Dense thin blades are a grating in a view from among them, not in the field. Shimmer is the new hazard (2.7). Mown stripes wait for mowing (3.4)._

## Epic 3 — Grass

- [x] **3.1 `grass-footer`** [A → B] (S) — a side-on band of a few thousand blades along the bottom of a page or section. It sways in the wind and parts around the pointer with a stateless push. The drop-in. Compared with SVG grass in 3.8.

  _`grass-footer`: the engine framed as a strip. The camera stands at the field's edge, 12 eye heights back from the bottom of the view, with the eye a little below the tallest tips and the horizon set by lens shift. A soil ground fades out before the far blades thin. The pointer parts only the near blades, so the gap shows the field behind. Only the rows the grass can reach are multisampled, then copied into the scene (`strip.ts`). 0.83 ms on Dawn, 2.37 ms in Chrome (2.27 to 2.70): **Tier B** by budget, over Tier A's 2 ms in Chrome, mostly filling the near blades, which overlap. Flash `low`, pattern `none`, motion inside the caps. Reads over a light page._

- [x] **3.2 `meadow`** [C] (L) — the showpiece, a field at eye level running to the horizon:
  - tall grass with seed heads, and a few wildflowers (4.4);
  - gusts crossing it, with cloud shadows;
  - pollen drifting in the light (Moon Temple's point renderer);
  - the nearest blades out of focus.

  Presets for midday, golden hour with the sun behind, and dusk. The camera drifts slowly, inside the vection limits; moving through the grass is a gated preset. A hero for an outdoor brand. Tier B at a reduced blade count is the goal; Tier C at full count is allowed.

  _`meadow`: the engine to the horizon under a sky with cumulus whose shadows cross the field, a hazed hedgerow, wildflowers in drifts, seed heads, pollen, depth of field, and a path the pointer brushes that springs back. Midday, golden hour from just above the grass, dusk, a sparse Tier B version, and a gated walk through it. Each part can be switched off (`without`), and the far grass drawn as shells. 2.1 ms on Dawn at midday, 3.4 at golden hour; in Chrome 6.2 ms at midday, 7.7 at golden hour: **Tier C**, with the sparse version (half density, 4.8 ms) in Tier B. Flash `low`, pattern `none`, motion inside the caps but walking. The view from among the blades the plan imagined is a grating and over the motion caps; golden hour is framed from just above them. The plan's "few wildflowers (4.4)" are simple flower heads here, not 4.4's phyllotaxis._

- [x] **3.3 `lawn`** [B] (M) — a lawn section seen from above at an angle. The pointer brushes and treads it, and the blades bend and recover over a few seconds (2.5). It is a cursor trail with a memory.

  _`lawn`: the engine under a pitched camera (`pitchedCamera`), an eye 1.7 m up looking 42° down, with a lawn species short, fine and dense (4 to 7.5 cm, 9000 blades a square metre) over thatch. Moving, the pointer brushes the trample field along its path; pressed, it treads a print; left alone, a slow trail winds across. All of a frame's brushes go into one trample step, up to 64: two steps in a command buffer share one uniform buffer. 1.07 ms on Dawn, 3.87 ms in Chrome: **Tier B**. Flash and pattern `none`; the shimmer test passes. Seen from above, shells beyond the blades add a little texture to the thin far band for 0.7 ms more, so canopy stays the default (2.8)._

- [x] **3.4 `mowing`** [B] (M) — the pointer mows. Cut blades are shorter and laid down in the mower's direction. Stripes appear because blades leaning away from the viewer show their sheen and blades leaning towards them show their darker sides, so the stripes swap as the view turns. That is the real physics of lawn stripes. Stripes are a grating, so their contrast is held under the pattern step, and full contrast is gated. A playful progress bar: mow the lawn.

  _`mowing`: a mower brush cuts (to 45% of the height) and lays the grass its way, in a second vector of the trample field that does not spring back, only fades with `regrow`. The stripes come out of the blade lighting unaided; laid as far as the wind bends grass, they barely showed, so laid grass lies over at 1.2 of its height. A mower's brush is a capsule along its pass, so a row is one brush and a held frame or a jump is mown at once. A clock mows the lawn in 40 s, or `progress` holds it as a progress bar, and dragging mows. 1.49 ms on Dawn, 4.14 ms in Chrome: **Tier B**. The stripes, a row wide and of low contrast, read pattern `none` even at `bold stripes`, so nothing is gated._

- [x] **3.5 `grass-edges`** [B] (M) — grass growing along the top edges of headings, cards and buttons. Snow Temple's element-edge rows hold blade length where they held snow depth. It grows in over time or scroll, sways, and parts around the pointer. A spring hero.

  _`grass-edges`: no rows were needed. Grass does not slide or pile, so a blade's length is a pure function of the growth, and one instanced draw of 2D blades covers up to 24 edges with nothing kept between frames. Roots jitter across three slots, since one to a slot is a grating. The canvas must lie over the copy (the hero layout): in a card slot it sees only its own bottom edge. 0.24 ms on Dawn, 1.99 ms in Chrome: **Tier A**. A held frame keeps the scroll's growth when the scroll drives it, as the visitor's own motion._

- [x] **3.6 `fur-text`** [B] (M) — fur or grass growing from a heading's glyphs (the text field), by shells (Lengyel) with Kajiya–Kay strand shading. A direction field that the pointer combs and that relaxes back. Temple of Time named this family as fur's home.

  _`fur-text`: shells in one fullscreen pass, 28 layers from the tips down, over the text field's distance. A strand bends along the comb as `lean × t²`, and between layers it is a capsule, so a laid strand is a streak, not dots. The comb is a 96-column CPU grid the pointer strokes and that relaxes back over 4 s, with a figure of eight when idle. Kajiya–Kay lighting with a tinted second highlight, tufts of tone, and coats of fur, grass and moss. A strand map (a texel per cell: present, height, root offset, tone) made once per heading took Chrome from about 7 ms to 2.5; Dawn reads 1.00 ms: **Tier B**. Flash and pattern `none`._

- [x] **3.7 `grass-growth`** [B] (S) — a lawn growing in from bare soil as the page scrolls, with blade height following an arrival-time reveal spread from seeded patches. An onboarding or "growth" metaphor.

  _`grass-growth`: placement grows each blade once a front from seeded patches has passed it (`growth.wgsl`, shared with the ground so nothing far is green before it has grown). Patches 1.6 m apart start up to 3 units of progress late and spread at 0.4 m a unit, with noise for ragged fronts. Bare ground is lit as open soil with clods. Scroll, or a clock that grows, holds and shrinks. 1.53 ms on Dawn, 5.21 ms in Chrome: **Tier B**._

- [x] **3.8 SVG and CSS against WebGPU** [—] (S) — grass four ways on the same page:

  _[docs/studies/grass-compare.md](docs/studies/grass-compare.md), by `node experiments/grass-compare.mjs`. SVG blades rotating with CSS cost about 0.3 ms of main thread per blade a second, since an SVG child's transform is painted on the main thread: fine to about 400 blades, 18 fps by 6400. Canvas 2D holds 60 fps to 6400 blades, at 134 ms/s of main thread and 350 in the GPU process, and drops to 48 fps at 25,600. The CSS-only strip is cheapest but moves as one silhouette. `grass-footer` draws 11,000 to 107,000 blades at a flat 30 ms/s of main thread. The crossover is in the low thousands: SVG below a few hundred blades, Canvas 2D to a few thousand, WebGPU past that or wherever the grass needs light, depth, wind or trampling._
  - SVG blade paths swaying with CSS transforms;
  - a CSS-only gradient strip;
  - a Canvas 2D strip;
  - `grass-footer`.

  Measured as main-thread time, GPU time and frame drops by blade count, to find where each stops being the right choice.

## Epic 4 — Leaves, flowers and wind

- [ ] **4.1 Leaf aerodynamics** [—] (M) — `src/gpu/leaf/`. A falling leaf is a plate with lift and drag. By its size and density it flutters side to side or tumbles end over end. The model is Andersen, Pesavento and Wang's quasi-steady one, integrated in compute through the wind field. Tested: broad, heavy leaves tumble and light ones flutter, in the order of the paper's phase diagram, and both settle near their terminal speeds.
- [ ] **4.2 `falling-leaves`** [A] (M) — autumn leaves at depth, fluttering and tumbling (4.1). They land and gather on page elements' top edges and on the ground, and the pointer blows them. They are shaded with translucency, since backlit leaves glow, and coloured by 4.5's pigments. Compared with The Eightfold Path's pixel-art version.
- [ ] **4.3 `petals`** [A] (S) — cherry blossom petals: lighter than leaves, curled, and fluttering more, drifting across a hero.
- [ ] **4.4 Flowers and phyllotaxis** [B] (M) — flowers that open over time or scroll: a daisy, a sunflower head and a dandelion clock. Florets and petals are placed by Vogel's model, at the golden angle. A sunflower head's spirals are 34 and 55 arms, which is far past the pattern rule's limit, so it is measured, and kept small or dim or gated.
- [ ] **4.5 `seasons`** [B] (M) — the meadow, or a tree's canopy, through the year as the page scrolls. Leaf colour comes from pigments in 2.6's leaf model. In autumn the chlorophyll breaks down and shows the carotenoids' yellow beneath, and some species redden with anthocyanins. Leaves fall (4.2). Winter is handed to Snow Temple.
- [ ] **4.6 `dandelion`** [A] (S) — a dandelion clock the pointer blows. Its seeds drift away slowly on the wind, falling at the low terminal speed their pappus gives them (Cummins et al.'s separated vortex ring).
- [ ] **4.7 `foliage`** [B] (M) — a hedge or tree canopy edge framing a section. Leaf cards are drawn with translucency and sway by Sousa's hierarchy of trunk, branch and leaf flutter. Sunlight dapples through the gaps. Moving dapples are flicker, so their rate and contrast are capped and measured.

## Epic 5 — Growing things

- [ ] **5.1 Space colonisation** [—] (M) — `src/gpu/plant/`. Runions et al.'s algorithm: attraction points spread through a space, and branch nodes grow towards the nearest ones and consume them. It runs in a worker or in compute. It records each segment's arrival step for a scroll reveal, as Storm Temple's tree does. Branches thicken by the pipe model (the area of a parent equals its children's). Tested: the same seed grows the same plant, and branches never cross.
- [ ] **5.2 `roots`** [B] (M) — roots growing down the page as it scrolls, around the page's elements, whose boxes hold no attraction points. A sustainability page's scroll story.
- [ ] **5.3 `vines`** [B] (M) — ivy climbing along element borders, with leaves unfolding behind the growing tip. Framing a card or a section.
- [ ] **5.4 `moss`** [B] (M) — moss and lichen spreading over an element from its corners and crevices, where it would be damp. Lichen grows as slow Eden-like rosettes. Moss grows as patchy reaction–diffusion, drawn as short shells, so it looks velvety. Reaction–diffusion spots form a dot lattice, so they are measured against the pattern rule.
- [ ] **5.5 `tree`** [B] (M) — a tree growing from a seed by space colonisation (Runions, Lane and Prusinkiewicz), budding leaves at the end. Compared with an L-system tree. A progress or growth metaphor.
- [ ] **5.6 `leaf-veins`** [A] (S) — a leaf's veins grown by Runions et al.'s venation model and revealed by arrival time. A loader or a logo fill.

## Epic 6 — Sand and soil

- [ ] **6.1 `dunes`** [B] (M) — Werner's slab model on a height field in compute:
  - slabs of sand hop downwind;
  - they settle more readily on sand than on bare ground;
  - they avalanche past the angle of repose.

  Little sand grows crescent barchans, and a lot grows transverse ridges. It is lit by a low sun, with ripples on the slopes. A hero for a travel or desert page. Tested: mass is conserved, and a barchan's horns point downwind.

- [ ] **6.2 `zen-garden`** [B] (M) — a raked gravel section the pointer rakes, on Snow Temple's footprint field. The rake's tines push gravel into ridges, which slump to their angle of repose. Rocks and moss islands sit where page elements are. Raked lines are stripes, so their contrast is held under the pattern step.
- [ ] **6.3 `falling-sand`** [B] (M) — sand poured from the pointer. It piles at its angle of repose and flows around page elements, by a Margolus block automaton, which updates without races. Cross-referenced with hologpu's planned `falling-sand`.
- [ ] **6.4 `hourglass`** [A] (S) — an hourglass loader whose sand runs at a rate independent of how much is left (Beverloo's law), as a real one does. So it times exactly.
- [ ] **6.5 `dry-cracks`** [B] (M) — mud cracking as it dries:
  - cracks start at the edges and at flaws;
  - each new crack meets an older one at a right angle (T-junctions);
  - over repeated wet and dry cycles, the junctions relax towards 120° and the cells towards hexagons (Goehring).

  The network is grown with the arrival reveal and drawn with the stroke renderer. The edges of the mud cells curl up and catch the light. A drought scroll story for a climate page.

## Epic 7 — Rock and terrain

- [ ] **7.1 Erosion** [—] (M) — `src/gpu/erosion/`. Hydraulic erosion by Mei, Decaudin and Hu's virtual pipes (water, sediment and flux), plus thermal erosion by talus angle, on fBm terrain. Tested: rock and sediment together are conserved, and channels form downhill.
- [ ] **7.2 `terrain`** [B] (M) — a mountain range eroded once, or eroding over a few seconds as an intro. It has a snow line, grass on the low slopes (2.8's distant shading) and aerial perspective, and the camera drifts slowly, inside the vection caps.
- [ ] **7.3 `strata`** [A] (M) — a geological cross-section the page scrolls down through: sedimentary layers, folds and a fault, fossils and the water table. "Down through the earth" as a scroll story. Layers are stripes, so their contrast is held under the pattern step.
- [ ] **7.4 `stone`** [A] (S) — procedural stone surfaces for cards and buttons: granite speckle, sandstone bedding and slate cleft. With the text field, a heading cut into stone in V-grooved letters.

## Epic 8 — On the page

- [ ] **8.1 Spring hero** [B] (M) — grass growing on the headline and the call to action (3.5), petals drifting (4.3), and a meadow band at the bottom, with `dose` low enough to sit behind text.
- [ ] **8.2 Autumn hero** [B] (M) — falling leaves gathering on the cards and in a drift along the footer, which the pointer kicks up.
- [ ] **8.3 Outdoor brand hero** [C] (L) — the meadow (3.2) in front of eroded mountains (7.2) at golden hour. The page this family most wants to prove.
- [ ] **8.4 Cursor trail** [A] (S) — a trodden trail through grass that recovers, or leaves kicked up, as a drop-in.
- [ ] **8.5 Scroll story** [B] (M) — a sustainability page from the surface down: grass, then roots (5.2), then strata (7.3).

## Epic 9 — Production readiness

- [ ] **9.1 Library entry** (S) — mount any effect on a caller's canvas, with element tracking for the page effects, as the other families do.
- [ ] **9.2 Grass on low-end devices** (M) — blade budgets by device, density rungs, and what 2.9's cheapest recipe looks like on a phone at DPR 3, where MSAA costs most.
- [ ] **9.3 Accessibility** (M) — `docs/accessibility.md`:
  - flash, pattern and motion over every preset;
  - the sway, stripe and spiral limits from 2.10 and 4.4;
  - held frames and the start gate;
  - grass and leaves on the page that never hide text or controls.
- [ ] **9.4 SVG and CSS fallbacks** (S) — for each Tier A effect, the best SVG or CSS version beside it, with its cost and what it cannot do.
- [ ] **9.5 Adaptive quality** (S) — blade count, LOD distances, MSAA and simulation resolution scale with the measured frame time, from the shared rungs.
- [ ] **9.6 Into the temple core** (M) — move the following into `@mk7s/hologpu-temple-core`:
  - the blade engine (2.1–2.3);
  - the ground wind and trample field (2.4, 2.5);
  - the leaf optics (2.6);
  - leaf aerodynamics (4.1);
  - space colonisation (5.1);
  - erosion (7.1).

## Epic 10 — Measurement and findings

- [ ] **10.1 Cost studies** (S) — every epic's effects on Dawn and in Chrome, with blades drawn and culled, memory and state size, filed in `docs/studies/`.
- [ ] **10.2 Device matrix** (M) — an integrated GPU, a phone, and Safari and Firefox, to settle the provisional tiers and check indirect draws everywhere.
- [ ] **10.3 Grass crossover** (S) — 3.8's answer on more devices: at what blade count SVG, Canvas 2D and WebGPU each stop being the right choice.
- [ ] **10.4 Decision guide** (S) — which effect for which job, how much grass a page can afford, and the cases where the answer is "don't".

## Epic 11 — The flower model

Flowers get the care grass got: a model first, then effects. Epic 4's flowers (4.4, 4.6) use it once it exists.

- [ ] **11.1 Petal geometry** [—] (M) — `src/gpu/flower/petal.{ts,wgsl}`. A petal is a surface grown from its base, not a textured card:
  - an outline from a few shape parameters (length, width, the widest point, a notched or pointed tip, a claw at the base), after Ijiri et al.'s petal editor;
  - a cupping across it and a curl along it;
  - ruffles at the edge, from the edge growing more than the middle. Liang and Mahadevan showed that a lily's edge wrinkles because its margin grows faster, so the ruffle's wavelength follows the growth excess and is not painted on;
  - drawn as a tessellated patch from vertex pulling, LODs by size on screen, as the blades are.

  Tested: a flat petal with no excess growth has no ruffle, and more excess gives more, shorter waves.

  _Started: `src/gpu/flower/petal.ts` and its twin `src/wgsl/petal.wgsl`, with outline, claw, notch, cup, curl and ruffles. The ruffle's amplitude follows from the excess (a sine of amplitude A and wavelength λ lengthens a line by (πA/λ)², so A = λ√excess/π), and its wavelength shortens as excess^¼, after Sharon et al.'s leaf edges. Tested (`tests/petal.test.ts`): no excess, no ruffle; more excess, more and shorter waves; the ruffle takes up the excess length to first order; the outline is widest where it says; a curl keeps the length. Still to do: LODs by size on screen._

- [ ] **11.2 Floral diagrams** [—] (M) — `src/gpu/flower/diagram.ts`. A flower as botanists describe it: whorls of sepals, petals, stamens and carpels, each with its count (merosity: lilies in threes, roses in fives), its offset from the whorl below, and fused or free. Petals in a spiral (a rose's) are placed by Vogel's golden-angle model, which moves here from 4.4. The same description builds a flower in 3D and draws its floral diagram in 2D, so a flower's structure can be checked against a botanical source. The fold library (from The Hero's Journey) supplies the dihedral symmetry of a regular flower.

  _Started: `src/gpu/flower/diagram.ts`, with whorls (count and turn from the whorl outside), golden-angle spirals (radius, height, size and curl running inwards), and diagrams for a lily, buttercup, cherry, poppy, rose and camellia. `arrange` gives each organ its place, bud and open angles and opening order, ring by ring from the outside in; `diagramSvg` draws the diagram from above. Tested (`tests/diagram.test.ts`): a lily's tepals alternate at 60°, a rose's petals are 137.5° apart moving inwards, every flower opens outside in. Still to do: fused organs, and the fold library for regular flowers._

- [ ] **11.3 Petal optics** [—] (M) — `src/gpu/optics/petal.ts`, beside the leaf model. Petal colour from its pigments: anthocyanins (red to blue, shifting with pH), carotenoids (yellow and orange), betalains (beetroot pinks) and chlorophyll at the base. Light through the petal from the leaf model's plate. The look of the surface:
  - conical epidermal cells, which make a petal velvety by scattering light back towards it, and which petunias without them lack (Noda et al.);
  - the gloss of a buttercup, from a thin cell layer over an air gap, as Vignolini et al. measured;
  - structural colour, the iridescence of _Hibiscus trionum_'s striations (Whitney et al.).

  Petals also carry ultraviolet patterns humans cannot see. These are kept as a channel for 16.1.

- [ ] **11.4 Opening and closing** [—] (M) — a flower opens because its petals' inner faces grow faster than their outer ones, or swell with water, and so bend outwards (van Doorn and van Meeteren). Opening is modelled as a growth difference across each petal, over time or scroll, from bud to full bloom. Some flowers close at night. Tested: the bud is closed and the open flower matches its floral diagram, and opening is monotonic in its progress.
- [ ] **11.5 Stems and heads in the wind** [—] (S) — a stem is a slender cantilever carrying a head's weight. It sways at its natural frequency, set by its length, stiffness and the head's mass, in the ground wind field (2.4). Heavy heads nod and thin stems whip. Sousa's hierarchy adds petal flutter on top.
- [ ] **11.6 Flower field placement** [—] (M) — forbs among the grass: flowers placed by the blade engine's compute, in drifts, as wildflowers grow, not scattered. Species are mixed by a few soft maps. Far flowers become dots of colour, then a tint on the canopy, so a meadow full of flowers costs what the grass does. This is the meadow's missing realism (2.9): real meadows mix grasses and forbs.

## Epic 12 — Blooms

- [ ] **12.1 `flower-opening`** [A] (S) — a single flower opening, over time or as the page scrolls, with no compute: a lily, a poppy or a camellia from 11.2's diagrams. A hero's centrepiece or a section divider.

  _Started, as the flower model's viewer: `flower-opening` draws any diagram (lily, buttercup, cherry, poppy, rose, camellia) as instanced petal grids pulled in the vertex shader, with 4x multisampling and depth, opening ring by ring over time or scroll. Its first run through the checks found three things: a turning flower is whole-field rotation (spin capped at 0.012 turns a second); a lily filling the view is a six-armed rosette over the pattern limit (it fills two thirds of the shorter side); and an opening rose is a zoom to optical flow, 0.22 doublings a second, so the rose opens at an eighth of the pace (under 0.083 across its cycle). Still to do: costs, posters and the realism pass with 11.3's optics. The rose's middle petals still pass through each other, which 12.2 takes on._

- [ ] **12.2 `rose`** [B] (M) — a rose opening from a tight bud, its petals in a golden-angle spiral, cupped and curling back at their edges as they open (11.1, 11.4). The hardest single flower; it is the flower model's test.
- [ ] **12.3 `wildflower-meadow`** [C] (L) — the meadow (3.2) with forbs: poppies, cornflowers, oxeye daisies and buttercups in drifts (11.6), swaying on their stems. Judged against photographs as the meadow was, with the mixed field it lacked.
- [ ] **12.4 `sunflowers`** [B] (M) — a row of sunflowers whose heads follow the pointer as young sunflowers follow the sun. Atamian et al. showed that the stem's east side grows faster by day and the west by night, so heads turn with a lag and return overnight. The heads are 4.4's florets. The pattern rule measures the spirals.
- [ ] **12.5 `night-bloom`** [B] (S) — a moonflower or evening primrose opening at dusk, fast enough to watch, with its pale petals glowing in moonlight (Moon Temple's night vision tail). A dark hero.
- [ ] **12.6 `tulips`** [B] (M) — a field of tulips in coloured stripes, as the Dutch bulb fields are grown. Stripes are a grating, so the bands' contrast and width are measured. The cup-shaped head and its close-at-night movement (11.4) come from the model.
- [ ] **12.7 `cherry-branch`** [B] (M) — a branch grown by space colonisation (5.1) that buds and blossoms as the page scrolls, then sheds petals (4.3) on the wind.
- [ ] **12.8 `dewy-petals`** [B] (M) — a macro close-up of petals with dew drops, using Water Temple's droplet optics, with depth of field. The look of a perfume or skincare brand.

## Epic 13 — Floral design

Flowers as people have drawn and printed them. The look comes from how each was made.

- [ ] **13.1 Floral rosettes** [A] (S) — flower-like rosettes from the fold library's dihedral groups: a chrysanthemum's sixteen petals, a rose window, a Tudor rose. With The Hero's Journey's rosette finding: a rosette with six or more arms is a regular pattern, so its contrast and size are measured.
- [ ] **13.2 `floral-repeat`** [B] (M) — a wallpaper or textile repeat in the manner of William Morris: flowers, leaves and stems grown by space colonisation in a tile, then repeated by a half-drop or a wallpaper group. The repeat is why a wallpaper reads as one, and it is a pattern, so it is measured. Morris's designs are old enough to be public domain, but nothing is copied: the repeat is grown.
- [ ] **13.3 `art-nouveau-frame`** [B] (M) — whiplash stems and lilies growing around a card or a section in the manner of Mucha's borders, with a reveal by arrival time. The stroke renderer draws the lines, in even, tapered widths.
- [ ] **13.4 `botanical-plate`** [A] (M) — a botanical illustration drawn as an engraving: outline, then hatching that follows the form, then hand colouring, revealed in that order as an engraver and colourist worked. Built from 11.2's flower, so the plate is of a real flower's structure.
- [ ] **13.5 `block-print`** [A] (S) — an Indian block-printed floral (Sanganer or Bagru): one wooden block per colour, each printed slightly out of register, with ink pooling at the block's edges and the cloth's weave showing through. Temple of Time's print pipeline provides the misregistration and the paper; the block is grown here.
- [ ] **13.6 `kamon`** [A] (S) — Japanese family crests of flowers (the sixteen-petal chrysanthemum, the paulownia, the plum), drawn from circles and arcs by compass and ruler, as crest makers drew them. They work as icons and loaders.
- [ ] **13.7 `stained-glass-flowers`** [B] (M) — a Tiffany-style floral window over a section: coloured glass with seeds and streaks, lead cames between the pieces, and light through it that moves with the sun. The pieces are cut from a Voronoi partition that follows the flower's outlines.

## Epic 14 — Made by hand

Flowers that are folded, cut, pressed or stitched, where the craft is the mechanism.

- [ ] **14.1 `origami-flowers`** [B] (M) — paper flowers folding themselves: a lily and a Kawasaki rose. Fold sequences run on the fold library, with paper that bends but does not stretch, so each fold is an isometry. Tested: paper area is conserved through the sequence.
- [ ] **14.2 `paper-cut`** [A] (M) — layered paper-cut flowers, as in a shadow box: layers at depths, each casting a soft shadow on the one behind, which shifts with the pointer for parallax inside the vection caps.
- [ ] **14.3 `pressed-flowers`** [A] (S) — a herbarium sheet: flattened flowers whose colours have faded as pigments do (anthocyanins brown and carotenoids last), with translucent petals over paper. A gentle, still card background.
- [ ] **14.4 `embroidery`** [B] (M) — flowers stitched in satin and stem stitch along their outlines, stitch by stitch, as the page scrolls. Each thread is lit as a strand with Kajiya and Kay's model (from 3.6), so the satin catches the light as it turns. The stitch directions follow the petal's shape, as an embroiderer's do.
- [ ] **14.5 `ikebana`** [B] (S) — an arrangement of a few stems in a vase, placed by the three-line rule of Ikenobo (heaven, earth and man at set angles), each stem swaying on its own (11.5).

## Epic 15 — Flowers on the page

- [ ] **15.1 `flower-loader`** [A] (S) — a loader that blooms as it fills: petals open in step with a progress value, and the flower closes again for indeterminate progress.
- [ ] **15.2 `garden-cursor`** [A] (S) — flowers sprout where the pointer rests and wilt away slowly behind it. A cursor trail with a season.
- [ ] **15.3 `floral-text`** [B] (M) — a heading whose letters fill with flowers, packed by size inside the text field's outline (Poisson-disc packing with sizes), opening one by one. Or the letters' strokes as stems, budding along their length.
- [ ] **15.4 `wreath`** [A] (S) — flowers and leaves arranged around a circle: an avatar's frame, a badge or a seasonal logo. Placement follows the circle with a rhythm of large and small flowers, as a florist's wreath does.
- [ ] **15.5 `petal-burst`** [A] (S) — a celebration of petals instead of confetti: thrown up on a click and falling with 4.1's aerodynamics, curled petals tumbling as they fall.
- [ ] **15.6 `bouquet`** [B] (M) — the visitor picks flowers to make a bouquet, and the stems gather into a spiral hand-tied bunch, as florists tie them, then sway together. A florist's product picker.
- [ ] **15.7 `flower-dividers`** [A] (S) — section dividers: a row of small flowers along a rule, which open as the divider scrolls into view.

## Epic 16 — Flower science

- [ ] **16.1 `bee-vision`** [B] (M) — a flower bed seen as a bee sees it: the ultraviolet patterns (nectar guides) from 11.3 made visible, mapped to false colour by Chittka's bee colour hexagon. A slider moves between human and bee sight.
- [ ] **16.2 `pollinators`** [B] (M) — bees visiting flowers, each choosing by the colour it learnt rewarded it (flower constancy), and carrying pollen between flowers of one species. An agent model in compute. Motion is capped: insects darting across the view are fast motion.
- [ ] **16.3 `samaras`** [A] (S) — maple seeds spinning down. Lentink et al. showed that a samara autorotates on a leading-edge vortex, which slows its fall. They whirl from a branch, as 4.1's leaves fall, and a click releases a handful.
- [ ] **16.4 `flower-clock`** [B] (M) — Linnaeus's flower clock, in which each species opens and closes at its own hour: a dial of flowers whose state tells the time. A clock widget that is also botany.
- [ ] **16.5 `hydrangea`** [A] (S) — a hydrangea head that turns from pink to blue as a soil slider changes. Its colour follows the aluminium available to the pigment delphinidin, which the soil's acidity sets. A teaching widget.
- [ ] **16.6 Flowers and the safety rules** [—] (S) — the cases particular to flowers:
  - saturated red petals swaying are the red flash rule's case;
  - spirals, rosettes, repeats and tulip stripes are its pattern cases;
  - a field of nodding heads is whole-field motion.

  Each case is measured, and a preset that goes over is gated, as 2.10 did for grass.

## Epic 17 — Floral pages

- [ ] **17.1 Florist hero** [B] (M) — a bouquet (15.6) beside the shop's heading, with petals drifting (4.3), on a light page.
- [ ] **17.2 Wedding page** [B] (M) — an art nouveau frame (13.3) around the names, flowers opening as the guest scrolls to the details, and a petal burst (15.5) on the RSVP.
- [ ] **17.3 Perfume launch** [C] (L) — a macro dewy bloom (12.8) opening slowly at golden hour, as the bottle's product shot. The page this epic most wants to prove.
- [ ] **17.4 Botanical garden scroll story** [B] (M) — a flower's life down the page: seed, shoot, bud, bloom (12.2), the bee's view (16.1), seed head, seeds on the wind (4.6, 16.3).
- [ ] **17.5 Seasonal greeting** [A] (S) — a spring or Mother's Day card: a wreath (15.4) and floral text (15.3), light enough for an email's landing page.

## Epic 18 — Flowers measured and released

- [ ] **18.1 Flower realism study** [—] (M) — `docs/studies/flower-realism.md`. Single flowers and the wildflower meadow beside photographs (Commons, credited, as 2.9's), blind pairs, and an ablation of 11.3's surface terms: velvet, gloss, translucency and structural colour, each switched off in turn.
- [ ] **18.2 Floral design study** [—] (S) — each design effect in Epic 13 beside an example of its tradition, saying what makes it read as that tradition: block registration, Morris's repeat, Mucha's line. Examples are cited, and shown only where their licence allows.
- [ ] **18.3 Flower costs** [—] (S) — every flower effect on Dawn and in Chrome, with petals and flowers drawn, so tiers are set as the grass's were.
- [ ] **18.4 SVG and CSS flowers** [—] (S) — the best SVG version of a flower opening, a floral border and a petal burst beside the WebGPU ones, measured as 3.8 measured grass. Where SVG wins, the notes say so.
- [ ] **18.5 Into the core** [—] (S) — the petal model, floral diagrams and petal optics move into `@mk7s/hologpu-temple-core`, beside the blade engine and leaf optics.

## Risks and open questions

- **Blade count on integrated GPUs and phones.** A meadow that reads as real may want a million blades. If Tier B allows only a hundred thousand, how much of the realism survives? 2.9's cheapest recipe and 9.2 are the experiment.
- **Realism is a judgement.** No metric says grass looks real. Side-by-sides with photographs and blind pairs keep the judgement honest, but they are still a judgement, and the notes say so.
- **Shimmer and the flash rule.** Does the analyser's cell grid see the sum of thousands of sub-pixel blades correctly? 2.7's shimmer test needs many frame phases, and MSAA on and off.
- **Whole-field sway.** Is a field of grass swaying in gusts inside the motion caps at a useful wind speed, or does the meadow need its wind turned down behind text?
- **Indirect draws beyond Chrome.** `indirect-first-instance` is optional, and Safari's and Firefox's indirect draws are 10.2's to check. A fallback with one instanced draw per LOD may be needed.
- **Memory.** Blades are generated each frame, but the trample field, sand, erosion and moss hold state. How much can a page hold with the other families' effects beside it?
- **Reference photographs.** Their licences must allow showing them on a public site, with credit. The user's own photographs would avoid the question.
- **Accent.** Terracotta sits near Fire Temple's amber. Check it in the holofx site's dropdown beside the other families before committing to it.
- **Flowers are harder than grass.** A blade is a curve; a petal is a surface with ruffles, cups and curls, and a rose has dozens. If 11.1's petals cannot be cheap enough for a field, the wildflower meadow falls back to cards for its far flowers, and the notes say where.
- **Floral design and copying.** Morris and Mucha are public domain, but the designs here are grown, not traced, and block prints and crests are living traditions. The notes credit each tradition and copy no specific design.
- **Red petals.** Saturated red is the red flash rule's case, and red flowers are common. 16.6 finds out how much movement a field of poppies can have.
- **Scope.** Seven epics of effects is a lot, and the flowers add eight more. Grass is first and must not be rushed. The ground epics (6 and 7) could move to hologpu if this family runs long.

## Starting references

From memory, as the other families' plans began; each is to be confirmed against the source when its story is built.

- Eric Wohllaib, "Procedural Grass in _Ghost of Tsushima_", GDC 2021.
- Bill Rockenbeck, "Blowing from the West: Simulating Wind in _Ghost of Tsushima_", GDC 2021.
- Klemens Jahrmann and Michael Wimmer, "Responsive Real-Time Grass Rendering for General 3D Scenes", I3D 2017.
- Jaap van Muijden, "GPU-Based Run-Time Procedural Placement in _Horizon Zero Dawn_", GDC 2017.
- Kévin Boulanger, Sumanta Pattanaik and Kadi Bouatouch, "Rendering Grass in Real Time with Dynamic Lighting", _IEEE Computer Graphics and Applications_ (2009).
- Tiago Sousa, "Vegetation Procedural Animation and Shading in Crysis", _GPU Gems 3_, chapter 16 (2007).
- Jerome Lengyel, Emil Praun, Adam Finkelstein and Hugues Hoppe, "Real-Time Fur over Arbitrary Surfaces", I3D 2001.
- James Kajiya and Timothy Kay, "Rendering Fur with Three Dimensional Textures", SIGGRAPH 1989.
- Stéphane Jacquemoud and Frédéric Baret, "PROSPECT: a model of leaf optical properties spectra", _Remote Sensing of Environment_ (1990).
- Laurent Bousquet et al., "Leaf BRDF measurements and model for specular and diffuse components differentiation", _Remote Sensing of Environment_ (2005).
- Anders Andersen, Umberto Pesavento and Z. Jane Wang, "Unsteady aerodynamics of fluttering and tumbling plates", _Journal of Fluid Mechanics_ (2005).
- Cathal Cummins et al., "A separated vortex ring underlies the flight of the dandelion", _Nature_ (2018).
- Helmut Vogel, "A better way to construct the sunflower head", _Mathematical Biosciences_ (1979).
- Adam Runions et al., "Modeling and visualization of leaf venation patterns", SIGGRAPH 2005; Adam Runions, Brendan Lane and Przemyslaw Prusinkiewicz, "Modeling Trees with a Space Colonization Algorithm", Eurographics Workshop on Natural Phenomena (2007).
- Przemyslaw Prusinkiewicz and Aristid Lindenmayer, _The Algorithmic Beauty of Plants_ (1990).
- B. T. Werner, "Eolian dunes: computer simulations and attractor interpretation", _Geology_ (1995).
- W. A. Beverloo, H. A. Leniger and J. van de Velde, "The flow of granular solids through orifices", _Chemical Engineering Science_ (1961).
- Lucas Goehring, "Evolving fracture patterns: columnar joints, mud cracks and polygonal terrain", _Philosophical Transactions of the Royal Society A_ (2013).
- Xing Mei, Philippe Decaudin and Bao-Gang Hu, "Fast Hydraulic Erosion Simulation and Visualization on GPU", Pacific Graphics 2007.
- F. Kenton Musgrave, Craig Kolb and Robert Mace, "The synthesis and rendering of eroded fractal terrains", SIGGRAPH 1989.
- Mike Linkovich, _Terra_ (2016), WebGL grass: the browser baseline.
- Takashi Ijiri, Shigeru Owada, Makoto Okabe and Takeo Igarashi, "Floral diagrams and inflorescences: interactive flower modeling using botanical structural constraints", SIGGRAPH 2005.
- Haiyi Liang and L. Mahadevan, "Growth, geometry, and mechanics of a blooming lily", _PNAS_ (2011).
- Wouter van Doorn and Uulke van Meeteren, "Flower opening and closure: a review", _Journal of Experimental Botany_ (2003).
- Kiyoshi Noda et al., "Flower colour intensity depends on specialized cell shape controlled by a Myb-related transcription factor", _Nature_ (1994).
- Silvia Vignolini et al., "The mirror crack'd: both pigment and structure contribute to the glossy blue appearance of the mirror orchid", _Journal of the Royal Society Interface_ (2012), and the buttercup gloss work by the same group.
- Heather Whitney et al., "Floral iridescence, produced by diffractive optics, acts as a cue for animal pollinators", _Science_ (2009).
- Hagop Atamian et al., "Circadian regulation of sunflower heliotropism, floral orientation, and pollinator visits", _Science_ (2016).
- Lars Chittka, "The colour hexagon: a chromaticity diagram based on photoreceptor excitations as a generalized representation of colour opponency", _Journal of Comparative Physiology A_ (1992).
- David Lentink et al., "Leading-edge vortices elevate lift of autorotating plant seeds", _Science_ (2009).
- Carl Linnaeus, _Philosophia Botanica_ (1751): the flower clock.
- Przemyslaw Prusinkiewicz, Mark Hammel and Eric Mjolsness, "Animation of plant development", SIGGRAPH 1993.
