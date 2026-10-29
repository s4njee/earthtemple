#include "clouds.wgsl"
#include "sky-params.wgsl"

// The meadow's sky: a gradient from the haze at the horizon to the zenith, the sun's disc and the
// glow around it (brighter low in the haze), and a layer of cumulus 1.5 km up, the same clouds
// whose shadows cross the grass (clouds.wgsl). Along the horizon, the far edge of the field: a
// hedgerow or tree line, a ragged silhouette by azimuth, faded into the haze by its distance.
// Rays come from the meadow's level camera, whose horizon is set by shifting the lens.

@group(0) @binding(0) var<uniform> S: SkyParams;

struct Varying {
  @builtin(position) position: vec4f,
  @location(0) ndc: vec2f,
}

@vertex fn sky_vs(@builtin(vertex_index) v: u32) -> Varying {
  let p = vec2f(f32((v << 1u) & 2u), f32(v & 2u)) * 2.0 - 1.0;
  var out: Varying;
  out.position = vec4f(p, 0.0, 1.0);
  out.ndc = p;
  return out;
}

const CLOUD_HEIGHT: f32 = 1500.0;

@fragment fn sky_fs(in: Varying) -> @location(0) vec4f {
  let dir = normalize(vec3f(in.ndc.x / S.sx, (in.ndc.y - S.horizon) / S.sy, 1.0));
  let e = dir.y;
  var c = mix(S.haze, S.zenith, pow(saturate(e), 0.45));
  let mu = dot(dir, S.sun_dir);
  let low = 1.0 + 2.0 * (1.0 - saturate(e * 4.0));
  c += S.sun * S.glow * (0.03 * pow(saturate(mu), 6.0) + 0.2 * pow(saturate(mu), 160.0)) * low;
  if (S.sun_dir.y > -0.01) {
    let disc = smoothstep(0.999985, 0.999993, mu);
    c += S.sun * 30.0 * disc;
  }
  // The far hedge, a fraction of a degree to a degree tall, with gaps.
  let az = atan2(dir.x, dir.z);
  let ridge = S.hedge * (0.35 + 0.65 * value_noise(vec2f(az * 60.0, 3.0), 61u)) *
    smoothstep(0.2, 0.45, value_noise(vec2f(az * 9.0, 5.0), 62u));
  if (e < ridge) {
    return vec4f(mix(S.hedge_colour, S.haze, 0.55), 1.0);
  }
  if (e > 0.015 && S.cloud_depth > 0.0) {
    let t = CLOUD_HEIGHT / e;
    let p = S.eye.xz + dir.xz * t;
    let cover = cloud_cover(p, S.wind_dir, S.time, S.cloud_speed, S.cloud_scale);
    let lit = S.haze * 1.1 + S.sun * (0.12 + 0.2 * pow(saturate(mu), 4.0));
    let far = exp(-t / 15000.0);
    c = mix(c, lit, cover * far * min(1.0, 1.6 * S.cloud_depth));
  }
  return vec4f(c, 1.0);
}
