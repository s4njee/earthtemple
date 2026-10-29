## How it works

The lawn (story 3.3) with a growth reveal in placement (`src/gpu/grass/growth.wgsl`). Seeded patches lie on a coarse grid 1.6 m apart, each starting at its own moment (up to 3 units of progress late). From its start, a patch's front spreads at 0.4 m a unit of progress. A point of ground is reached at the earliest of its nine nearest patches' arrivals, plus some value noise, so fronts are ragged and patches meet in uneven seams.

Once the front has passed a blade, the blade grows to its full height over a short while, with its own small lag. Blades not yet reached are not placed at all. The far canopy and the bare soil read the same arrival, so nothing in the distance is green before it has grown. Where the grass is thin, the ground is lit as open soil, with clods of two sizes of noise, rather than as the shadowed floor of a canopy.

The progress follows the page's scroll (all grown as the canvas leaves the top of the view), or a slow clock: 14 s growing, 5 s held, 9 s shrinking back the way it grew, 2 s bare.

## Cost

1.53 ms per frame at 1080p on Dawn, and 5.21 ms in Chrome (4.61 to 5.31 over 5 loads): **Tier B**. Ungrown cells cost a test and nothing more; placement reads the arrival from the nine nearest patches, about 0.5 ms.

## Pitfalls

- **Grown before it started.** The far canopy is a colour, not blades. Until it read the arrival too, the distance was green before any patch had sprouted.
- **Bare soil lit as a canopy floor.** Soil where no grass is had the deep canopy's darkness and read as a hole. It is lit as open ground.
- **Too fast to see.** At first the patches spread at 1.2 m a unit of progress, and the lawn looked fully grown a third of the way in.

## Safety

Flash `none`, pattern `none`, motion inside the caps. The shimmer test passes every preset. A held frame shows the lawn as grown as the moment it was held at.

## When to use it

An onboarding or sign-up progress, or a "growth" story on a landing page, following the scroll.

## References

- Snow Temple's and Temple of Time's arrival-time reveals, which this is a variant of.
