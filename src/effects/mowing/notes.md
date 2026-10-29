## How it works

The lawn (story 3.3) and a mower. The mower is a brush in the trample field that cuts as well as presses: where it passes, the cell's lay is set to its direction of travel, and that lay stays. Placement then makes the blades there shorter (cut to 45% of their height) and lays them over in that direction.

The stripes are not painted. Grass laid away from the viewer shows its upper side to the sky and the sun, and grass laid towards the viewer shows its shaded underside. So rows mown in opposite directions read light and dark, and would swap if the view turned round, as real lawn stripes do. The lighting is the blade engine's own (story 2.6), with nothing added for stripes.

The mower runs up and down rows along the view, joined at the ends, 52 cm wide. Each row's stretch since the last frame is one brush, a capsule along the mower's path, so a fast mower leaves no gaps and a held frame or a jump to the end is mown at once. A progress value says how far along the path it is. By default a clock mows the lawn in 40 s and starts again on fresh grass. `progress` holds it at a fraction, as a progress bar; moving the progress backwards clears the lawn and mows it again to there. Dragging the pointer mows too.

## Cost

1.49 ms per frame at 1080p on Dawn, and 4.14 ms in Chrome (4.02 to 5.31 over 5 loads): **Tier B**. Mown grass costs about what the lawn does: its blades are shorter, not fewer.

## Pitfalls

- **Stripes are a grating.** Stripes of laid grass a row wide are the pattern rule's case: their contrast follows how hard the stubble is laid, and that follows the intensity.
- **A faint stripe.** The lay first bent the blades as far as the wind's lean, and the stripes barely showed. Laid grass lies further over than wind bends it, at 1.2 of the blade's height.
- **A held frame was less mown than the playing lawn.** The mower first laid a round brush every 8 cm, at most 64 in a frame, so jumping to half mown took several frames, and the held frame showed the first of them. A brush is a pass along the row now.
- **The lay is not a bend.** Mown grass does not stand back up over seconds as trodden grass does, so it is a second vector in the trample field, which recovers only with `regrow`.

## Safety

Flash `none`, pattern `none`, `bold stripes` included: the stripes are a row wide and of low contrast, so the pattern analyser finds no grating, and nothing needs gating. Motion inside the caps. The shimmer test passes every preset. A held frame shows the lawn mown as far as the progress says, at once (see the pitfall below).

## When to use it

A playful progress bar ("mow the lawn"), or a garden or outdoor brand's hero with a lawn being cut behind the heading.

## References

- The physics of lawn stripes: the light reflected from grass bent towards and away from the viewer. Groundskeepers' "striping" kits press the grass flat the same way.
