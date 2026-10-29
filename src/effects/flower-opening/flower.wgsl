#include "hash.wgsl"
#include "petal.wgsl"
#include "params.wgsl"

// Story 12.1: one flower opening, from a floral diagram (src/gpu/flower/diagram.ts). Every organ
// is an instance: a petal surface (petal.wgsl) pulled from a grid of (u, v), set on the
// receptacle at its place in the diagram and tilted out from the axis as it opens.
//
// Opening (story 11.4's model, in its simplest form): a petal opens because its inner face grows
// more than its outer one, so it bends outwards. Here the bend is the petal's curl, running from
// wrapped inwards in the bud to its own open curl, while the whole petal tilts from its bud angle
// to its open one, the outer organs first. Ruffles grow in with the edge's excess as it opens.

struct Organ {
  /** azimuth, radius, height, order */
  place: vec4f,
  /** closed, open, scale, length */
  tilt: vec4f,
  /** width, widest, tip, claw */
  a: vec4f,
  /** notch, cup, curl, excess */
  b: vec4f,
  /** fringe, kind (0 sepal, 1 petal, 2 stamen, 3 carpel), seed, - */
  c: vec4f,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> organs: array<Organ>;

const NU: u32 = 22u;
const NV: u32 = 11u;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) world: vec3f,
  @location(2) uv: vec2f,
  @location(3) @interpolate(flat) kind: u32,
  @location(4) @interpolate(flat) tone: f32,
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

fn organ_point(o: Organ, s: PetalShape, open: f32, u: f32, v: f32) -> vec3f {
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
  let base = radial * o.place.y + up * o.place.z;
  return params.centre + base + across * local.x + along * local.y + inner * local.z;
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
  let u = f32(g.y) / f32(NU - 1u);
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
  return out;
}

@fragment fn organ_fs(in: Varying, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  let view = normalize(params.eye - in.world);
  var n = normalize(in.normal);
  if (dot(n, view) < 0.0) { n = -n; }
  let light = normalize(params.sun.xyz);
  var colour: vec3f;
  var gloss = 0.0;
  if (in.kind == 0u) {
    colour = params.sepal.rgb;
  } else if (in.kind == 2u) {
    // Filament dark, anther at the tip.
    colour = mix(params.filament.rgb, params.anther.rgb, smoothstep(0.7, 0.85, in.uv.x));
  } else if (in.kind == 3u) {
    colour = params.carpel.rgb;
  } else {
    // The petal: its colour, a throat at the base, a little darker along the midrib and veins.
    let throat = 1.0 - smoothstep(0.0, params.throat, in.uv.x);
    colour = mix(params.petal.rgb, params.base.rgb, throat);
    let vein = 0.5 + 0.5 * cos(in.uv.y * 18.0 + in.uv.x * 2.0);
    colour *= mix(1.0, 0.9, vein * (1.0 - in.uv.x) * 0.6) * mix(0.92, 1.06, in.tone);
    gloss = params.gloss;
  }
  let lit = max(dot(n, light), 0.0);
  // Light through the petal from behind, as the leaf plate passes it, tinted by the pigment twice.
  let through = max(dot(-n, light), 0.0) * params.translucency * select(0.4, 1.0, in.kind == 1u);
  let half_v = normalize(light + view);
  let spec = gloss * pow(max(dot(n, half_v), 0.0), 60.0);
  // A soft sky from above, darker below, so the cup's inside reads.
  let sky = mix(0.25, 0.6, 0.5 + 0.5 * n.y);
  let rgb = colour * (params.sun.w * lit + sky * params.ambient) + colour * colour * through * params.sun.w + vec3f(spec);
  return vec4f(rgb, 1.0);
}
