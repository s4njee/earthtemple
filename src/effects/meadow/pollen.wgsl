#include "hash.wgsl"
#include "pollen-params.wgsl"

// Pollen and seed fluff hanging in the air over the meadow, lit by the sun: bright when it is
// behind them (forward scattering, a Henyey-Greenstein lobe), faint otherwise. Each mote is far
// smaller than a pixel. Drawn as a soft disc at least a pixel across, or as wide as its blur out
// of focus, its light divided over the disc so a mote's brightness does not change as it drifts
// nearer or farther (Moon Temple's energy-conserving points). A mote behind a blade is hidden,
// by the grass strip's distance.

@group(0) @binding(0) var<uniform> P: PollenParams;
@group(0) @binding(1) var distances: texture_2d<f32>;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) @interpolate(flat) light: vec3f,
  @location(2) @interpolate(flat) depth: f32,
}

@vertex fn pollen_vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Varying {
  let h = to_unorm_3d(pcg_3d(vec3u(i, 77u, 5u)));
  let g = to_unorm_3d(pcg_3d(vec3u(i, 78u, 6u)));
  // A box ahead of the eye, wrapped, drifting with the wind and bobbing.
  let span = vec3f(16.0, 1.8, 18.0);
  var p = h * span + vec3f(P.wind.x, 0.0, P.wind.y) * P.time * mix(0.2, 0.5, g.x);
  p.y += 0.15 * sin(P.time * mix(0.3, 0.7, g.y) + g.z * 6.28);
  // The box: across the view, from just above the ground, from a metre ahead of the eye.
  let origin = vec3f(P.eye.x - 0.5 * span.x, 0.05, P.eye.z + 1.0);
  p = p - span * floor((p - origin) / span);
  let clip = P.view_proj * vec4f(p, 1.0);
  let d = distance(p, P.eye);
  var out: Varying;
  if (clip.w < 0.05) {
    out.position = vec4f(0.0, 0.0, 2.0, 1.0);
    return out;
  }
  let pixels = 0.0006 * mix(0.6, 1.4, g.z) * P.focal / clip.w;
  let blur = min(P.max_radius, P.aperture * abs(1.0 - P.focus / d));
  let radius = max(max(pixels, 0.75), blur * 0.5);
  let corner = vec2f(f32(v & 1u), f32(v >> 1u)) * 2.0 - 1.0;
  out.position = clip + vec4f(corner * radius * 2.0 / P.viewport * clip.w, 0.0, 0.0);
  out.local = corner;
  let view = normalize(p - P.eye);
  let mu = dot(view, P.sun_dir);
  let gg = 0.65;
  let phase = (1.0 - gg * gg) / pow(1.0 + gg * gg - 2.0 * gg * mu, 1.5);
  let energy = (pixels / radius) * (pixels / radius);
  out.light = (P.sun * 0.6 * phase + P.sky * 0.4) * energy * P.amount;
  out.depth = d;
  return out;
}

@fragment fn pollen_fs(in: Varying) -> @location(0) vec4f {
  let row = i32(in.position.y) - i32(P.strip_top);
  if (row >= 0) {
    let behind = textureLoad(distances, vec2i(i32(in.position.x), row), 0).r;
    if (in.depth > behind) { discard; }
  }
  let r2 = dot(in.local, in.local);
  if (r2 > 1.0) { discard; }
  let a = (1.0 - r2) * (1.0 - r2) * 2.0;
  return vec4f(in.light * a, 0.0);
}
