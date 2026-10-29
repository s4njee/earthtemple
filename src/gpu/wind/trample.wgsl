#include "trample-params.wgsl"

// Story 2.5: grass that something has pushed over, and that springs back. Twin of
// src/gpu/wind/trample.ts.
//
// The bend is kept per cell of ground, not per blade, after Snow Temple's footprint field: a vector
// on the ground in blade heights, the tip's push. Every blade rooted in a cell takes its bend, so
// the cost is the area pressed, not the blades drawn.
//
// - Pressing. A brush (the pointer, or a page element resting on the grass) pushes the cells under
//   it towards its own bend: along its motion, or out from its centre. Never harder than it pushes:
//   a cell already bent further is left to recover.
// - Recovering. Grass rises back slowly and without bouncing: an overdamped spring, the bend
//   decaying by exp(-dt / tau), tau set by the grass's stiffness. Below a thousandth of a height it
//   is exactly zero, so a pressed field returns to nothing.
//
// The cells are a window of the ground around the camera, addressed modulo its size, so the window
// moves with the camera without copying: a cell that wraps round has long since recovered.

@group(0) @binding(0) var<uniform> T: TrampleParams;
@group(0) @binding(1) var<storage, read_write> bend: array<vec2f>;

@compute @workgroup_size(8, 8) fn step(@builtin(global_invocation_id) id: vec3u) {
  let n = i32(T.size);
  if (id.x >= T.size || id.y >= T.size) { return; }
  let s = vec2i(id.xy);
  // The world cell stored at s: the one in the window [origin, origin + n) congruent to s.
  let w = T.origin + ((s - T.origin) % n + n) % n;
  let centre = (vec2f(w) + 0.5) * T.cell;
  let i = id.y * T.size + id.x;
  var b = bend[i] * exp(-T.dt / T.tau);
  for (var k = 0u; k < 4u; k++) {
    let brush = T.brushes[k];
    if (brush.w <= 0.0) { continue; }
    let d = distance(centre, brush.xy);
    if (d >= brush.z) { continue; }
    let q = 1.0 - (d / brush.z) * (d / brush.z);
    let motion = T.motions[k];
    let outward = select(vec2f(1.0, 0.0), (centre - brush.xy) / d, d > 1e-4);
    let dir = select(outward, motion.xy, motion.z > 0.5);
    let goal = dir * brush.w * q * q;
    if (dot(goal, goal) > dot(b, b)) {
      b = mix(b, goal, 1.0 - exp(-T.dt * T.press));
    }
  }
  // Snapped last, so what a step leaves is either a real bend or exactly nothing.
  if (dot(b, b) < 1e-6) { b = vec2f(0.0); }
  bend[i] = b;
}
