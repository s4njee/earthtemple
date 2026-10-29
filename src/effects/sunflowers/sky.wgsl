#include "sky-params.wgsl"

// Story 12.4's sky behind the rows: a gradient from a hazy horizon to a deep zenith, and below the
// horizon the field running away, gold-green into the haze. Drawn first in the flowers' pass, at
// the far plane.

@group(0) @binding(0) var<uniform> sky: SkyParams;

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

@fragment fn sky_fs(in: SkyVarying) -> @location(0) vec4f {
  // The view ray: forward and up from the camera's pitch, right along x.
  let forward = vec3f(0.0, -sin(sky.pitch), cos(sky.pitch));
  let up = vec3f(0.0, cos(sky.pitch), sin(sky.pitch));
  let ray = normalize(forward + vec3f(1.0, 0.0, 0.0) * in.ndc.x / sky.sx + up * in.ndc.y / sky.sy);
  let height = ray.y;
  var rgb: vec3f;
  if (height >= 0.0) {
    rgb = mix(sky.horizon, sky.zenith, pow(min(height * 1.6, 1.0), 0.6));
    // A glow round the sun.
    let glow = pow(max(dot(ray, sky.sun_dir), 0.0), 24.0);
    rgb += sky.sun * glow * 0.15;
  } else {
    // The field, darkening towards the foot of the view, into the haze at the horizon.
    let near = min(-height * 5.0, 1.0);
    rgb = mix(sky.horizon, sky.field, smoothstep(0.0, 1.0, sqrt(near)));
  }
  return vec4f(rgb, 1.0);
}
