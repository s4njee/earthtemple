#include "hash.wgsl"
#include "blade.wgsl"
#include "field-params.wgsl"
#include "look-params.wgsl"
#include "grass-shade.wgsl"

// Story 2.3's draw: blades pulled from the lists `field.wgsl` wrote, one triangle strip each, by
// LOD (LEVELS rows of two vertices, then the tip), and flower heads from the fourth list. No vertex
// buffers. Drawn into a 4x multisampled target with depth, and a second target holding each
// pixel's distance, for depth of field.
//
// - Shape. Each row is a point on the blade's curve, offset either side across the blade by its
//   width, which narrows to the tip. The blade twists a little over its length. A stem is thin,
//   and its last part swells into a seed head.
// - Rounded normals (Ghost of Tsushima). A blade is flat, but its normal is tilted across its
//   width, so it shades like a folded blade, light on one side of the midrib and dark on the other.
// - Thickening. A far blade narrower than a pixel is drawn a pixel wide, and covers only as many of
//   the pixel's samples as its true width would, so a far field neither vanishes nor shimmers.
//   Near blades are wide enough for multisampling alone, and skip it.
// - Shading: grass-shade.wgsl (story 2.6).

struct Blade {
  v0: vec3f,
  width: f32,
  v1: vec3f,
  facing: f32,
  v2: vec3f,
  tone: f32,
}

@group(0) @binding(0) var<uniform> F: Field;
@group(0) @binding(1) var<storage, read> blades: array<Blade>;
@group(0) @binding(2) var<uniform> L: Look;

override LEVELS: u32 = 7u;
override BASE: u32 = 0u;
/** Off for the near list, whose blades are wide enough for multisampling alone. */
override THICKEN: bool = true;

/** The part of a stem that is its seed head. */
const HEAD: f32 = 0.28;

struct Varying {
  @builtin(position) position: vec4f,
  // Centroid throughout: multisampled, a pixel centre just outside a thin blade would otherwise
  // extrapolate its attributes, t below 0 at the root and a normal longer than 1, and pow() of a
  // negative is NaN, drawn as white specks.
  @location(0) @interpolate(perspective, centroid) normal: vec3f,
  @location(1) @interpolate(perspective, centroid) world: vec3f,
  @location(2) @interpolate(flat) tone: f32,
  @location(3) @interpolate(perspective, centroid) t: f32,
  @location(4) @interpolate(perspective, centroid) coverage: f32,
  @location(5) @interpolate(perspective, centroid) tangent: vec3f,
  @location(6) @interpolate(perspective, centroid) pixels: f32,
}

fn blade_width(t: f32, kind: u32) -> f32 {
  if (kind == 2u) {
    let u = saturate((t - (1.0 - HEAD)) / HEAD);
    return select(0.6, 0.6 + 2.4 * pow(sin(3.14159265 * u), 0.8), u > 0.0);
  }
  if (kind == 3u) { return 0.6 * (1.0 - 0.5 * t); }
  return pow(max(1.0 - pow(t, L.taper), 0.0), 0.6);
}

@vertex fn blade_vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Varying {
  let b = blades[BASE + i];
  let kind = u32(b.tone);
  let tip = v >= 2u * LEVELS;
  let t = select(f32(v / 2u) / f32(LEVELS), 1.0, tip);
  let side = select(select(-1.0, 1.0, (v & 1u) == 1u), 0.0, tip);
  let p = bezier(b.v0, b.v1, b.v2, t);
  let tangent = normalize(bezier_tangent(b.v0, b.v1, b.v2, t));
  let a = b.facing + L.twist * t * (2.0 * fract(b.tone * 13.0) - 1.0);
  let level = vec3f(-sin(a), 0.0, cos(a));
  // A blade bent along its own width has its tangent along `level` near the tip, and the
  // projection vanishes: take the horizontal across the tangent instead, or the normal is NaN.
  let flat = level - tangent * dot(level, tangent);
  let side_way = cross(vec3f(0.0, 1.0, 0.0), tangent);
  let across = select(normalize(side_way), normalize(flat), dot(flat, flat) > 1e-6);
  let normal = cross(across, tangent);
  let w = b.width * blade_width(t, kind);

  let clip = F.view_proj * vec4f(p, 1.0);
  let edge = F.view_proj * vec4f(p + across * w, 1.0);
  let pixels = length((edge.xy / edge.w - clip.xy / clip.w) * 0.5 * L.viewport);
  let grow = select(1.0, max(1.0, L.min_width / max(pixels, 1e-4)), THICKEN && w > 0.0);

  let world = p + across * (0.5 * side * w * grow);
  let round = select(0.0, L.round, has(F.flags, ROUNDED));
  var out: Varying;
  out.position = F.view_proj * vec4f(world, 1.0);
  // The side facing the viewer, chosen once for the whole blade, at its root. Chosen per pixel or
  // per vertex, a blade near edge-on has vertices facing opposite ways, the normal between them
  // passes through zero, and the shading is noise that shimmers as it sways (story 2.7). Not by
  // front_facing either: a strip's winding need not match the normal's sign, and a flipped normal
  // lights a backlit blade by reflection instead of through it.
  let root_normal = -vec3f(cos(b.facing), 0.0, sin(b.facing));
  let toward = select(-1.0, 1.0, dot(root_normal, F.eye - b.v0) >= 0.0);
  out.normal = toward * normalize(normal + across * side * round);
  out.world = world;
  out.tone = b.tone;
  out.t = t;
  out.coverage = 1.0 / grow;
  out.tangent = tangent;
  out.pixels = b.width * pixels / max(w, 1e-6);
  return out;
}

struct Fragment {
  @location(0) colour: vec4f,
  @location(1) depth: f32,
  @builtin(sample_mask) mask: u32,
}

struct NearFragment {
  @location(0) colour: vec4f,
  @location(1) depth: f32,
}

/** k of the four samples for a coverage, chosen by a per-pixel hash: no fixed dither pattern. */
fn coverage_mask(position: vec2f, coverage: f32) -> u32 {
  let h = pcg_2d(vec2u(position));
  let k = u32(clamp(floor(coverage * 4.0 + to_unorm_1d(h.x)), 0.0, 4.0));
  let turn = h.y & 3u;
  let bits = (1u << k) - 1u;
  return ((bits << turn) | (bits >> (4u - turn))) & 15u;
}

fn shade(in: Varying, front: bool) -> vec3f {
  let t = saturate(in.t);
  let kind = floor(in.tone);
  let head = select(0.0, 1.0, kind == 2.0 && t > 1.0 - HEAD);
  let s = blade_surface(kind, fract(in.tone), t, head);
  let n = normalize(in.normal);
  _ = front;
  return shade_surface(s, n, normalize(in.tangent), in.world, in.pixels);
}

// Far blades: thickened, covering their true share of the pixel's samples.
@fragment fn blade_fs(in: Varying, @builtin(front_facing) front: bool) -> Fragment {
  let mask = coverage_mask(in.position.xy, in.coverage);
  if (mask == 0u) { discard; }
  return Fragment(vec4f(shade(in, front), 1.0), distance(in.world, F.eye), mask);
}

// Near blades: without a sample mask or a discard, the GPU can reject the many fragments hidden
// behind nearer blades before shading them.
@fragment fn blade_fs_near(in: Varying, @builtin(front_facing) front: bool) -> NearFragment {
  return NearFragment(vec4f(shade(in, front), 1.0), distance(in.world, F.eye));
}

// --- Flower heads -----------------------------------------------------------------------------
// A disc at the stem's tip, lying in the horizontal: seen from the side it is an ellipse. Four
// kinds by the head's pick: ox-eye daisy, buttercup, poppy, cornflower, with their petal counts.

struct FlowerVarying {
  @builtin(position) position: vec4f,
  @location(0) @interpolate(perspective, centroid) uv: vec2f,
  @location(1) @interpolate(flat) pick: f32,
  @location(2) @interpolate(perspective, centroid) world: vec3f,
  @location(3) @interpolate(flat) pixels: f32,
}

@vertex fn flower_vs(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> FlowerVarying {
  let f = blades[3u * F.capacity + i];
  let corner = vec2f(f32(v & 1u), f32(v >> 1u)) * 2.0 - 1.0;
  let to_eye = normalize(F.eye - f.v0);
  let a = normalize(cross(vec3f(0.0, 1.0, 0.0), to_eye));
  let b = normalize(cross(to_eye, a)) * max(abs(to_eye.y), 0.35);
  let clip = F.view_proj * vec4f(f.v0, 1.0);
  let edge = F.view_proj * vec4f(f.v0 + a * f.width, 1.0);
  let pixels = length((edge.xy / edge.w - clip.xy / clip.w) * 0.5 * L.viewport);
  // At least a pixel and a half across, so a far flower is a dot of colour, not a flicker.
  let grow = max(1.0, 0.75 / max(pixels, 1e-4));
  let world = f.v0 + (a * corner.x + b * corner.y) * f.width * grow;
  var out: FlowerVarying;
  out.position = F.view_proj * vec4f(world, 1.0);
  out.uv = corner * grow;
  out.pick = f.tone;
  out.world = world;
  out.pixels = pixels;
  return out;
}

@fragment fn flower_fs(in: FlowerVarying) -> Fragment {
  let r = length(in.uv);
  let angle = atan2(in.uv.y, in.uv.x);
  var petals = 13.0;
  var petal = vec3f(0.85, 0.84, 0.8);
  var centre = vec3f(0.8, 0.55, 0.05);
  if (in.pick > 0.4) {
    petals = 5.0;
    petal = vec3f(0.85, 0.62, 0.04);
    centre = petal;
  }
  if (in.pick > 0.65) {
    petals = 4.0;
    petal = vec3f(0.62, 0.04, 0.02);
    centre = vec3f(0.03, 0.02, 0.02);
  }
  if (in.pick > 0.85) {
    petals = 8.0;
    petal = vec3f(0.12, 0.2, 0.62);
    centre = vec3f(0.15, 0.1, 0.35);
  }
  let edge = 0.55 + 0.45 * pow(abs(cos(0.5 * petals * angle)), 0.6);
  // Coverage across the edge, about a pixel wide; a far flower is a soft round dot.
  let width = max(1.0 / max(in.pixels, 1e-3), 0.05);
  let shape = select(edge, 1.0, in.pixels < 2.0);
  // A flower smaller than its drawn dot covers only its true share of it, so far flowers fade
  // with distance rather than piling up as dots along the horizon.
  let share = min(1.0, (in.pixels / 0.75) * (in.pixels / 0.75));
  let coverage = (1.0 - smoothstep(shape - width, shape + width, r)) * share;
  let mask = coverage_mask(in.position.xy, coverage);
  if (mask == 0u) { discard; }
  let albedo = select(petal, centre, r < 0.28 && in.pixels >= 2.0);
  let n = vec3f(0.0, 1.0, 0.0);
  let s = Surface(albedo, albedo * 0.6);
  let colour = shade_surface(s, n, vec3f(1.0, 0.0, 0.0), in.world, 0.0);
  return Fragment(vec4f(colour, 1.0), distance(in.world, F.eye), mask);
}
