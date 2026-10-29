#include "hash.wgsl"
#include "petal.wgsl"
#include "params.wgsl"

// Story 12.1: one flower opening, from a floral diagram (src/gpu/flower/diagram.ts). Every organ
// is an instance: a petal surface (petal.wgsl) pulled from a grid of (u, v), set on the
// receptacle at its place in the diagram and tilted out from the axis as it opens.
//
// Opening is story 11.4's bilayer (src/gpu/flower/opening.ts, which is this placement's CPU twin):
// a petal opens because its inner face grows more than its outer one, and the strain difference
// bends it, by Timoshenko's κ = 3Δε / 2h. Its blade curls from wrapped round the bud to its own
// open curl and its basal hinge tilts it out from the axis, the outer organs first. Strain grows
// linearly with each organ's opening, so the angles do: they are mixed here. Ruffles grow in with
// the edge's excess as it opens.

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
   * fringe, kind (0 sepal, 1 petal, 2 stamen, 3 carpel, 4 receptacle, 5 tube, 6 stem), seed, and for a lobe
   * on a tube's rim its base's radius in the bud (0 otherwise).
   *
   * A tube keeps its rim in the bud and open, its flare and its waves in `a`, its rim's ruffle in
   * b.w, and its length in tilt.w.
   */
  c: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> organs: array<Organ>;

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
}

fn shape_of(o: Organ, open: f32) -> PetalShape {
  var s: PetalShape;
  s.width = o.a.x;
  s.widest = o.a.y;
  s.tip = o.a.z;
  s.claw = o.a.w;
  s.notch = o.b.x;
  s.cup = o.b.y;
  // From wrapped round the bud to the petal's own curl.
  s.curl = mix(params.bud_curl, o.b.z, open);
  s.excess = o.b.w * params.ruffle * mix(0.25, 1.0, open);
  s.fringe = o.c.x;
  return s;
}

/** This organ's own opening, from the flower's: the outer organs first. */
fn opening(o: Organ) -> f32 {
  let start = o.place.w * params.stagger;
  return smoothstep(start, start + 1.0 - params.stagger, params.progress);
}

/** A point of the head's organs, relative to the receptacle, before the stem sways it. */
fn head_point(o: Organ, s: PetalShape, open: f32, u: f32, v: f32) -> vec3f {
  if (u32(o.c.y) == 4u) {
    // The receptacle: a low dome, u out from the axis and v round it.
    let r = o.tilt.w * u;
    let a = 3.14159265 * v + params.spin;
    return vec3f(r * sin(a), o.tilt.w * o.b.y * (1.0 - u * u), r * cos(a));
  }
  if (u32(o.c.y) == 5u) {
    // A fused tube: a surface of revolution flaring from its base to a rim that widens as it
    // opens, waved round the rim.
    let rim = mix(o.a.x, o.a.y, open);
    let a = 3.14159265 * v + params.spin;
    var r = o.place.y + (rim - o.place.y) * pow(u, o.a.z);
    r += o.b.w * o.tilt.w * pow(u, 4.0) * sin(o.a.w * a) * open;
    return vec3f(r * sin(a), o.place.z + u * o.tilt.w, r * cos(a));
  }
  let local = petal_point(s, u, v) * o.tilt.w * o.tilt.z * mix(0.75, 1.0, open);
  let azimuth = o.place.x + params.spin;
  let radial = vec3f(sin(azimuth), 0.0, cos(azimuth));
  let up = vec3f(0.0, 1.0, 0.0);
  let across = cross(up, radial);
  // A little sway, each organ on its own phase, as petals flutter on a still day.
  let flutter = params.flutter * sin(params.time * (2.1 + o.c.z) + o.c.z * 6.28);
  let t = mix(o.tilt.x, o.tilt.y, open) + flutter * open;
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
fn organ_point(o: Organ, s: PetalShape, open: f32, u: f32, v: f32) -> vec3f {
  let d = params.sway.xy;
  if (u32(o.c.y) == 6u) {
    // The stem itself, from below the view up to the receptacle, in a cantilever's shape.
    let bend = u * u * (3.0 - u) * 0.5;
    let a = 3.14159265 * v;
    let around = vec3f(sin(a), 0.0, cos(a)) * params.stem.y;
    let y = -params.stem.x * (1.0 - u) - params.sway.w * bend;
    return params.centre + vec3f(d.x * bend, y, d.y * bend) + around;
  }
  var p = head_point(o, s, open, u, v);
  if (dot(d, d) > 1e-14) {
    p = rotate(p, normalize(vec3f(d.y, 0.0, -d.x)), params.sway.z);
  }
  return params.centre + p + vec3f(d.x, -params.sway.w, d.y);
}

@vertex fn organ_vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> Varying {
  let o = organs[ii];
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
  let open = opening(o);
  let s = shape_of(o, open);
  let p = organ_point(o, s, open, u, v);
  let du = 0.5 / f32(NU - 1u);
  let dv = 1.0 / f32(NV - 1u);
  let pu = organ_point(o, s, open, min(u + du, 1.0), v) - organ_point(o, s, open, max(u - du, 0.0), v);
  let pv = organ_point(o, s, open, u, min(v + dv, 1.0)) - organ_point(o, s, open, u, max(v - dv, -1.0));
  var n = cross(pv, pu);
  if (dot(n, n) < 1e-14) { n = vec3f(0.0, 1.0, 0.0); }
  var out: Varying;
  out.position = params.view_proj * vec4f(p, 1.0);
  out.normal = normalize(n);
  out.world = p;
  out.uv = vec2f(u, v);
  out.kind = u32(o.c.y);
  out.tone = hash_2to1(vec2f(f32(ii), 3.1));
  out.across = normalize(pv + vec3f(1e-7, 0.0, 0.0));
  out.open = open;
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

@fragment fn organ_fs(in: Varying, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  let view = normalize(params.eye - in.world);
  var n = normalize(in.normal);
  if (dot(n, view) < 0.0) { n = -n; }
  let light = normalize(params.sun.xyz);
  var reflect_c: vec3f;
  var through_c: vec3f;
  var gloss = 0.0;
  var velvet = 0.0;
  var grating = 0.0;
  if (in.kind == 0u || in.kind == 6u) {
    reflect_c = params.sepal.rgb;
    through_c = params.sepal_through.rgb;
  } else if (in.kind == 2u) {
    // Filament, then the anther at its tip.
    reflect_c = mix(params.filament.rgb, params.anther.rgb, smoothstep(0.7, 0.85, in.uv.x));
    through_c = reflect_c * 0.3;
  } else if (in.kind == 3u || in.kind == 4u) {
    reflect_c = params.carpel.rgb;
    through_c = reflect_c * 0.3;
  } else if (in.kind == 5u) {
    // A tube: its base's colour deep inside, its rim's at the mouth, the rim's bud colour mixed in
    // as it opens, as the lobes' is.
    let mouth = smoothstep(0.35, 0.95, in.uv.x);
    let rim = mix(params.petal_bud.rgb, params.tube_rim.rgb, in.open);
    let rim_through = mix(params.petal_bud_through.rgb, params.tube_rim_through.rgb, in.open);
    reflect_c = mix(params.tube_base.rgb, rim, mouth);
    through_c = mix(params.tube_base_through.rgb, rim_through, mouth);
    gloss = params.gloss;
    velvet = params.velvet;
  } else {
    // The petal's pigments, the throat's at its base, faint veins, and a little variety.
    let throat = 1.0 - smoothstep(params.throat - params.throat_edge, params.throat, in.uv.x);
    let petal = mix(params.petal_bud.rgb, params.petal.rgb, in.open);
    let petal_through = mix(params.petal_bud_through.rgb, params.petal_through.rgb, in.open);
    reflect_c = mix(petal, params.base.rgb, throat);
    through_c = mix(petal_through, params.base_through.rgb, throat);
    let vein = 0.5 + 0.5 * cos(in.uv.y * 18.0 + in.uv.x * 2.0);
    let tone = mix(1.0, 0.9, vein * (1.0 - in.uv.x) * 0.6) * mix(0.92, 1.06, in.tone);
    reflect_c *= tone;
    through_c *= tone;
    gloss = params.gloss;
    velvet = mix(params.velvet, params.base_velvet, throat);
    grating = params.grating.y * throat;
  }
  let lit = max(dot(n, light), 0.0);
  let behind = max(dot(-n, light), 0.0);
  let half_v = normalize(light + view);
  let nv = max(dot(n, view), 0.0);
  // A soft sky from above, darker below, so the cup's inside reads.
  let sky = mix(0.25, 0.6, 0.5 + 0.5 * n.y);
  var rgb = reflect_c * (params.sun.w * lit + sky * params.ambient);
  // Light through the petal from behind: the plate's own transmittance.
  rgb += through_c * behind * params.sun.w * params.translucency * 2.0;
  // Gloss from a smooth epidermis over an air gap (the buttercup's): two reflecting interfaces, a
  // sharp lobe. Conical cells scatter it away: velvet has none.
  let fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(half_v, view), 0.0), 5.0);
  let sharp = pow(max(dot(n, half_v), 0.0), 120.0) * 8.0;
  rgb += vec3f(gloss * (1.0 - velvet) * fresnel * sharp * params.sun.w);
  // Velvet: the cones send light back towards grazing views, a soft brightening at the rim.
  rgb += reflect_c * velvet * pow(1.0 - nv, 3.0) * 0.6 * (params.sun.w * 0.4 + params.ambient * 0.5);
  // Structural colour: a grating across the petal diffracts its first order at
  // lambda = d |sin(out) - sin(in)|, seen near the mirror direction along the striations.
  if (grating > 0.0) {
    let sin_in = dot(light, in.across);
    let sin_out = dot(view, in.across);
    let l = params.grating.x * abs(sin_out + sin_in);
    if (l >= 400.0 && l <= 700.0) {
      let along = pow(max(dot(n, half_v), 0.0), 6.0);
      rgb += spectral_rgb(l) * grating * along * params.sun.w * 0.5;
    }
  }
  return vec4f(rgb, 1.0);
}
