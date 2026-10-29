// The resolved strip of grass, copied texel for texel into the scene's bottom rows. The pass's
// viewport is the strip, so the fullscreen triangle covers only those rows.

@group(0) @binding(0) var strip: texture_2d<f32>;

struct Varying {
  @builtin(position) position: vec4f,
  /** 0..1 across the strip, top-left origin. */
  @location(0) uv: vec2f,
}

@vertex fn strip_vs(@builtin(vertex_index) v: u32) -> Varying {
  let p = vec2f(f32((v << 1u) & 2u), f32(v & 2u));
  var out: Varying;
  out.position = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}

@fragment fn strip_fs(in: Varying) -> @location(0) vec4f {
  let size = vec2f(textureDimensions(strip));
  return textureLoad(strip, vec2i(in.uv * size), 0);
}
