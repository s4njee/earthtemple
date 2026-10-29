## How it works

Grass growing along the top edges of the page's own elements, marked `data-et-obstacle` (`dom-rects.ts`), and along the bottom of the canvas. Up to 24 edges, at most 12,000 blades, in one instanced draw of flat 2D blades in pixels (`edges.wgsl`). There is no compute and nothing kept from frame to frame.

An instance finds its edge from the running counts of blades per edge, then its root, jittered across three slots. One blade to a slot is a grating (story 2.10).

- **Growth.** Each blade sprouts at its own moment of the progress (time or scroll) and grows to its height over a short while, so an edge greens unevenly, then fills. The plan imagined Snow Temple's per-column rows holding a length, as they held snow. Grass does not slide or pile, so a blade's length is a pure function of the growth, and nothing per column needs keeping.
- **Wind.** A wave of gusts travels along the page in screen space (the field's `ground_wind`), and each blade sways a little on its own, so neighbours lean together.
- **The pointer** parts it: blades near it and below it bend away sideways.
- **Shading.** Leaf colours from the meadow's pigments (`src/gpu/optics/leaf.ts`), root to tip, lit across the blade as if folded, with a little light through the tip. Edges are softened over a pixel from the blade's own width, so it needs no multisampling. Tips narrower than a pixel are drawn a pixel wide with their coverage reduced, so they neither vanish nor shimmer.

## Cost

0.24 ms per frame at 1080p on Dawn, and 1.99 ms in Chrome (1.86 to 2.54 over 5 loads, though other runs read as little as 0.6: a light effect's HUD time sits near Chrome's timing floor). **Tier A**. Twice the density costs 0.26 ms.

## Pitfalls

- **A canvas in a card cannot see the page.** In the gallery's cards layout the canvas sits in a card slot, and the marked elements are elsewhere, so it drew only the bottom edge. Its layout is the hero, where the canvas lies over the copy.
- **Blades one to a slot are a grating.** Jittered across three slots, they are not.

## Safety

Flash `none`, pattern `none`, motion inside the caps. The shimmer test passes every preset. Held, the grass is fully grown and still, unless the scroll grows it: scrolling is the visitor's own motion, so a held frame keeps the scroll's growth.

## When to use it

A spring hero: grass on the headline and the call to action, growing in as the page loads or scrolls. Tier A cost, so it can sit on any page with a few marked elements.
