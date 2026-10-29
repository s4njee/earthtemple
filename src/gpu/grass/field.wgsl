#include "hash.wgsl"
#include "blade.wgsl"
#include "wind.wgsl"
#include "field-params.wgsl"
#include "grass-flags.wgsl"
#include "growth.wgsl"
#include "wildflowers.wgsl"

// Stories 2.2 to 2.5: the grass field, grown afresh each frame in compute. Twin of
// src/gpu/grass/place.ts.
//
// One invocation per cell of a world-anchored grid on the ground, a blade's worth of ground each,
// over the patch the camera can see. A world cell always grows the same blade, so nothing
// reshuffles as the view moves:
//
// 1. Placement. The root is jittered over the whole of its cell, so there is no grid to see: a grid
//    is a lattice to the pattern rule. Density varies in soft patches.
// 2. Distance. Past `fade`, blades are kept with a probability falling as the inverse square of
//    distance, as the ground each pixel sees grows, and the ones kept are widened to keep the
//    field's coverage. Towards `reach` they go altogether, and the ground's canopy takes over.
// 3. Clumps (Ghost of Tsushima). The nearest of a jittered set of clump centres gives the blade's
//    clump, whose blades share a height scale and a facing, and lean away from its centre.
// 4. Kind. Most blades are leaves; some are dry; some are flowering stems, taller and thinner, with
//    a seed head or, in a meadow, a flower.
// 5. Culling. Outside the view (a sphere about the blade), or edge-on and too thin to see.
// 6. Wind, the trample field and the pointer bend the tip, and blade_shape keeps the length. A
//    mown cell's grass is cut shorter and leans the mower's way.
// 6b. Growth (story 3.7). When on, a blade grows in once the arrival time of a front spreading from
//    seeded patches has passed: patches start at their own moments and spread at a set speed.
// 7. The survivor is appended to the list for its distance band, the bands' edges dithered so a
//    change of LOD never runs along a line, and the band's instance count goes up by one. A flower
//    also goes to the fourth list, for its head.

struct Blade {
  v0: vec3f,
  width: f32,
  v1: vec3f,
  facing: f32,
  v2: vec3f,
  /**
   * The fraction is the blade's colour variation. The whole part is its kind: 0 a leaf, 1 dry,
   * 2 a stem with a seed head, 3 a stem with a flower.
   */
  tone: f32,
}

@group(0) @binding(0) var<uniform> F: Field;
@group(0) @binding(1) var<storage, read_write> blades: array<Blade>;
@group(0) @binding(2) var<storage, read_write> args: array<atomic<u32>, 16>;
@group(0) @binding(3) var<storage, read> trample: array<vec4f>;

/** How much of a blade a mower takes. */
const CUT: f32 = 0.55;
/** How far mown stubble leans its mower's way, in heights. */
const LAY: f32 = 1.2;

struct Clump {
  centre: vec2f,
  hash: vec3u,
}

fn clump_of(p: vec2f) -> Clump {
  let q = p / F.clump;
  let base = vec2i(floor(q));
  var best = 1e9;
  var out = Clump(vec2f(0.0), vec3u(0u));
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = base + vec2i(i, j);
      let h = pcg_3d(vec3u(bitcast<vec2u>(c), F.seed ^ 0x9e3779b9u));
      let centre = (vec2f(c) + to_unorm_2d(h.xy)) * F.clump;
      let d = distance(centre, p);
      if (d < best) {
        best = d;
        out = Clump(centre, h);
      }
    }
  }
  return out;
}

fn wind_now() -> Wind {
  let gust = select(0.0, F.wind_gust, has(F.flags, GUSTS));
  return Wind(F.wind_dir, F.wind_lean, gust, F.gust_speed, F.gust_scale, F.flutter, F.time);
}

fn trample_cell(c: vec2i) -> vec4f {
  let n = i32(F.trample_size);
  let rel = c - F.trample_origin;
  if (any(rel < vec2i(0)) || any(rel >= vec2i(n))) { return vec4f(0.0); }
  let s = (c % n + n) % n;
  return trample[u32(s.y * n + s.x)];
}

// Bilinear over the trample field's cells (bend, lay), zero outside its window.
fn trampled(p: vec2f) -> vec4f {
  if (F.trample_size == 0u) { return vec4f(0.0); }
  let u = p / F.trample_cell - 0.5;
  let c = vec2i(floor(u));
  let f = u - floor(u);
  return mix(
    mix(trample_cell(c), trample_cell(c + vec2i(1, 0)), f.x),
    mix(trample_cell(c + vec2i(0, 1)), trample_cell(c + vec2i(1, 1)), f.x),
    f.y,
  );
}

fn append(lod: u32, blade: Blade) {
  let index = atomicAdd(&args[lod * 4u + 1u], 1u);
  if (index < F.capacity) { blades[lod * F.capacity + index] = blade; }
}

@compute @workgroup_size(8, 8) fn place(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= F.count.x || id.y >= F.count.y) { return; }
  let cell = F.origin + vec2i(id.xy);
  let h1 = pcg_3d(vec3u(bitcast<vec2u>(cell), F.seed));
  let r1 = to_unorm_3d(h1);
  let root = (vec2f(cell) + r1.xy) * F.cell;
  let patchy = value_noise(root / 1.7, F.seed + 5u);
  if (r1.z >= F.density * mix(0.55, 1.0, patchy)) { return; }

  let h2 = pcg_3d(h1);
  let r2 = to_unorm_3d(h2);
  let v0 = vec3f(root.x, 0.0, root.y);
  let d = distance(v0, F.eye);
  let thin = F.fade / max(d, 1e-3);
  let keep = min(1.0, thin * thin) * (1.0 - smoothstep(0.75 * F.reach, F.reach, d));
  if (r2.x >= keep) { return; }

  let h3 = pcg_3d(h2);
  let r3 = to_unorm_3d(h3);
  let r4 = to_unorm_3d(pcg_3d(h3));
  // Without clumps, each blade is its own clump, centred on itself.
  var clump = Clump(root, h3);
  if (has(F.flags, CLUMPS)) { clump = clump_of(root); }
  let rc = to_unorm_3d(clump.hash);
  let stem = r4.y < F.stems;
  // Wildflowers grow in drifts, each species its own (story 11.6). Only a stem can carry one, and
  // the drift maps are four noises: only stems look them up.
  var wild = Wildflower(0u, 0.0);
  if (stem && F.flowers > 0.0) { wild = wildflower_at(root); }
  let flower = stem && r4.z < F.flowers * 2.0 * wild.density;
  let dry = !stem && has(F.flags, DRY) && r4.x < F.dry;
  var height = mix(F.height_min, F.height_max, r2.y) * mix(0.7, 1.3, rc.z);
  var width = F.width * mix(0.8, 1.2, r3.y) * inverseSqrt(max(keep, 0.05));
  if (stem) {
    height *= F.stem_height;
    width *= 0.45;
  }
  let facing = rc.x * 6.2831853 + (r2.z - 0.5) * 1.6;
  let pressed = trampled(root);
  height *= 1.0 - CUT * length(pressed.zw);
  if (F.growth >= 0.0) {
    let grown = grown_at(root, 0.25 * r3.x);
    if (grown < 0.03) { return; }
    height *= grown;
  }

  // In view: a sphere about the blade, against the clip planes.
  let centre = F.view_proj * vec4f(v0 + vec3f(0.0, 0.5 * height, 0.0), 1.0);
  let radius = height * (0.6 + F.lean + F.wind_lean + F.wind_gust);
  if (centre.w < -radius) { return; }
  let w = max(centre.w, 1e-3);
  let ndc = centre.xy / w;
  let margin = radius * F.scale / w;
  if (any(abs(ndc) > vec2f(1.0) + margin)) { return; }

  // Edge-on and too thin to see. The draw thickens thin blades to a pixel, so only the truly
  // invisible are dropped.
  let face = vec2f(cos(facing), sin(facing));
  let view = normalize(root - F.eye.xz);
  let pixels = width * F.focal / w;
  if (pixels * abs(dot(face, view)) < F.min_pixels) { return; }

  // Rest lean away from the clump's centre, then the wind, the trample field and the pointer.
  let outward = root - clump.centre;
  let from_centre = select(face, outward / max(length(outward), 1e-6), length(outward) > 1e-4);
  let lean = from_centre * F.lean * mix(0.5, 1.3, r3.z) * select(0.4, 1.0, !stem);
  let freq = F.freq * sqrt(0.25 / height) * mix(0.85, 1.15, r3.x);
  // A stiffer blade sways less, as a spring's displacement goes as one over its frequency squared:
  // short lawn grass barely flutters, tall meadow grass does. Fast flutter of bright blades against
  // a dark page is what shimmers (story 2.7).
  var air = wind_now();
  air.flutter *= clamp((1.6 / freq) * (1.6 / freq), 0.1, 1.2);
  let gust = ground_wind(root, air, freq, r3.z * 6.2831853);
  // The pointer parts the grass: a blade whose tip is above the pointer, near it across the view,
  // bends away from it along the view's right. Only the near blades: a hand in the grass, so the
  // gap shows the field behind rather than the page.
  let top = F.view_proj * vec4f(v0 + vec3f(0.0, height, 0.0), 1.0);
  let across = (top.x / max(top.w, 1e-3) - F.pointer.x) * F.aspect;
  let above = smoothstep(F.pointer.y - 0.15, F.pointer.y + 0.05, top.y / max(top.w, 1e-3));
  let near = 1.0 - smoothstep(0.7 * F.lod0, 1.3 * F.lod0, d);
  let push = F.pointer.w * above * near * exp(-(across * across) / (F.pointer.z * F.pointer.z));
  let part = F.right * sign(across) * push;
  let bend = lean + gust + pressed.xy + LAY * pressed.zw + part;
  let tip = v0 + vec3f(bend.x * height, height, bend.y * height);
  let curve = blade_shape(v0, tip, height);

  let variation = select(0.5, r3.x, has(F.flags, VARIATION));
  let kind = select(select(select(0.0, 1.0, dry), 2.0, stem), 3.0, flower);
  // Distance bands with dithered edges, so a change of LOD never runs along a line.
  let banded = d * (1.0 + (r4.x - 0.5) * F.lod_blend);
  let lod = select(select(2u, 1u, banded < F.lod1), 0u, banded < F.lod0);
  append(lod, Blade(v0, width, curve.v1, facing, curve.v2, kind + variation));
  if (flower) {
    // The head, at the stem's tip, facing along it; its size and its kind of flower. Not widened
    // with distance as the blades are: a flower is one thing, and fewer of them is enough.
    let size = mix(0.018, 0.035, r2.y);
    // Its tone is its species, and a little variety within it.
    append(3u, Blade(curve.v2, size, curve.v2 - curve.v1, facing, v0, f32(wild.species) + 0.5 * fract(r4.z * 7.31)));
  }
}

// First in the pass: the draw arguments (2 LEVELS + 1 vertices per LOD, 4 for a flower head, no
// instances yet). Done here rather than by a buffer write, so a command buffer holding several
// frames (a cost study's) starts each from zero: writes queued before it would all land before the
// first.
@compute @workgroup_size(1) fn reset() {
  let vertices = array(15u, 7u, 3u, 4u);
  for (var lod = 0u; lod < 4u; lod++) {
    atomicStore(&args[lod * 4u], vertices[lod]);
    atomicStore(&args[lod * 4u + 1u], 0u);
    atomicStore(&args[lod * 4u + 2u], 0u);
    atomicStore(&args[lod * 4u + 3u], 0u);
  }
}

// The counts can run past the lists when the view holds more blades than they do: clamp them, so
// the draws never read past a list.
@compute @workgroup_size(1) fn finish() {
  for (var lod = 0u; lod < 4u; lod++) {
    atomicMin(&args[lod * 4u + 1u], F.capacity);
  }
}
