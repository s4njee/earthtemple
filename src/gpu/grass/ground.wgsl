#include "field-params.wgsl"
#include "look-params.wgsl"
#include "grass-shade.wgsl"
#include "growth.wgsl"

// The ground under and beyond the blades (story 2.8): one quad on the ground, drawn before them
// into the same multisampled target.
//
// - Soil. Under the blades, where sparse grass shows it, lit as deep in the canopy.
// - Canopy. Where the blades thin out towards their reach, the ground becomes the canopy seen from
//   afar: the average of the same blade shading (grass-shade.wgsl) over a spread of pseudo-blades,
//   upper parts facing every way and leaning with the wind. Gusts tilt them together, so their
//   sheen travels across the far field as waves, as on a real meadow. Fitted to the blades by
//   construction, since it is their own model, so the two meet without a seam.
// - Over the page (`ground_mode` 0), the soil fades out with distance instead, and there is no
//   canopy: a strip's ground never draws a horizon line.

@group(0) @binding(0) var<uniform> F: Field;
@group(0) @binding(2) var<uniform> L: Look;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
}

struct Fragment {
  @location(0) colour: vec4f,
  @location(1) depth: f32,
}

@vertex fn ground_vs(@builtin(vertex_index) v: u32) -> Varying {
  let corner = vec2f(f32(v & 1u), f32(v >> 1u));
  let xz = mix(F.ground.xy, F.ground.zw, corner);
  let world = vec3f(xz.x, 0.0, xz.y);
  var out: Varying;
  out.position = F.view_proj * vec4f(world, 1.0);
  out.world = world;
  return out;
}

const PSEUDO: u32 = 6u;

/** The far canopy at a ground point: the mean of the blade shading over pseudo-blades. */
fn canopy(p: vec2f) -> vec3f {
  let wind = wind_now_ground();
  let g = select(0.0, gustiness(p, wind), has(F.flags, GUSTS));
  let lean = F.wind_dir * (F.wind_lean + F.wind_gust * g + F.lean * 0.5);
  var sum = vec3f(0.0);
  for (var k = 0u; k < PSEUDO; k++) {
    let a = (f32(k) + 0.5) / f32(PSEUDO) * 6.2831853;
    let face = vec3f(cos(a), 0.0, sin(a));
    // A blade's upper part, bent by the lean: its tangent and its normal, facing the viewer.
    let tangent = normalize(vec3f(lean.x, 1.0, lean.y));
    var n = normalize(face - tangent * dot(face, tangent));
    let v = normalize(F.eye - vec3f(p.x, 0.0, p.y));
    n = select(-n, n, dot(n, v) > 0.0);
    // Seen from afar, between the tips, some of each blade's lower, darker part shows too.
    let t = 0.35 + 0.5 * f32(k % 3u) / 2.0;
    let kind = select(0.0, 1.0, f32(k) / f32(PSEUDO) < F.dry && has(F.flags, DRY));
    let s = blade_surface(kind, 0.5, t, 0.0);
    sum += shade_surface(s, n, tangent, vec3f(p.x, t * L.canopy_height, p.y), 0.0);
  }
  return sum / f32(PSEUDO);
}

fn wind_now_ground() -> Wind {
  return Wind(F.wind_dir, F.wind_lean, F.wind_gust, F.gust_speed, F.gust_scale, F.flutter, F.time);
}

@fragment fn ground_fs(in: Varying) -> Fragment {
  let d = distance(in.world, F.eye);
  // Under grass the soil sees little sun or sky. Where a growing lawn has not come up yet, it is
  // open ground, lit as if above the canopy, and its clods show.
  let up = vec3f(0.0, 1.0, 0.0);
  let along = vec3f(1.0, 0.0, 0.0);
  var soil = shade_surface(Surface(L.soil, vec3f(0.0)), up, along, in.world, 0.0);
  if (F.growth >= 0.0) {
    let bare = 1.0 - grown_at(in.world.xz, 0.0);
    // Two scales of noise, the finer turned against the coarser, so no lattice lines up.
    let q = in.world.xz;
    let r = vec2f(0.8 * q.x - 0.6 * q.y, 0.6 * q.x + 0.8 * q.y);
    let grain = 0.6 * value_noise(q * 6.0, 31u) + 0.4 * value_noise(r * 17.0, 37u);
    let clods = L.soil * mix(0.7, 1.15, grain);
    let open = shade_surface(Surface(clods, vec3f(0.0)), up, along, vec3f(in.world.x, L.canopy_height, in.world.z), 0.0);
    soil = mix(soil, open, bare);
  }
  if (L.ground_mode < 0.5) {
    let a = 1.0 - smoothstep(0.35 * F.fade, 0.8 * F.fade, d);
    return Fragment(vec4f(soil * a, a), d);
  }
  // A growing lawn's canopy comes in with its blades.
  let far = smoothstep(0.55 * F.reach, 0.95 * F.reach, d) * grown_at(in.world.xz, 0.12);
  var colour = soil;
  if (far > 0.0) { colour = mix(soil, canopy(in.world.xz), far); }
  return Fragment(vec4f(colour, 1.0), d);
}
