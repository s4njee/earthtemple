#include "trample-params.wgsl"

// Stories 2.5 and 3.4: grass that something has pushed over and that springs back, and grass that
// a mower has cut and laid. Twin of src/gpu/wind/trample.ts.
//
// Kept per cell of ground, not per blade, after Snow Temple's footprint field, so the cost is the
// area pressed, not the blades drawn. A cell holds two vectors on the ground, in blade heights:
//
// - xy, the bend. A brush (the pointer, a foot, a page element resting on the grass) pushes the
//   cells under it towards its own bend: along its motion, or out from its centre, never harder
//   than it pushes. Grass rises back slowly and without bouncing: an overdamped spring, the bend
//   decaying by exp(-dt / tau). Below a thousandth of a height it is exactly zero.
// - zw, the lay. A mower cuts the grass and lays it in its direction of travel, and the lay stays:
//   its length is how much of the blade was cut, its direction which way the stubble leans. It
//   fades only as the grass regrows (`regrow`, 0 for never). Mown stripes are rows of lay in
//   alternating directions. A mower's brush is a pass, a capsule from `motion.w - 1` back along
//   its direction to the brush, so a whole row is one brush.
//
// The cells are a window of the ground around the camera, addressed modulo its size, so the window
// moves with the camera without copying.

@group(0) @binding(0) var<uniform> T: TrampleParams;
@group(0) @binding(1) var<storage, read_write> cells: array<vec4f>;

@compute @workgroup_size(8, 8) fn step(@builtin(global_invocation_id) id: vec3u) {
  let n = i32(T.size);
  if (id.x >= T.size || id.y >= T.size) { return; }
  let s = vec2i(id.xy);
  // The world cell stored at s: the one in the window [origin, origin + n) congruent to s.
  let w = T.origin + ((s - T.origin) % n + n) % n;
  let centre = (vec2f(w) + 0.5) * T.cell;
  let i = id.y * T.size + id.x;
  let old = cells[i];
  var b = old.xy * exp(-T.dt / T.tau);
  var lay = old.zw;
  if (T.regrow > 0.0) { lay *= exp(-T.dt / T.regrow); }
  for (var k = 0u; k < T.count; k++) {
    let brush = T.brushes[k];
    if (brush.w <= 0.0) { continue; }
    let motion = T.motions[k];
    var d = distance(centre, brush.xy);
    if (motion.w > 0.5) {
      // A mower's pass: the distance to its path, from `length` (w - 1) back along it.
      let s = clamp(dot(brush.xy - centre, motion.xy), 0.0, motion.w - 1.0);
      d = distance(centre, brush.xy - motion.xy * s);
    }
    if (d >= brush.z) { continue; }
    let q = 1.0 - (d / brush.z) * (d / brush.z);
    let outward = select(vec2f(1.0, 0.0), (centre - brush.xy) / d, d > 1e-4);
    let dir = select(outward, motion.xy, motion.z > 0.5);
    if (motion.w > 0.5) {
      // A mower: everything under it is cut and laid its way, at the brush's strength.
      lay = mix(lay, dir * brush.w, saturate(4.0 * q));
      continue;
    }
    let goal = dir * brush.w * q * q;
    if (dot(goal, goal) > dot(b, b)) {
      b = mix(b, goal, 1.0 - exp(-T.dt * T.press));
    }
  }
  // Snapped last, so what a step leaves is either a real bend or exactly nothing.
  if (dot(b, b) < 1e-6) { b = vec2f(0.0); }
  if (dot(lay, lay) < 1e-6) { lay = vec2f(0.0); }
  cells[i] = vec4f(b, lay);
}
