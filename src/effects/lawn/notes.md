## How it works

The blade engine (stories 2.1 to 2.4) with a pitched camera: an eye 1.7 m up, looking 42° down at a lawn, as someone standing on it would (`lawn-scene.ts`, `pitchedCamera` in `camera.ts`). The lawn species is short, fine and dense (4 to 7.5 cm, 9000 blades a square metre), over thatch rather than bare soil.

Under it is a trample field (story 2.5, `src/gpu/wind/trample.{ts,wgsl}`): a 256 × 256 grid of cells 4 cm across, centred on the lawn in view, each holding two vectors.

- **Bend** is how far the grass there is pushed over, and which way. It recovers towards rest over `tau` (2.5 s), at the grass's stiffness.
- **Lay** is grass laid down and left (the mower's, story 3.4). It does not recover, only fades with `regrow` when that is set.

Brushes write into it in one compute step a frame, up to 64 of them. Moving, the pointer brushes the grass along its path. Pressed, it treads a print, flatter and round. Left alone, a slow trail winds across by itself, so the lawn is never only still.

Placement reads the field at each blade's root: the bend joins the wind's lean in the blade's tip, so a brushed patch lies over in the brush's direction and stands back up over a few seconds. Lit from above, the lain blades show their sides and their sheen, which is what makes a trodden path visible on a real lawn.

Beyond the blades the lawn continues as canopy or as shells (`far`), the switch story 2.8 left for a view from above.

## Cost

On an Apple M1 Max on Dawn ([docs/studies/epic-3.md](../../../docs/studies/epic-3.md)): 1.07 ms per frame at 1080p, about 40,000 blades drawn from 390,000 cells. Density 0.4 costs 1.03 ms and 1 costs 1.33. In Chrome, one 1920 × 1080 frame reads 3.87 ms (3.68 to 4.46 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)). **Tier B**. The trample field is 1 MB (256 × 256 cells of four floats).

Shells beyond the blades instead of canopy (`far: shells`) cost 1.79 ms, for a little texture in the thin far band at the top of the view. From above, the far lawn is too little of the picture to pay for them, so canopy stays the default (story 2.8).

## Pitfalls

- **A lawn from above is all tips.** At eye level the meadow is blades against the sky. From above, the view is the canopy's top surface, so too few blades a square metre shows the thatch between them as dark tufts. The lawn species is denser and finer than the meadow's grass for that.
- **The tail's exposure was set for skies.** A sunlit lawn fills the frame with lit tips and no sky, and reads dull at exposure 1. The lawn sets 1.35.
- **Several trample steps in one command buffer share one uniform buffer.** They all see the last step's brushes (Moon Temple's finding). The step takes all the frame's brushes at once instead.

## Safety

Flash `none`, pattern `none` at every preset and at the strong dose. Motion inside the caps: the camera does not move, and the trail is slow. The shimmer test passes every preset at the default and strong doses. A held frame is a lull with the trail where it was.

## When to use it

A section that invites the pointer in: a garden or outdoor brand's landing page, or a playful cursor trail with a memory. The trail is slow and soft, so it can sit behind a heading at a low intensity.

## References

- Klemens Jahrmann and Michael Wimmer, "Responsive Real-Time Grass Rendering for General 3D Scenes", I3D 2017: blades bent by forces where something touches them.
- Snow Temple's footprint field: the trample field's grid, window and brushes.
