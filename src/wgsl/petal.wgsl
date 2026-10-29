// Story 11.1: a petal's surface, twin of src/gpu/flower/petal.ts (which has the model's notes).
// (u, v): u 0 at the base to 1 at the tip, v -1 to 1 across. The petal lies along +y with its
// inner face towards +z, its base at the origin, in units of its length.

struct PetalShape {
  width: f32,
  widest: f32,
  tip: f32,
  claw: f32,
  notch: f32,
  cup: f32,
  curl: f32,
  excess: f32,
  fringe: f32,
  roll: f32,
  wrap: f32,
}

fn petal_half_width(s: PetalShape, u: f32) -> f32 {
  let b = 0.5 + s.tip;
  let w = clamp(s.widest, 0.05, 0.95);
  let a = b * w / (1.0 - w);
  let peak = pow(w, a) * pow(1.0 - w, b);
  let x = clamp(u, 0.0, 1.0);
  var h = pow(x, a) * pow(max(1.0 - x, 0.0), b) / peak;
  if (s.claw > 0.0) {
    h = max(h, 0.0) * smoothstep(0.0, s.claw * 1.6, x) +
      (1.0 / 6.0) * (1.0 - smoothstep(s.claw * 0.6, s.claw * 1.6, x));
  }
  return 0.5 * s.width * h;
}

/** The ruffle's wavelength and amplitude, in lengths; amplitude 0 for no excess. */
fn petal_ruffle(s: PetalShape) -> vec2f {
  if (s.excess <= 0.0) { return vec2f(1.0, 0.0); }
  let band = max(s.fringe, 0.02) * 0.5 * s.width;
  let wavelength = 2.2 * band / pow(s.excess, 0.25);
  return vec2f(wavelength, wavelength * sqrt(s.excess) / 3.14159265);
}

fn petal_point(s: PetalShape, u: f32, v: f32) -> vec3f {
  let h = petal_half_width(s, u);
  var x = v * h;
  let y = u * (1.0 - s.notch * (1.0 - v * v) * pow(u, 6.0));
  var z = s.cup * h * v * v;
  // The rolled margin, bent back on an arc past 0.55 of the half-width.
  let turn = s.roll * 3.14159265 * smoothstep(0.3, 0.9, u);
  if (turn > 1e-4 && abs(v) > 0.55 && h > 0.0) {
    let rho = 0.45 * h / turn;
    let w = (abs(v) - 0.55) * h;
    let phi = w / rho;
    x += sign(v) * (rho * sin(phi) - w);
    z -= rho * (1.0 - cos(phi));
  }
  // The wrap: across on an arc, keeping its length.
  if (s.wrap > 1e-5) {
    let a = x * s.wrap;
    z += (1.0 - cos(a)) / s.wrap;
    x = sin(a) / s.wrap;
  }
  let r = petal_ruffle(s);
  if (r.y > 0.0) {
    let band = max(s.fringe, 0.02);
    let edge = exp(-(1.0 - abs(v)) / band) * smoothstep(0.0, 0.25, u);
    let phase = select(0.0, 1.7, v < 0.0);
    z += edge * r.y * sin(6.2831853 * u / r.x + phase);
  }
  if (abs(s.curl) < 1e-5) { return vec3f(x, y, z); }
  let radius = 1.0 / s.curl;
  let theta = s.curl * y;
  return vec3f(x, radius * sin(theta) - z * sin(theta), radius * (1.0 - cos(theta)) + z * cos(theta));
}
