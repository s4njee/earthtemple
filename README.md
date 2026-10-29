# Earth Temple

A research gallery of WebGPU grass, plants and ground: realistic grass first, then leaves and flowers in the wind, roots, vines and moss that grow, sand, soil, rock and terrain. Each effect is built from its mechanism, and comes with a live demo, readable source, a write-up and a practicality scorecard. It is judged the way the temples judge theirs: **would you actually ship this on a website?**

Realistic grass is a recipe games have worked out (Ghost of Tsushima, Jahrmann and Wimmer): curved blades in clumps, colour that varies blade to blade, light through the blades, a sheen along them, dark roots, gusts that travel, and blades that stay a pixel wide in the distance. It needs many blades placed, culled and drawn on the GPU every frame, which WebGPU's compute and indirect draws make possible in a browser. This family brings the recipe to the web and measures what a page can afford.

Safety comes from The Hero's Journey's checks. Every effect has an intensity control from 0 to 1, calm by default. Every effect and preset runs in `npm test` through the WCAG 2.3.1 flash and red-flash analyser, a regular-pattern analyser after the broadcast guidance, and caps on whole-field rotation, zoom and drift, at the default and at the strong end (0.7). Presets past the limits start paused behind a click-to-start notice. See [docs/safety.md](docs/safety.md).

It is built on Fire Temple's page structure and the shared temple core (`@mk7s/hologpu-temple-core`), from Snow Temple's copy of the shell. The accent is terracotta. See [plan.md](./plan.md) for the roadmap.

## Getting started

```sh
npm install
npm run dev        # http://localhost:5490
npm test           # unit tests, plus the flash, pattern and motion checks and the held-frame audit over every effect
npm run build      # registry, typecheck, static build to dist/ and the bundle check
npm run study -- --epic 3   # cost study on Dawn: docs/studies/epic-3.md and the Scorecard numbers
npm run shot -- grass-footer --times 2 --bg dark,light   # render an effect headlessly to PNG (output/shots)
npm run browser-check -- --report docs/studies/browser-check.md   # every effect in headless Chrome (dev server running)
npm run posters -- --force   # fallback posters from held frames, as WebP
npm run deploy     # build and upload dist/ to Cloudflare Pages (project earthtemple)
```

`?effect=<id>` opens an effect, `&hud=1` the performance HUD, and `&p.<param>=<value>` sets a parameter, `&p.dose=0.6` (intensity) included.

## Effects

| Id               | What                                                                                                                                                                                            | Tier |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `hello`          | The smallest effect: a strip of flat 2D blades swaying in a wave of wind, one instanced draw                                                                                                    | A    |
| `grass-footer`   | A strip of grass along the bottom of the page: blades placed, clumped, bent by gusts and culled in compute, drawn with indirect draws; the pointer parts it                                     | B    |
| `meadow`         | A meadow at eye level to the horizon: pigment-coloured grass lit through the blades, gusts and cloud shadows, wildflowers, pollen, depth of field; the pointer brushes a path that springs back | C    |
| `lawn`           | A lawn seen from above at an angle: the pointer brushes and treads it, and the grass stands back up over seconds                                                                                | B    |
| `mowing`         | The lawn mown in rows, as a progress bar or by dragging: stripes from stubble laid towards and away from the viewer, not painted                                                                | B    |
| `grass-growth`   | A lawn growing in from bare soil, over time or as the page scrolls: patches sprout and spread until they meet                                                                                   | B    |
| `grass-edges`    | Grass growing along the top edges of the page's headings, cards and buttons, swaying and parting around the pointer                                                                             | A    |
| `fur-text`       | A heading grown over with fur, grass or moss by shells, lit as strands, which the pointer combs                                                                                                 | B    |
| `flower-opening` | One flower opening on its swaying stem, from its floral diagram: nine flowers whose petals are grown surfaces, coloured by their pigments and opened by differential growth                     | A    |

## Layout

```
src/gpu/grass/              the blade engine: blade curve and species, placement and clumps, culling,
                            LOD lists and indirect draws, the ground camera, the multisampled strip
src/gpu/wind/               the ground wind (twin of src/wgsl/wind.wgsl): gust fronts, lean, flutter;
                            the trample field: what is pressed down, springing back, and what a
                            mower has laid
src/gpu/flower/              the flower model: petals as grown surfaces (twin of src/wgsl/petal.wgsl)
                            and their levels of detail, floral diagrams of whorls, golden-angle
                            spirals and fused tubes, opening by differential growth, stems in wind
src/gpu/optics/petal.ts     petal colours from anthocyanins, carotenoids, betalains and flavonols
src/gpu/grass/wildflowers.* the meadow's wildflowers: a drift map each, coloured by their pigments
src/gpu/optics/leaf.ts      leaf colours from pigments, by a plate model after PROSPECT
src/gpu/hash.ts             twins of the shader hashes, so CPU models make the same random choices
src/gpu/safety/             dose, the pattern analyser, motion estimate, colour caps and the start gate's rules
src/gpu/colour/             OKLab and OKLCH, palettes, Display P3
src/gpu/symmetry/fold.ts    the 17 wallpaper groups and the rosettes as folds (for flowers)
src/gpu/text/               a font as a signed distance field (Temple of Time's), for fur on text
src/effects/<id>/           meta.ts, index.ts, shaders, notes.md, poster.webp
docs/studies/               cost studies, the browser check, grass realism (the ablation) and grass safety
```

## License

MIT. The Anton font, in `fonts/` for the text field, is under the SIL Open Font License 1.1 (`fonts/Anton-OFL.txt`).
