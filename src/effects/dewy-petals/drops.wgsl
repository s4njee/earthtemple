#include "drop-params.wgsl"

// Story 12.8's dew: each drop a near-sphere sitting on a petal (rose petals are the textbook
// hydrophobic surface, contact angles near 150°, Feng et al.'s "petal effect"), drawn as a disc
// facing the camera over the sharp picture of the flower. Water Temple's drop optics (its
// droplets.wgsl): a drop is a strong lens, so it shows a flipped, shrunk view of what is around and
// behind it, sampled from the sharp picture at -local * radius * strength; its edge is dark, where
// light leaves at grazing angles; the sun makes a glint near its top and the light it gathers lands
// as a bright crescent on its far side. A drop hidden behind a nearer petal is dropped by comparing
// its distance with the petal's.

struct Drop {
  /** Centre in the flower's frame, m, and radius. */
  c: vec4f,
}

@group(0) @binding(0) var<uniform> D: DropParams;
@group(0) @binding(1) var<storage, read> drops: array<Drop>;
@group(0) @binding(2) var sharp: texture_2d<f32>;
@group(0) @binding(3) var distances: texture_2d<f32>;
@group(0) @binding(4) var samp: sampler;

struct DropVarying {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) centre: vec3f,
  @location(2) @interpolate(flat) radius: f32,
  @location(3) @interpolate(flat) pixels: f32,
}

@vertex fn drop_vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> DropVarying {
  let d = drops[i];
  // The flower turns, and its dew with it.
  let c = cos(D.yaw);
  let s = sin(D.yaw);
  let centre = vec3f(c * d.c.x + s * d.c.z, d.c.y, -s * d.c.x + c * d.c.z);
  let corner = vec2f(f32(v & 1u), f32(v >> 1u)) * 2.0 - 1.0;
  let to_eye = normalize(D.eye - centre);
  let right = normalize(cross(vec3f(0.0, 1.0, 0.0), to_eye));
  let up = cross(to_eye, right);
  let world = centre + (right * corner.x + up * corner.y) * d.c.w;
  var out: DropVarying;
  out.position = D.view_proj * vec4f(world, 1.0);
  out.local = corner;
  out.centre = centre;
  out.radius = d.c.w;
  let clip = D.view_proj * vec4f(centre, 1.0);
  let edge = D.view_proj * vec4f(centre + right * d.c.w, 1.0);
  out.pixels = length((edge.xy / edge.w - clip.xy / clip.w) * 0.5 * D.viewport);
  return out;
}

@fragment fn drop_fs(in: DropVarying) -> @location(0) vec4f {
  let r2 = dot(in.local, in.local);
  if (r2 > 1.0) { discard; }
  // Hidden behind a nearer petal: the petal's distance here is well short of the drop's.
  let px = vec2i(in.position.xy);
  let behind = textureLoad(distances, px, 0).r;
  let near = length(D.eye - in.centre) - in.radius * sqrt(1.0 - r2);
  if (behind < near - 1.5 * in.radius) { discard; }
  let size = vec2f(textureDimensions(sharp));
  let uv = in.position.xy / size;
  // A lens: the picture round it, flipped and shrunk.
  let lens = -in.local * in.pixels * D.strength / size;
  var seen = textureSampleLevel(sharp, samp, uv + lens, 0.0).rgb;
  // A water sphere's normal, its Fresnel edge darkening and brightening by turns.
  let n = vec3f(in.local.x, in.local.y, sqrt(1.0 - r2));
  let rim = r2 * r2;
  seen *= 1.0 - 0.7 * rim;
  let fresnel = 0.02 + 0.98 * pow(1.0 - n.z, 5.0);
  seen = mix(seen, D.sky, fresnel * 0.6);
  // The light it gathers, a crescent on its side away from the sun, and the sun's glint.
  let away = -normalize(D.sun_screen + vec2f(1e-5, 0.0));
  let crescent = smoothstep(0.35, 0.95, dot(in.local, away)) * smoothstep(1.0, 0.75, sqrt(r2));
  seen += D.sun * 0.12 * crescent;
  let glint_at = normalize(D.sun_screen + vec2f(1e-5, 0.0)) * 0.45;
  let g = in.local - glint_at;
  let glint = exp(-dot(g, g) * 90.0);
  seen += D.sun * glint * 1.2;
  // A soft edge, a pixel wide.
  let edge = saturate((1.0 - sqrt(r2)) * in.pixels);
  return vec4f(seen * edge + textureSampleLevel(sharp, samp, uv, 0.0).rgb * (1.0 - edge), 1.0);
}
