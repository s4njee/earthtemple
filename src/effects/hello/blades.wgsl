#include "hash.wgsl"
#include "params.wgsl"

// Hello: a strip of grass along the bottom of the view, one instanced draw of flat 2D blades into
// the HDR scene. Every blade is a pure function of its index and the time, so there is no state
// and a held frame is exactly reproducible. Each blade is a curve of four rows, rooted at a
// jittered place along the bottom, narrowing to its tip. A slow wave of wind travels along the
// strip and each blade sways a little on its own. Premultiplied colour, blended "over".

@group(0) @binding(0) var<uniform> params: Params;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) t: f32,
  @location(1) @interpolate(flat) tone: f32,
}

const ROWS: u32 = 4u;

@vertex fn blade_vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Varying {
  let h = hash_2to3(vec2f(f32(i), 3.0));
  let tip = v >= 2u * ROWS;
  let t = select(f32(v / 2u) / f32(ROWS), 1.0, tip);
  let side = select(select(-1.0, 1.0, (v & 1u) == 1u), 0.0, tip);
  // Pixels: roots jittered along the bottom over three slots each, not one. A blade in each slot
  // is a row of evenly spaced stripes, which the pattern rule counts as a grating once the blades
  // are tall.
  let slot = params.width / params.count;
  let root = vec2f((f32(i) + 3.0 * h.x - 1.0) * slot, params.height + 2.0);
  let tall = params.tall * mix(0.45, 1.0, h.y * h.y);
  // The wind: a wave along the strip, plus the blade's own sway.
  let wave = 0.5 + 0.5 * sin(root.x / params.width * 9.0 - params.time * 0.9);
  let sway = 0.03 * sin(params.time * mix(1.4, 2.2, h.z) + h.x * 6.28);
  let lean = (h.z - 0.5) * 0.5 + params.wind * (0.15 + 0.35 * wave) + sway * params.wind * 4.0;
  // Bent along a parabola: the tip leans `lean` of the height sideways.
  let p = root + vec2f(lean * tall * t * t, -tall * t);
  let tangent = normalize(vec2f(2.0 * lean * tall * t, -tall));
  let across = vec2f(-tangent.y, tangent.x);
  let w = params.blade * mix(0.7, 1.3, h.x) * (1.0 - t);
  let at = p + across * side * 0.5 * w;
  var out: Varying;
  out.position = vec4f(at.x / params.width * 2.0 - 1.0, 1.0 - at.y / params.height * 2.0, 0.0, 1.0);
  out.t = t;
  out.tone = h.y;
  return out;
}

@fragment fn blade_fs(in: Varying) -> @location(0) vec4f {
  let base = vec3f(0.02, 0.06, 0.012);
  let tip = vec3f(0.18, 0.36, 0.07) * mix(0.8, 1.15, in.tone);
  return vec4f(mix(base, tip, in.t), 1.0);
}
