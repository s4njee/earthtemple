#include "hash.wgsl"
#include "petal.wgsl"
#include "params.wgsl"

// Story 12.1: flowers built from their floral diagrams (src/gpu/flower/diagram.ts), drawn by
// src/gpu/flower/render.ts. Every organ of every head is an instance: a petal surface (petal.wgsl)
// pulled from a grid of (u, v), set on the receptacle at its place in the diagram and tilted out
// from the axis as it opens; then the head is placed, turned and swayed on its stem.
//
// Opening is story 11.4's bilayer (src/gpu/flower/opening.ts, which is this placement's CPU twin):
// a petal opens because its inner face grows more than its outer one, and the strain difference
// bends it, by Timoshenko's κ = 3Δε / 2h. Its blade curls from wrapped round the bud to its own
// open curl and its basal hinge tilts it out from the axis, the outer organs first. Strain grows
// linearly with each organ's opening, so the angles do: they are mixed here. Ruffles grow in with
// the edge's excess as it opens. A nested bud's petals (story 12.2) lie on shells and then bowls,
// wrapped across to the bowl's curvature.

struct Organ {
  /** azimuth, radius, height, order */
  place: vec4f,
  /** closed, open, scale, length */
  tilt: vec4f,
  /** width, widest, tip, claw */
  a: vec4f,
  /** notch, cup, curl, excess */
  b: vec4f,
  /**
   * fringe, kind (0 sepal, 1 petal, 2 stamen, 3 carpel, 4 receptacle, 5 tube, 6 stem, 7 leaf),
   * seed, and for a lobe on a tube's rim its base's radius in the bud (0 otherwise). A leaf's
   * height is a fraction of the way up the stem.
   *
   * A tube keeps its rim in the bud and open, its flare and its waves in `a`, its twist and folds
   * in the bud in b.x and b.y, its rim's ruffle in b.w, and its length in tilt.w.
   */
  c: vec4f,
  /** Curl in the bud, nested (1) or not, length in the bud as a fraction of open, rolled margins. */
  d: vec4f,
}

struct Head {
  /** The receptacle, m, and the turn about the axis. */
  place: vec4f,
  /** Opening, scale, the bud's stretch upwards, look. */
  state: vec4f,
  /** The stem's tip: its displacement (x, z), the head's tilt and the tip's drop. */
  sway: vec4f,
  /** The head turned about a horizontal axis (x, z) by an angle; w 1 to draw the stem. */
  nod: vec4f,
  /** The share of its petals fallen, and 1 for a pedicel along its axis rather than a stem. */
  extra: vec4f,
}

struct Look {
  /** gloss, throat, throat_edge, velvet */
  surface: vec4f,
  /** base velvet, grating spacing (nm) and strength, a funnel's bands */
  surface2: vec4f,
  petal: vec4f,
  petal_through: vec4f,
  base: vec4f,
  base_through: vec4f,
  sepal: vec4f,
  sepal_through: vec4f,
  petal_bud: vec4f,
  petal_bud_through: vec4f,
  tube_base: vec4f,
  tube_base_through: vec4f,
  tube_rim: vec4f,
  tube_rim_through: vec4f,
  filament: vec4f,
  anther: vec4f,
  carpel: vec4f,
  /** The stem's length and radius, m. */
  stem: vec4f,
}

/**
 * One draw: its organs (`order`) and its heads. Instances run organ by organ, head by head.
 *
 * Mode 1 draws heads the grass field placed (story 12.3) instead, from `field_heads[head_first]`:
 * as many as the field counted at `field_counts[head_count]`, which only the GPU knows.
 */
struct Draw {
  order_first: u32,
  head_first: u32,
  head_count: u32,
  mode: u32,
}

/**
 * A flower head as the grass field lists it (src/gpu/grass/field.wgsl): at its stem's tip and its
 * size; the stem's direction there and the head's facing; the root, and its species plus variety.
 */
struct FieldHead {
  v0: vec4f,
  v1: vec4f,
  v2: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> organs: array<Organ>;
@group(0) @binding(2) var<storage, read> heads: array<Head>;
@group(0) @binding(3) var<storage, read> looks: array<Look>;
@group(0) @binding(4) var<storage, read> order: array<u32>;
@group(0) @binding(5) var<uniform> draw: Draw;
@group(0) @binding(6) var<storage, read> field_heads: array<FieldHead>;
@group(0) @binding(7) var<storage, read> field_counts: array<u32>;

// The grid, set per level of detail (story 11.1, PETAL_LODS in src/gpu/flower/petal.ts).
override NU: u32 = 22u;
override NV: u32 = 11u;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) world: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) kind: u32,
  @location(4) @interpolate(flat) tone: f32,
  /** Across the petal, in the world: the direction the cuticle's striations repeat along. */
  @location(5) across: vec3f,
  /** The organ's own opening, for colours that change as it opens. */
  @location(6) @interpolate(flat) open: f32,
  @location(7) @interpolate(flat) look: u32,
}

fn shape_of(o: Organ, open: f32) -> PetalShape {
  let nested = o.d.y > 0.5;
  var s: PetalShape;
  s.width = o.a.x;
  s.widest = o.a.y;
  s.tip = o.a.z;
  s.claw = o.a.w;
  s.notch = o.b.x;
  // A nested petal's cup is its bowl's wrap, set per row in head_point.
  s.cup = select(o.b.y, 0.0, nested);
  // From wrapped round the bud to the petal's own curl.
  s.curl = mix(o.d.x, o.b.z, open);
  // Pressed between its neighbours, a nested petal cannot ruffle until it opens.
  s.excess = o.b.w * params.ruffle * select(mix(0.25, 1.0, open), open, nested);
  s.fringe = o.c.x;
  s.roll = o.d.w * open;
  s.wrap = 0.0;
  return s;
}

/** This organ's own opening, from the head's: the outer organs first. */
fn opening(o: Organ, progress: f32) -> f32 {
  let start = o.place.w * params.stagger;
  return smoothstep(start, start + 1.0 - params.stagger, progress);
}

/** A nested petal's wrap at u, in 1 / lengths: cos(lean) / ρ across its bowl (bowlWrap). */
fn bowl_wrap(radius: f32, tilt: f32, curl: f32, length: f32, u: f32) -> f32 {
  let lean = tilt - curl * u;
  var out = u * sin(tilt);
  if (abs(curl) >= 1e-5) { out = (cos(lean) - cos(tilt)) / curl; }
  return length * cos(lean) / max(radius + length * out, 1e-4);
}

/** A point of a head's organs, relative to its receptacle, before the head is placed. */
fn head_point(o: Organ, shape: PetalShape, open: f32, yaw: f32, u: f32, v: f32) -> vec3f {
  if (u32(o.c.y) == 4u) {
    // The receptacle: a low dome, u out from the axis and v round it.
    let r = o.tilt.w * u;
    let a = 3.14159265 * v + yaw;
    return vec3f(r * sin(a), o.tilt.w * o.b.y * (1.0 - u * u), r * cos(a));
  }
  if (u32(o.c.y) == 5u) {
    // A fused tube: a surface of revolution flaring from its base to a rim that widens as it
    // opens, waved round the rim, furled in the bud and untwisting as it opens.
    let rim = mix(o.a.x, o.a.y, open);
    let a = 3.14159265 * v + yaw + o.b.x * (1.0 - open) * u * u;
    let waves = sin(o.a.w * (a - yaw));
    var r = o.place.y + (rim - o.place.y) * pow(u, o.a.z);
    r += o.b.w * o.tilt.w * pow(u, 4.0) * waves * open;
    // The bud's pleats, twisted with it.
    r *= 1.0 + o.b.y * u * u * waves * (1.0 - open);
    return vec3f(r * sin(a), o.place.z + u * o.tilt.w, r * cos(a));
  }
  var s = shape;
  let length = o.tilt.w * o.tilt.z * mix(o.d.z, 1.0, open);
  // A little sway, each organ on its own phase, as petals flutter on a still day.
  let flutter = params.flutter * sin(params.time * (2.1 + o.c.z) + o.c.z * 6.28);
  let t = mix(o.tilt.x, o.tilt.y, open) + flutter * open;
  if (o.d.y > 0.5) { s.wrap = bowl_wrap(o.place.y, t, s.curl, length, u); }
  let local = petal_point(s, u, v) * length;
  let azimuth = o.place.x + yaw;
  let radial = vec3f(sin(azimuth), 0.0, cos(azimuth));
  let up = vec3f(0.0, 1.0, 0.0);
  let across = cross(up, radial);
  let along = cos(t) * up + sin(t) * radial;
  let inner = cos(t) * (-radial) + sin(t) * up;
  // A lobe on a tube's rim rides the rim out as the tube opens.
  let radius = select(o.place.y, mix(o.c.w, o.place.y, open), o.c.w > 0.0);
  let base = radial * radius + up * o.place.z;
  return base + across * local.x + along * local.y + inner * local.z;
}

fn rotate(p: vec3f, axis: vec3f, angle: f32) -> vec3f {
  let c = cos(angle);
  let s = sin(angle);
  return p * c + cross(axis, p) * s + axis * dot(axis, p) * (1.0 - c);
}

// Story 11.5: the stem, a cantilever under the head, sways it (src/gpu/flower/stem.ts). `sway` is
// the tip's displacement (x, z), the head's tilt 3δ / 2L, and how far the tip drops as it bends.
fn organ_point(o: Organ, h: Head, stem: vec2f, s: PetalShape, open: f32, u: f32, v: f32) -> vec3f {
  let d = h.sway.xy;
  let scale = h.state.y;
  if (u32(o.c.y) == 6u && h.extra.y > 0.5) {
    // A pedicel: back along the head's axis to its twig.
    let a = 3.14159265 * v;
    var q = vec3f(sin(a) * stem.y, -stem.x * (1.0 - u), cos(a) * stem.y) * scale;
    if (abs(h.nod.z) > 1e-6) { q = rotate(q, normalize(vec3f(h.nod.x, 0.0, h.nod.y)), h.nod.z); }
    return h.place.xyz + q;
  }
  if (u32(o.c.y) == 6u) {
    // The stem itself, from the ground up to the receptacle, in a cantilever's shape.
    let bend = u * u * (3.0 - u) * 0.5;
    let a = 3.14159265 * v;
    let around = vec3f(sin(a), 0.0, cos(a)) * stem.y * scale;
    let y = -stem.x * scale * (1.0 - u) - h.sway.w * bend;
    return h.place.xyz + vec3f(d.x * bend, y, d.y * bend) + around;
  }
  if (u32(o.c.y) == 7u) {
    // A leaf, on the stem where the cantilever has carried it, leaning out from the stem.
    let along = o.place.z;
    let bend = along * along * (3.0 - along) * 0.5;
    let y = -stem.x * scale * (1.0 - along) - h.sway.w * bend;
    let azimuth = o.place.x + h.place.w;
    let radial = vec3f(sin(azimuth), 0.0, cos(azimuth));
    let up = vec3f(0.0, 1.0, 0.0);
    let t = o.tilt.y;
    let local = petal_point(s, u, v) * o.tilt.w * o.tilt.z * scale;
    let at = vec3f(d.x * bend, y, d.y * bend) + radial * o.place.y * scale;
    return h.place.xyz + at + cross(up, radial) * local.x + (cos(t) * up + sin(t) * radial) * local.y
      + (cos(t) * (-radial) + sin(t) * up) * local.z;
  }
  var p = head_point(o, s, open, h.place.w, u, v);
  p.y *= h.state.z;
  p *= scale;
  if (abs(h.nod.z) > 1e-6) {
    p = rotate(p, normalize(vec3f(h.nod.x, 0.0, h.nod.y)), h.nod.z);
  }
  if (dot(d, d) > 1e-14) {
    p = rotate(p, normalize(vec3f(d.y, 0.0, -d.x)), h.sway.z);
  }
  return h.place.xyz + p + vec3f(d.x, -h.sway.w, d.y);
}

/**
 * A field's head as one of ours: open or nearly, scaled from its open reach (in its look's stem.z)
 * to the size the field gave it, and turned from upright to along its stem's tip. Its stem is the
 * field's own blade.
 */
fn field_head(f: FieldHead, species: u32) -> Head {
  let dir = normalize(f.v1.xyz + vec3f(0.0, 1e-7, 0.0));
  let axis = cross(vec3f(0.0, 1.0, 0.0), dir);
  let l = length(axis);
  let variety = fract(f.v2.w);
  var h: Head;
  h.place = vec4f(f.v0.xyz, f.v1.w);
  h.state = vec4f(mix(0.8, 1.0, fract(variety * 13.0)), f.v0.w / looks[species].stem.z, 1.0, f32(species));
  h.sway = vec4f(0.0);
  h.nod = vec4f(select(vec2f(1.0, 0.0), axis.xz / l, l > 1e-6), acos(clamp(dir.y, -1.0, 1.0)), 0.0);
  h.extra = vec4f(0.0);
  return h;
}

@vertex fn organ_vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Varying {
  var out: Varying;
  var o: Organ;
  var h: Head;
  var seed: f32;
  if (draw.mode == 1u) {
    let heads = max(field_counts[draw.head_count], 1u);
    let f = field_heads[draw.head_first + ii % heads];
    o = organs[order[draw.order_first + ii / heads]];
    h = field_head(f, min(u32(f.v2.w), 3u));
    seed = f32(ii % heads) * 7.3 + f32(ii / heads);
  } else {
    o = organs[order[draw.order_first + ii / draw.head_count]];
    h = heads[draw.head_first + ii % draw.head_count];
    seed = f32(ii % draw.head_count) * 7.3 + f32(ii / draw.head_count);
  }
  let look = u32(h.state.w);
  // A fallen petal is gone from its head; which ones, by a hash of the head and the petal.
  let fallen = u32(o.c.y) == 1u && hash_2to1(vec2f(seed, 9.1)) < h.extra.x;
  if ((u32(o.c.y) == 6u && h.nod.w < 0.5) || fallen) {
    // This head's stem is not drawn: a degenerate triangle.
    out.position = vec4f(0.0, 0.0, 2.0, 1.0);
    return out;
  }
  let stem = looks[look].stem.xy;
  // Two triangles per quad of the grid.
  let quad = vi / 6u;
  let corner = vi % 6u;
  let qi = quad % (NV - 1u);
  let qj = quad / (NV - 1u);
  let offsets = array<vec2u, 6>(vec2u(0u, 0u), vec2u(1u, 0u), vec2u(0u, 1u), vec2u(1u, 0u), vec2u(1u, 1u), vec2u(0u, 1u));
  let g = vec2u(qi, qj) + offsets[corner];
  // Rows closer together at the base and the tip, as gridU spaces them.
  let s_u = f32(g.y) / f32(NU - 1u);
  let u = s_u * s_u * (3.0 - 2.0 * s_u);
  let v = f32(g.x) / f32(NV - 1u) * 2.0 - 1.0;
  // Leaves are grown.
  let open = select(opening(o, h.state.x), 1.0, u32(o.c.y) == 7u);
  let s = shape_of(o, open);
  let p = organ_point(o, h, stem, s, open, u, v);
  // One-sided differences, back from the far edges: two more points, not four.
  let du = select(0.5, -0.5, u > 0.999) / f32(NU - 1u);
  let dv = select(1.0, -1.0, v > 0.999) / f32(NV - 1u);
  let pu = (organ_point(o, h, stem, s, open, u + du, v) - p) * sign(du);
  let pv = (organ_point(o, h, stem, s, open, u, v + dv) - p) * sign(dv);
  var n = cross(pv, pu);
  if (dot(n, n) < 1e-14) { n = vec3f(0.0, 1.0, 0.0); }
  out.position = params.view_proj * vec4f(p, 1.0);
  out.normal = normalize(n);
  out.world = p;
  out.uv = vec2f(u, v);
  out.kind = u32(o.c.y);
  out.tone = hash_2to1(vec2f(seed, 3.1));
  out.across = normalize(pv + vec3f(1e-7, 0.0, 0.0));
  out.open = open;
  out.look = look;
  return out;
}

// Story 11.3's diffraction colour: a wavelength (nm) to linear sRGB, a smooth fit to the spectral
// locus's hues, dimmed towards the ends of the visible where the eye is less sensitive.
fn spectral_rgb(l: f32) -> vec3f {
  let r = exp(-0.5 * pow((l - 600.0) / 40.0, 2.0)) + 0.35 * exp(-0.5 * pow((l - 445.0) / 20.0, 2.0));
  let g = exp(-0.5 * pow((l - 545.0) / 40.0, 2.0));
  let b = exp(-0.5 * pow((l - 455.0) / 28.0, 2.0));
  return max(vec3f(r, g, b), vec3f(0.0));
}

fn shade(in: Varying) -> vec3f {
  let L = looks[in.look];
  let view = normalize(params.eye - in.world);
  var n = normalize(in.normal);
  if (dot(n, view) < 0.0) { n = -n; }
  let light = normalize(params.sun.xyz);
  var reflect_c: vec3f;
  var through_c: vec3f;
  var gloss = 0.0;
  var velvet = 0.0;
  var grating = 0.0;
  if (in.kind == 0u || in.kind == 6u || in.kind == 7u) {
    reflect_c = L.sepal.rgb;
    through_c = L.sepal_through.rgb;
  } else if (in.kind == 2u) {
    // Filament, then the anther at its tip.
    reflect_c = mix(L.filament.rgb, L.anther.rgb, smoothstep(0.7, 0.85, in.uv.x));
    through_c = reflect_c * 0.3;
  } else if (in.kind == 3u || in.kind == 4u) {
    reflect_c = L.carpel.rgb;
    through_c = reflect_c * 0.3;
  } else if (in.kind == 5u) {
    // A tube: its base's colour deep inside, its rim's at the mouth, the rim's bud colour mixed in
    // as it opens, as the lobes' is.
    let mouth = smoothstep(0.35, 0.95, in.uv.x);
    let rim = mix(L.petal_bud.rgb, L.tube_rim.rgb, in.open);
    let rim_through = mix(L.petal_bud_through.rgb, L.tube_rim_through.rgb, in.open);
    // Five midpetaline bands, the base's colour carried out along the folds to the mouth.
    let band = L.surface2.w * pow(0.5 + 0.5 * cos(5.0 * 3.14159265 * in.uv.y), 6.0);
    let out = mouth * (1.0 - band);
    reflect_c = mix(L.tube_base.rgb, rim, out);
    through_c = mix(L.tube_base_through.rgb, rim_through, out);
    gloss = L.surface.x;
    velvet = L.surface.w;
  } else {
    // The petal's pigments, the throat's at its base, faint veins, and a little variety.
    let throat = 1.0 - smoothstep(L.surface.y - L.surface.z, L.surface.y, in.uv.x);
    let petal = mix(L.petal_bud.rgb, L.petal.rgb, in.open);
    let petal_through = mix(L.petal_bud_through.rgb, L.petal_through.rgb, in.open);
    reflect_c = mix(petal, L.base.rgb, throat);
    through_c = mix(petal_through, L.base_through.rgb, throat);
    let vein = 0.5 + 0.5 * cos(in.uv.y * 18.0 + in.uv.x * 2.0);
    let tone = mix(1.0, 0.9, vein * (1.0 - in.uv.x) * 0.6) * mix(0.92, 1.06, in.tone);
    reflect_c *= tone;
    through_c *= tone;
    gloss = L.surface.x;
    velvet = mix(L.surface.w, L.surface2.x, throat);
    grating = L.surface2.z * throat;
  }
  let lit = max(dot(n, light), 0.0);
  let behind = max(dot(-n, light), 0.0);
  let half_v = normalize(light + view);
  let nv = max(dot(n, view), 0.0);
  let sun = params.sun_colour.rgb * params.sun.w;
  // A soft sky from above, darker below, so the cup's inside reads.
  let sky = mix(params.sky_bottom.rgb, params.sky_top.rgb, 0.5 + 0.5 * n.y) * params.ambient;
  var rgb = reflect_c * (sun * lit + sky);
  // Light through the petal from behind: the plate's own transmittance.
  rgb += through_c * behind * sun * params.translucency * 2.0;
  // Gloss from a smooth epidermis over an air gap (the buttercup's): two reflecting interfaces, a
  // sharp lobe. Conical cells scatter it away: velvet has none.
  let fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(half_v, view), 0.0), 5.0);
  let sharp = pow(max(dot(n, half_v), 0.0), 120.0) * 8.0;
  rgb += gloss * (1.0 - velvet) * fresnel * sharp * sun;
  // Velvet: the cones send light back towards grazing views, a soft brightening at the rim.
  let sheen = sun * 0.4 + sky * 0.5;
  rgb += reflect_c * velvet * pow(1.0 - nv, 3.0) * 0.6 * sheen;
  // Structural colour: a grating across the petal diffracts its first order at
  // lambda = d |sin(out) - sin(in)|, seen near the mirror direction along the striations.
  if (grating > 0.0) {
    let sin_in = dot(light, in.across);
    let sin_out = dot(view, in.across);
    let l = L.surface2.y * abs(sin_out + sin_in);
    if (l >= 400.0 && l <= 700.0) {
      let along = pow(max(dot(n, half_v), 0.0), 6.0);
      rgb += spectral_rgb(l) * grating * along * sun * 0.5;
    }
  }
  // Haze: towards the air's colour with distance, for flowers far across a field.
  let fog = 1.0 - exp(-length(params.eye - in.world) * params.haze.w);
  return mix(rgb, params.haze.rgb, fog);
}

@fragment fn organ_fs(in: Varying) -> @location(0) vec4f {
  return vec4f(shade(in), 1.0);
}

struct WithDistance {
  @location(0) colour: vec4f,
  @location(1) distance: f32,
}

/** For a grass strip's targets: the colour, and the distance its depth of field reads. */
@fragment fn organ_distance_fs(in: Varying) -> WithDistance {
  return WithDistance(vec4f(shade(in), 1.0), length(params.eye - in.world));
}
