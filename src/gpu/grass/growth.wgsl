#include "hash.wgsl"
#include "wind.wgsl"

// Story 3.7: when a growing lawn's front reaches a ground point. Seeded patches `growth_cell` apart
// start at their own moments (up to `growth_spread`) and spread at `growth_speed`; the earliest of
// the nearby patches' arrivals wins, roughened by a little noise so the patches' edges are ragged,
// as sown grass comes up. Shared by the blades (field.wgsl) and the canopy beyond them (ground.wgsl).
// Needs `F: Field`. Twin of `arrival` in src/gpu/grass/place.ts.

fn arrival(p: vec2f) -> f32 {
  let base = vec2i(floor(p / F.growth_cell));
  var best = 1e9;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = base + vec2i(i, j);
      let h = to_unorm_3d(pcg_3d(vec3u(bitcast<vec2u>(c), F.seed ^ 0x6b43a9u)));
      let seed = (vec2f(c) + h.xy) * F.growth_cell;
      best = min(best, h.z * F.growth_spread + distance(p, seed) / F.growth_speed);
    }
  }
  return best + 0.6 * value_noise(p * 2.5, F.seed + 17u);
}

/** How grown the grass at p is, 0 to 1, with a blade's own lag `lag` (0 to 0.25). */
fn grown_at(p: vec2f, lag: f32) -> f32 {
  if (F.growth < 0.0) { return 1.0; }
  return smoothstep(0.0, 0.6, F.growth - arrival(p) - lag);
}
