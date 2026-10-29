#include "dof-params.wgsl"

// Depth of field for the meadow: the nearest blades out of focus, as a photograph shows them. A
// gather over a Vogel disc, each tap counted where its own circle of confusion reaches this pixel
// (scatter as gather), so a blurred near blade spreads over the sharp field behind it. A farther tap
// counts only as far as this pixel is itself blurred, so the sharp field does not bleed forwards.
// Distance comes from the grass strip's distance target; above the strip it is the sky.

@group(0) @binding(0) var<uniform> D: DofParams;
@group(0) @binding(1) var sharp: texture_2d<f32>;
@group(0) @binding(2) var distances: texture_2d<f32>;

@vertex fn dof_vs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((v << 1u) & 2u), f32(v & 2u)) * 2.0 - 1.0;
  return vec4f(p, 0.0, 1.0);
}

fn distance_at(p: vec2i) -> f32 {
  let row = p.y - i32(D.strip_top);
  if (row < 0) { return 1e4; }
  return textureLoad(distances, vec2i(p.x, row), 0).r;
}

fn coc(d: f32) -> f32 {
  return min(D.max_radius, D.aperture * abs(1.0 - D.focus / max(d, 0.01)));
}

const TAPS: u32 = 40u;

@fragment fn dof_fs(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let size = vec2i(textureDimensions(sharp));
  let p = vec2i(at.xy);
  let own = coc(distance_at(p));
  let here = distance_at(p);
  var sum = textureLoad(sharp, p, 0);
  var weight = 1.0;
  if (D.max_radius < 0.5) { return sum; }
  for (var k = 0u; k < TAPS; k++) {
    let r = sqrt((f32(k) + 0.5) / f32(TAPS)) * D.max_radius;
    let a = f32(k) * 2.39996323;
    let q = clamp(p + vec2i(round(vec2f(cos(a), sin(a)) * r)), vec2i(0), size - 1);
    let dq = distance_at(q);
    let cq = coc(dq);
    let reach = select(min(cq, own), cq, dq < here);
    let w = saturate(reach - r + 1.0);
    sum += textureLoad(sharp, q, 0) * w;
    weight += w;
  }
  return sum / weight;
}
