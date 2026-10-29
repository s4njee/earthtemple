// blade.wgsl -- a grass blade as a quadratic Bezier curve, after Jahrmann and Wimmer, "Responsive
// Real-Time Grass Rendering for General 3D Scenes" (I3D 2017). Twin of src/gpu/grass/blade.ts.
//
// A blade is three points: its root v0 on the ground, a guide v1 and its tip v2. The tip is where
// the forces put it; the guide follows from the tip, and then both are scaled about the root so
// the curve keeps the blade's length however far it bends.
//
//   bezier(v0, v1, v2, t) -> vec3f           the point at t (0 the root, 1 the tip)
//   bezier_tangent(v0, v1, v2, t) -> vec3f   its derivative (not normalised)
//   bezier_length(v0, v1, v2) -> f32         Jahrmann and Wimmer's estimate of the arc length
//   blade_shape(v0, tip, height) -> BladeCurve
//
// The ground is y = v0.y and up is +y.

struct BladeCurve {
  v1: vec3f,
  v2: vec3f,
}

fn bezier(v0: vec3f, v1: vec3f, v2: vec3f, t: f32) -> vec3f {
  return mix(mix(v0, v1, t), mix(v1, v2, t), t);
}

fn bezier_tangent(v0: vec3f, v1: vec3f, v2: vec3f, t: f32) -> vec3f {
  return 2.0 * ((1.0 - t) * (v1 - v0) + t * (v2 - v1));
}

// (2 L0 + (n - 1) L1) / (n + 1) for a curve of degree n = 2, where L0 is the chord and L1 the
// length of the control polygon.
fn bezier_length(v0: vec3f, v1: vec3f, v2: vec3f) -> f32 {
  let chord = distance(v0, v2);
  let polygon = distance(v0, v1) + distance(v1, v2);
  return (2.0 * chord + polygon) / 3.0;
}

// The tip is first kept above the ground. The guide sits above the root, lower the further the tip
// has moved sideways, so a blade bent flat curves from upright at its root. Then the guide and tip
// are scaled about the root to make the length `height` again. Scaling about the root keeps the tip
// above the ground: v2' = v0 + r (v2 - v0). Jahrmann and Wimmer's length estimate is close but not
// exact, so the scaling is done twice.
fn blade_shape(v0: vec3f, tip: vec3f, height: f32) -> BladeCurve {
  var v2 = tip;
  v2.y = max(v2.y, v0.y);
  let sideways = length(vec2f(v2.x - v0.x, v2.z - v0.z));
  let ratio = sideways / height;
  var v1 = v0 + vec3f(0.0, height * max(1.0 - ratio, 0.05 * max(ratio, 1.0)), 0.0);
  for (var k = 0; k < 2; k++) {
    let r = height / max(bezier_length(v0, v1, v2), 1e-6);
    let g = v0 + r * (v1 - v0);
    v2 = g + r * (v2 - v1);
    v1 = g;
  }
  return BladeCurve(v1, v2);
}
