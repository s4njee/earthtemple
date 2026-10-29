## How it works

A cherry branch that grows out across the view, buds and blossoms, then sheds its petals on the breeze (story 12.7), over time or as the page scrolls.

- **Space colonisation** (story 5.1, `src/gpu/plant/colonise.ts`, after Runions, Lane and Prusinkiewicz). Attractors fill a spray reaching up and across the view; each pulls its nearest node within 13 cm, a node grows a step of 1.2 cm towards the mean of its attractors (plus a little light-seeking), and an attractor is used up once a node comes within 2.8 cm. The branches compete for space, so they spread without crossing and fork where the attractors pull two ways.
- **Taper by the pipe model.** A parent's radius to the power 2.5 is the sum of its children's (Shinozaki's pipe model; Murray), from twigs 1.6 mm thick down to the base.
- **Growing.** Each segment is a tapered tube, instanced; it appears once the growth front, a path length from the root, has reached it, extends to its end and thickens behind the front, and each tube runs a little into its neighbours so a bend shows no seam.
- **Blossoms** stand on pedicels along the twigs, in clusters of one to three, from the shared flower renderer's cherry: the pedicel runs back along the nodded head's axis to its twig. Buds swell, open a little out of step, and let their petals go: a head sheds a share of its petals, chosen by a hash.
- **Falling petals** are the same petal alone, as a head of a diagram with one petal and no receptacle. Each falls at about half a metre a second, carried on the gusting breeze, fluttering side to side and tumbling about its own axis (story 4.3's petals).
- **Time.** The branch grows once; then every spring it buds, blossoms and sheds, and bare again it starts over, so the loop never jumps.

## Cost

On an Apple M1 Max at 1080p: 1.57 ms a frame on Dawn ([docs/studies/epic-12.md](../../../docs/studies/epic-12.md)) and 4.32 ms in Chrome (3.94 to 4.44 over 5 loads, [browser-check.md](../../../docs/studies/browser-check.md)): **Tier B**. About 1,100 tubes, 400 blossoms and up to 900 falling petals; a blossom's stamens are not drawn at its size.

## Pitfalls

- **Brooms.** Attractors pulling one node two ways made it grow child after child in the same place: thick stubs at branch ends and puffballs of blossom on them. A node now grows no child within half a step of one it has, and nothing where the pulls cancel.
- **Seams at bends.** Tubes ending flush showed a pale gap on the outside of every bend; they overlap their neighbours by most of a radius.

## Safety

Flash `none`, pattern `none`; the petals are small, and the branch grows slowly.

## When to use it

A spring or hanami page, a scroll story, a Japanese restaurant or tea brand.

## References

- Adam Runions, Brendan Lane and Przemyslaw Prusinkiewicz, "Modeling trees with a space colonization algorithm", Eurographics Workshop on Natural Phenomena (2007).
- Kichiro Shinozaki et al., "A quantitative analysis of plant form: the pipe model theory", _Japanese Journal of Ecology_ (1964).
- Cecil Murray, "A relationship between circumference and weight in trees and its bearing on branching angles", _Journal of General Physiology_ (1927).
