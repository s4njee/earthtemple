#include "wind.wgsl"
#include "clouds.wgsl"
#include "grass-flags.wgsl"

// Story 2.6: how a blade is lit. Shared by the blades (draw.wgsl) and the far canopy (ground.wgsl),
// so the field and the ground beyond it are lit by the same model and meet without a seam. Needs
// `F: Field` and `L: Look` declared by the includer.
//
// - Leaf optics. Reflectance and transmittance come from the pigments (src/gpu/optics/leaf.ts),
//   root to tip and lush to pale, and for dead blades and seed heads.
// - Diffuse light on the side facing the sun, Lambertian.
// - Translucency. On the side away from the sun, the light through the blade: the leaf's
//   transmittance, which is greener and deeper than its surface. A backlit meadow glows with it.
// - Sheen. The waxy cuticle's specular, a broad Kajiya-Kay lobe stretched along the blade, with
//   Fresnel. A blade seen edge-on shows almost no surface, and one a pixel or two wide cannot
//   resolve a highlight, so the sheen fades out on both rather than glinting.
//   Gusts tilt whole patches of blades together, and their sheen is the wave seen crossing a field.
// - Canopy occlusion. Light falls off with depth into the canopy by the Beer-Lambert law, at the
//   leaf area index: for the sun along its slant path, for the sky diffusely. Roots are dark.
// - Cloud shadows. The sky's clouds (clouds.wgsl) dim the sun in patches as they drift over.
// - Sky light from above, and aerial perspective towards the horizon colour.

struct Surface {
  reflect: vec3f,
  transmit: vec3f,
}

/** kind: 0 leaf, 1 dry, 2 seed-head stem, 3 flower stem. head: 0..1 into a seed head. */
fn blade_surface(kind: f32, tone: f32, t: f32, head: f32) -> Surface {
  let k = u32(kind);
  let along = pow(t, 0.8);
  if (k == 1u) {
    return Surface(L.dead * mix(0.8, 1.12, tone), L.t_dead);
  }
  if (k >= 2u) {
    // A stem: paler and drier than the leaves, its seed head chaff.
    let stem = Surface(L.tip_pale * mix(0.85, 1.1, tone), L.t_tip * 0.8);
    let chaff = Surface(L.head * mix(0.8, 1.15, tone), L.t_dead);
    return Surface(mix(stem.reflect, chaff.reflect, head), mix(stem.transmit, chaff.transmit, head));
  }
  let root = mix(L.root_lush, L.root_pale, tone);
  let tip = mix(L.tip_lush, L.tip_pale, tone);
  return Surface(mix(root, tip, along), mix(L.t_root, L.t_tip, along));
}

fn cloud_shadow(p: vec2f) -> f32 {
  if (!has(F.flags, CLOUDS) || L.cloud_depth <= 0.0) { return 1.0; }
  return 1.0 - L.cloud_depth * cloud_cover(p, F.wind_dir, F.time, L.cloud_speed, L.cloud_scale);
}

/**
 * How a blade surface at `world` with normal `n` (facing the viewer) and `tangent` is lit.
 * `pixels` is the blade's width on screen: a glint on a blade a pixel or two wide can only alias.
 */
fn shade_surface(s: Surface, n: vec3f, tangent: vec3f, world: vec3f, pixels: f32) -> vec3f {
  let v = normalize(F.eye - world);
  let l = L.sun_dir;
  var sun_open = 1.0;
  var sky_open = 1.0;
  if (has(F.flags, CANOPY)) {
    let depth = saturate(1.0 - world.y / L.canopy_height);
    sun_open = exp(-0.5 * L.lai * depth / max(l.y, 0.15));
    sky_open = exp(-0.9 * L.lai * depth);
  }
  let sun = L.sun * sun_open * cloud_shadow(world.xz);
  let ndl = dot(n, l);
  var c = s.reflect * max(ndl, 0.0) * sun;
  if (has(F.flags, TRANSLUCENCY)) {
    c += s.transmit * L.transmit * max(-ndl, 0.0) * sun;
  }
  if (has(F.flags, SHEEN)) {
    let h = normalize(l + v);
    let along = dot(tangent, h);
    let facing = abs(dot(n, v));
    let fresnel = 0.04 + 0.96 * pow(max(1.0 - facing, 0.0), 5.0);
    // A broad lobe: a sharp one glints, and glints on fluttering blades shimmer (story 2.7).
    let lobe = pow(sqrt(max(1.0 - along * along, 0.0)), 16.0);
    let resolved = smoothstep(1.5, 4.0, pixels);
    c += vec3f(0.5 * L.sheen * fresnel * lobe * smoothstep(0.05, 0.35, facing) * max(ndl, 0.0) * resolved) * sun;
  }
  c += s.reflect * L.sky * sky_open * (0.6 + 0.4 * n.y);
  if (has(F.flags, FOG) && L.fog > 0.0) {
    c = mix(c, L.horizon, 1.0 - exp(-distance(world, F.eye) / L.fog));
  }
  return c;
}
