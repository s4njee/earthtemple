#include "hash.wgsl"
#include "field-params.wgsl"

// Story 12.6's field behind and beyond the tulips drawn whole: the sky, and the ground in its beds,
// each bed one cultivar, with bare furrows between. Near the camera the ground is the soil and
// leaves under the drawn tulips; out past them it takes its bed's colour, as heads seen across a
// field at a grazing angle cover it, and fades into the haze. The beds are the same as the tulips'
// placement (bedAt in index.ts), hash for hash.

@group(0) @binding(0) var<uniform> P: FieldParams;

struct FieldVarying {
  @builtin(position) position: vec4f,
  @location(0) ndc: vec2f,
}

@vertex fn field_vs(@builtin(vertex_index) i: u32) -> FieldVarying {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var out: FieldVarying;
  out.position = vec4f(p, 1.0, 1.0);
  out.ndc = p;
  return out;
}

/** Value noise on the integer lattice, for patchy beds. */
fn patch_noise(p: vec2f) -> f32 {
  let i = vec2i(floor(p));
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let h = array(
    to_unorm_1d(pcg_1d((u32(i.x + 8192) * 1973u) ^ (u32(i.y + 8192) * 9277u))),
    to_unorm_1d(pcg_1d((u32(i.x + 8193) * 1973u) ^ (u32(i.y + 8192) * 9277u))),
    to_unorm_1d(pcg_1d((u32(i.x + 8192) * 1973u) ^ (u32(i.y + 8193) * 9277u))),
    to_unorm_1d(pcg_1d((u32(i.x + 8193) * 1973u) ^ (u32(i.y + 8193) * 9277u))),
  );
  return mix(mix(h[0], h[1], u.x), mix(h[2], h[3], u.x), u.y);
}

/** The bed at x: 1 inside it (0 in a furrow), and its cultivar. */
fn bed_at(x: f32) -> vec2f {
  let k = i32(floor(x / P.period));
  let key = u32(k + 4096);
  let inset = 0.12 + 0.1 * to_unorm_1d(pcg_1d(key * 3u + 1u));
  let local = x - f32(k) * P.period;
  let inside = select(0.0, 1.0, local > inset && local < P.period - 0.6 * inset);
  let cultivar = f32(pcg_1d(key + P.seed * 7919u) % 6u);
  return vec2f(inside, cultivar);
}

@fragment fn field_fs(in: FieldVarying) -> @location(0) vec4f {
  let forward = vec3f(0.0, -sin(P.pitch), cos(P.pitch));
  let up = vec3f(0.0, cos(P.pitch), sin(P.pitch));
  let ray = normalize(forward + vec3f(1.0, 0.0, 0.0) * in.ndc.x / P.sx + up * in.ndc.y / P.sy);
  if (ray.y >= 0.0) {
    var rgb = mix(P.horizon, P.zenith, pow(min(ray.y * 1.8, 1.0), 0.55));
    rgb += P.sun * pow(max(dot(ray, P.sun_dir), 0.0), 32.0) * 0.12;
    return vec4f(rgb, 1.0);
  }
  let d = P.eye.y / -ray.y;
  let hit = P.eye + ray * d;
  let bed = bed_at(hit.x);
  // Bare soil in a furrow; in a bed, leaves and soil near, its flowers further off, where the
  // drawn tulips end.
  let under = mix(P.soil, P.leaf, 0.65 * bed.x);
  let flowers = P.colours[u32(bed.y)].rgb;
  // Patchy along the beds, where bulbs failed or flowered late.
  let patchy = 0.82 + 0.3 * (patch_noise(hit.xz * vec2f(0.9, 0.22)) - 0.5);
  let cover = bed.x * smoothstep(P.near - 2.5, P.near, d) * (0.6 + 0.3 * (1.0 - exp(-(d - P.near) / 10.0))) * patchy;
  let albedo = mix(under, flowers, cover);
  var rgb = albedo * (P.sun * max(P.sun_dir.y, 0.0) * 0.85 + P.sky);
  rgb = mix(rgb, P.horizon, 1.0 - exp(-d * P.haze));
  return vec4f(rgb, 1.0);
}
