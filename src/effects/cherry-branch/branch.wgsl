#include "branch-params.wgsl"

// Story 12.7's branch: each segment of the space-colonised skeleton (src/gpu/plant/colonise.ts) is
// a tapered tube, instanced, grown from the root out: a segment appears once the growth front has
// reached its start, extends to its end, and thickens behind the front. Behind it all, a spring sky.

struct Segment {
  /** From, and its radius. */
  a: vec4f,
  /** To, and its radius. */
  b: vec4f,
  /** Path length from the root at each end, m. */
  depth: vec4f,
}

@group(0) @binding(0) var<uniform> B: BranchParams;
@group(0) @binding(1) var<storage, read> segments: array<Segment>;

const SIDES: u32 = 10u;

struct BranchVarying {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) along: f32,
}

@vertex fn branch_vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BranchVarying {
  let s = segments[ii];
  var out: BranchVarying;
  let grown = (B.grown - s.depth.x) / max(s.depth.y - s.depth.x, 1e-6);
  if (grown <= 0.0) {
    out.position = vec4f(0.0, 0.0, 2.0, 1.0);
    return out;
  }
  let quad = vi / 6u;
  let corner = array<vec2u, 6>(vec2u(0u, 0u), vec2u(1u, 0u), vec2u(0u, 1u), vec2u(1u, 0u), vec2u(1u, 1u), vec2u(0u, 1u))[vi % 6u];
  let end = f32(corner.y);
  let side = f32(quad + corner.x) / f32(SIDES) * 6.2831853;
  let axis = normalize(s.b.xyz - s.a.xyz);
  let helper = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(axis.y) > 0.9);
  let n = normalize(cross(axis, helper));
  let m = cross(axis, n);
  let f = min(grown, 1.0) * end;
  // Each tube runs a little past its ends, into its neighbours, so a bend shows no seam.
  let overlap = (end * 2.0 - 1.0) * 0.6 * mix(s.a.w, s.b.w, f);
  let centre = mix(s.a.xyz, s.b.xyz, f) + axis * overlap;
  // Thicker behind the front, as wood is laid down: full a quarter-metre back.
  let depth = mix(s.depth.x, s.depth.y, f);
  let age = clamp((B.grown - depth) / 0.25, 0.0, 1.0);
  let radius = mix(s.a.w, s.b.w, f) * mix(0.35, 1.0, age);
  let around = n * cos(side) + m * sin(side);
  out.position = B.view_proj * vec4f(centre + around * radius, 1.0);
  out.normal = around;
  out.along = depth;
  return out;
}

@fragment fn branch_fs(in: BranchVarying) -> @location(0) vec4f {
  let n = normalize(in.normal);
  // Cherry bark: a red-brown grey, a little lighter on the young wood.
  let bark = mix(vec3f(0.11, 0.065, 0.05), vec3f(0.16, 0.1, 0.07), smoothstep(0.0, 0.6, in.along));
  let lit = max(dot(n, B.sun_dir), 0.0);
  let sky = mix(0.25, 0.55, 0.5 + 0.5 * n.y);
  return vec4f(bark * (B.sun * lit + B.sky * sky), 1.0);
}

struct SkyVarying {
  @builtin(position) position: vec4f,
  @location(0) ndc: vec2f,
}

@vertex fn sky_vs(@builtin(vertex_index) i: u32) -> SkyVarying {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)) * 2.0 - 1.0;
  var out: SkyVarying;
  out.position = vec4f(p, 1.0, 1.0);
  out.ndc = p;
  return out;
}

/** A pale spring sky, softly brighter towards the sun's side. */
@fragment fn sky_fs(in: SkyVarying) -> @location(0) vec4f {
  let t = 0.5 + 0.5 * in.ndc.y;
  var rgb = mix(B.low, B.high, t);
  rgb += B.sun * 0.05 * exp(-dot(in.ndc - vec2f(-0.7, 0.6), in.ndc - vec2f(-0.7, 0.6)) * 1.5);
  return vec4f(rgb, 1.0);
}
