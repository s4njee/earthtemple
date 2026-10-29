#include "hash.wgsl"
#include "wind.wgsl"
#include "params.wgsl"

// Story 3.5: grass growing along the top edges of the page's own elements (and along the bottom
// of the canvas, the ground). One instanced draw of 2D blades, in pixels. An instance finds its
// edge by the running counts in `starts`; a blade is rooted at a jittered place along it, anywhere
// across three slots (one to a slot is a grating: story 2.10).
//
// - Growth. Each blade sprouts at its own moment of the progress (time or scroll) and grows to its
//   height over a short while, so an edge greens unevenly, then fills.
// - Wind. A wave of gusts travels along the page in screen space, and each blade sways a little on
//   its own: neighbours lean together, as in the field's ground wind.
// - The pointer parts it: blades near it, below it, bend away sideways.
// - Shading. Leaf colours from the pigments (the field's species), root to tip, lit across the blade
//   as if folded, its tip glowing a little with light through it. Edges are softened over a pixel
//   from the blade's own width, so it needs no multisampling.

@group(0) @binding(0) var<uniform> params: Params;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) t: f32,
  @location(1) across: f32,
  @location(2) @interpolate(flat) tone: f32,
  @location(3) half_px: f32,
}

const ROWS: u32 = 5u;

@vertex fn blade_vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Varying {
  var out: Varying;
  // Which edge: the last whose start is at or before i.
  var e = 0u;
  for (var k = 1u; k < u32(params.edges); k++) {
    if (f32(i) >= params.starts[k].x) { e = k; }
  }
  let edge = params.edge[e];
  let local = f32(i) - params.starts[e].x;
  let h = hash_2to3(vec2f(f32(i), edge.w));
  let g = hash_2to3(vec2f(f32(i) + 0.5, edge.w + 7.0));
  let slot = params.spacing;
  let x0 = edge.x + (local + 3.0 * h.x - 1.0) * slot;
  if (x0 < edge.x || x0 > edge.y) {
    out.position = vec4f(0.0, 0.0, 2.0, 1.0);
    return out;
  }
  // Growth: this blade's own moment, then a short rise.
  let grown = smoothstep(0.0, 0.25, params.growth - 0.7 * g.x);
  let tall = params.tall * mix(0.45, 1.0, h.y * h.y) * grown;
  if (tall < 0.5) {
    out.position = vec4f(0.0, 0.0, 2.0, 1.0);
    return out;
  }
  let tip = v >= 2u * ROWS;
  let t = select(f32(v / 2u) / f32(ROWS), 1.0, tip);
  let side = select(select(-1.0, 1.0, (v & 1u) == 1u), 0.0, tip);
  // The wind, in screen space: a gust wave along the page and the blade's own sway.
  let w = Wind(vec2f(1.0, 0.0), params.lean, params.gust, params.speed, params.scale, params.flutter, params.time);
  let freq = mix(1.4, 2.2, h.z);
  let air = ground_wind(vec2f(x0, edge.z), w, freq, g.y * 6.2831853);
  var lean = (h.z - 0.5) * 0.45 + air.x;
  // The pointer: below it and near it across, the blades bend away.
  let dx = x0 - params.pointer.x;
  let above = smoothstep(edge.z + 0.5 * tall, edge.z - tall, params.pointer.y);
  let near = exp(-(dx * dx) / (params.pointer.z * params.pointer.z));
  lean += sign(dx) * params.pointer.w * above * near;
  lean = clamp(lean, -1.3, 1.3);
  // Bent along a curve that keeps its length roughly: the tip leans `lean` of the height sideways
  // and drops as it leans.
  let drop = 1.0 - 0.35 * lean * lean;
  let p = vec2f(x0 + lean * tall * t * t, edge.z - tall * drop * t);
  let tangent = normalize(vec2f(2.0 * lean * tall * t, -tall * drop));
  let normal = vec2f(-tangent.y, tangent.x);
  let half_width = 0.5 * params.blade * mix(0.7, 1.3, g.z) * pow(1.0 - t, 0.7);
  // At least a pixel across, so a thin tip neither vanishes nor shimmers; its coverage follows.
  let drawn = max(half_width, 0.5);
  let at = p + normal * side * (drawn + 0.75);
  out.position = vec4f(at.x / params.width * 2.0 - 1.0, 1.0 - at.y / params.height * 2.0, 0.0, 1.0);
  out.t = t;
  out.across = side * (drawn + 0.75);
  out.tone = h.y;
  out.half_px = half_width;
  return out;
}

@fragment fn blade_fs(in: Varying) -> @location(0) vec4f {
  // Coverage across the blade, soft over a pixel at its edges, and less than full where the blade
  // is narrower than its drawn pixel.
  let edge = max(in.half_px, 0.5);
  let cover = saturate(edge + 0.5 - abs(in.across)) * min(1.0, in.half_px * 2.0 + 0.15);
  let t = saturate(in.t);
  var colour = mix(params.base, mix(params.tip_lush, params.tip_pale, in.tone), pow(t, 0.8));
  // Folded: lit on one side of the midrib; the tip lit through.
  let fold = 0.75 + 0.35 * clamp(in.across / edge, -1.0, 1.0);
  colour = colour * fold * params.light + params.glow * params.transmit * pow(t, 2.0);
  return vec4f(colour * cover, cover);
}
