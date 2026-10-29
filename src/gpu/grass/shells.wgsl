#include "hash.wgsl"
#include "field-params.wgsl"
#include "look-params.wgsl"
#include "grass-shade.wgsl"

// Story 2.8: shells (Lengyel, Praun, Finkelstein and Hoppe, 2001). Beyond the blades' full detail,
// the grass is a stack of horizontal slices of the ground, each cut through a field of blades: a
// slice at height h shows the cross-sections of the blades taller than h, leaning with the wind.
// Where the blades thin out with distance, the shells fill in, so the coverage stays the same.
//
// Drawn as SHELLS instances of the ground quad, one per slice, over the band from `lod1` to
// `reach`. Seen from above, as a lawn is, they read as dense grass for a fraction of the blades'
// cost. Seen at the grazing angles of an eye-level view, the slices show edge-on as a stack of
// lines: story 2.8's question is whether that ever looks better than the canopy ground.

@group(0) @binding(0) var<uniform> F: Field;
@group(0) @binding(2) var<uniform> L: Look;

override SHELLS: u32 = 12u;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) world: vec3f,
  @location(1) @interpolate(flat) layer: f32,
}

@vertex fn shell_vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Varying {
  let corner = vec2f(f32(v & 1u), f32(v >> 1u));
  let lo = vec2f(F.ground.x, max(F.ground.y, F.eye.z + 0.8 * F.lod1));
  let hi = vec2f(F.ground.z, min(F.ground.w, F.eye.z + F.reach));
  let xz = mix(lo, hi, corner);
  let layer = (f32(i) + 0.5) / f32(SHELLS);
  let world = vec3f(xz.x, layer * 1.3 * L.canopy_height, xz.y);
  var out: Varying;
  out.position = F.view_proj * vec4f(world, 1.0);
  out.world = world;
  out.layer = layer;
  return out;
}

struct Fragment {
  @location(0) colour: vec4f,
  @location(1) depth: f32,
}

@fragment fn shell_fs(in: Varying) -> Fragment {
  let d = distance(in.world, F.eye);
  // The share of the grass the thinned blades no longer draw.
  let thin = F.fade / max(d, 1e-3);
  let keep = min(1.0, thin * thin);
  let h = in.world.y;
  // The wind leans each slice further over the higher it is.
  let wind = Wind(F.wind_dir, F.wind_lean, F.wind_gust, F.gust_speed, F.gust_scale, F.flutter, F.time);
  let lean = ground_wind(in.world.xz, wind, F.freq, 0.0) * h;
  let p = in.world.xz - lean;
  let cell = 1.6 * F.cell;
  let c = floor(p / cell);
  let r = to_unorm_3d(pcg_3d(vec3u(bitcast<vec2u>(vec2i(c)), F.seed ^ 0x51ed27u)));
  let centre = (c + 0.2 + 0.6 * r.xy) * cell;
  let tall = mix(F.height_min, F.height_max, r.z) * 1.1;
  let t = h / tall;
  let radius = 0.5 * F.width * 2.5 * pow(max(1.0 - t, 0.0), 0.6);
  if (t >= 1.0 || distance(p, centre) > radius || to_unorm_1d(pcg_1d(bitcast<u32>(r.x))) < keep) {
    discard;
  }
  let s = blade_surface(0.0, r.y, t, 0.0);
  let n = normalize(vec3f(F.eye.x - in.world.x, 0.0, F.eye.z - in.world.z));
  let colour = shade_surface(s, n, vec3f(0.0, 1.0, 0.0), in.world, 0.0);
  return Fragment(vec4f(colour, 1.0), d);
}
