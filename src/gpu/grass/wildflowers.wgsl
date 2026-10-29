#include "wind.wgsl"

// Story 11.6: which wildflower grows where. Each species has a drift map of its own, so a meadow
// has patches of poppies here and of daisies there, rather than a sprinkling of everything
// everywhere: at a ground point the species whose map is highest grows, as thickly as its map is
// high. `flower_mix` weights the species (ox-eye daisy, buttercup, poppy, cornflower). Shared by the
// blades (field.wgsl) and the far canopy (ground.wgsl), so a drift of poppies reads red into the
// distance. Needs `F: Field`. Twin of `wildflowerAt` in src/gpu/grass/place.ts.

const FLOWER_SPECIES: u32 = 4u;

struct Wildflower {
  species: u32,
  /** 0 outside its drifts to 1 at their heart. */
  density: f32,
}

fn wildflower_at(p: vec2f) -> Wildflower {
  var best = 0u;
  var top = 0.0;
  for (var k = 0u; k < FLOWER_SPECIES; k++) {
    let offset = vec2f(f32(k) * 17.3, f32(k) * 5.1);
    let n = value_noise(p / 4.5 + offset, F.seed + 21u + k) * F.flower_mix[k];
    if (n > top) {
      top = n;
      best = k;
    }
  }
  return Wildflower(best, smoothstep(0.4, 0.75, top));
}
