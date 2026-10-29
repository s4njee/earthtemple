#include "fullscreen.wgsl"
#include "hash.wgsl"
#include "params.wgsl"

// Story 3.6: fur, grass or moss growing from a heading's letters, by shells (Lengyel et al.) in one
// pass: each pixel walks the coat's layers from the tips down and takes the first strands it meets.
//
// - Strands. One to a cell of a grid on the skin, present by the cell's hash and only where its root
//   is inside the letters (the text field, px, negative inside), thinning over `feather` at the edge.
//   That is worked out once, into a strand map (`strand_map`), not at every layer.
//   A strand bends along the comb: at height t it sits `lean * t²` from its root, so the tips lie
//   over and the roots stand. Between two layers it is a capsule from one height to the next, so a
//   laid strand is a streak and not a row of dots.
// - Comb. A direction field (rg, the lean as a fraction of the strand's length) the pointer combs on
//   the CPU and that relaxes back to the coat's rest; a little wind sways it.
// - Shading. Kajiya and Kay's strand model, with the strand's tangent from its bend: diffuse by the
//   sine to the light, a white highlight and a tinted second one, darker towards the roots (the coat
//   shadows itself), the skin beneath darker still.

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var text: texture_2d<f32>;
@group(0) @binding(2) var comb: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;
@group(0) @binding(4) var strands: texture_2d<f32>;

const LAYERS: i32 = 28;

fn letters(p: vec2f) -> f32 {
  return textureSampleLevel(text, smp, p / vec2f(params.width, params.height), 0.0).r;
}

fn combed(p: vec2f) -> vec2f {
  let c = textureSampleLevel(comb, smp, p / vec2f(params.width, params.height), 0.0).xy;
  let s = p / params.css;
  let sway = vec2f(
    sin(params.time * 1.3 + s.y * 0.011 + s.x * 0.006),
    0.5 * sin(params.time * 0.9 + s.x * 0.009),
  );
  return c + params.sway * sway;
}

// Tufts: strands near each other share a tone, as a pelt's do. Value noise over cells.
fn tuft(cell: vec2f) -> f32 {
  let q = cell / 7.0;
  let i = floor(q);
  let f = q - i;
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash_2to1(i + params.seed);
  let b = hash_2to1(i + vec2f(1.0, 0.0) + params.seed);
  let c = hash_2to1(i + vec2f(0.0, 1.0) + params.seed);
  let d = hash_2to1(i + vec2f(1.0, 1.0) + params.seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// The strand map, a texel per cell, made once per heading and coat: which cells grow a strand and
// how tall (r, 0 for none), where in its cell its root is (gb), and its tone (a). It holds what
// every layer would otherwise find again: the letters at the root and the cell's hashes.
@fragment fn strand_map(in: FullscreenVarying) -> @location(0) vec4f {
  let cell = floor(in.position.xy);
  let h = hash_2to3(cell + params.seed);
  let g = hash_2to3(cell + params.seed + 31.7);
  let jitter = (g.xy - 0.5) * 0.4;
  let d = letters((cell + 0.5 + jitter) * params.cell);
  if (h.x > params.density * saturate(0.5 - d / params.feather)) { return vec4f(0.0); }
  return vec4f(mix(0.55, 1.0, h.y), jitter, mix(0.55, 1.25, tuft(cell)) * mix(0.85, 1.15, h.z));
}

fn segment_distance(p: vec2f, a: vec2f, b: vec2f) -> f32 {
  let ab = b - a;
  let k = saturate(dot(p - a, ab) / max(dot(ab, ab), 1e-6));
  return length(p - a - ab * k);
}

@fragment fn fur(in: FullscreenVarying) -> @location(0) vec4f {
  let p = in.position.xy;
  let c = combed(p);
  let lean = c * params.length;
  let light = normalize(vec3f(-0.45, -0.6, 0.66));
  let half_v = normalize(light + vec3f(0.0, 0.0, 1.0));
  var colour = vec3f(0.0);
  var alpha = 0.0;
  let step = 1.0 / f32(LAYERS);
  // No strand reaches further from the letters than its lean, its radius and the cell its root
  // is jittered in: most of the view is that far, and skips the layers.
  let reach = length(lean) * 1.1 + params.radius + 2.0 * params.cell + params.feather;
  let d = letters(p);
  let near = d < reach;
  let map_size = vec2i(textureDimensions(strands));
  for (var k = LAYERS - 1; k >= 0 && near; k--) {
    let t0 = f32(k) * step;
    let t1 = t0 + step;
    let tm = t0 + 0.5 * step;
    // The cell under this pixel at the slab's middle height.
    let cell = floor((p - lean * tm * tm) / params.cell);
    let texel = vec2i(cell);
    if (any(texel < vec2i(0)) || any(texel >= map_size)) { continue; }
    let strand = textureLoad(strands, texel, 0);
    if (strand.r <= 0.0) { continue; }
    let centre = (cell + 0.5 + strand.gb) * params.cell;
    let tall = strand.r * params.grown;
    if (t0 >= tall) { continue; }
    let top = min(t1, tall);
    let r = params.radius * (1.0 - 0.75 * tm / tall);
    let dist = segment_distance(p, centre + lean * t0 * t0, centre + lean * top * top);
    let cover = saturate(r - dist + 0.5) * min(1.0, r * 2.0 + 0.2);
    if (cover <= 0.0) { continue; }
    // The strand's tangent from its bend, its height in px per unit of length `rise`.
    let tangent = normalize(vec3f(2.0 * tm * c, params.rise));
    let tl = dot(tangent, light);
    let diffuse = sqrt(max(0.0, 1.0 - tl * tl));
    let th = dot(tangent, half_v);
    let spec = pow(sqrt(max(0.0, 1.0 - th * th)), params.shine);
    let shifted = normalize(tangent + vec3f(0.0, 0.0, 0.3));
    let th2 = dot(shifted, half_v);
    let spec2 = pow(sqrt(max(0.0, 1.0 - th2 * th2)), params.shine * 0.3);
    let up = tm / tall;
    let base = mix(params.root, params.tip, smoothstep(0.15, 1.0, up)) * strand.a;
    let shade = mix(params.ao, 1.0, up);
    let lit = (base * (params.ambient + params.light * diffuse) +
      params.spec * (spec * 0.6 + spec2 * 0.4 * base * 4.0)) * shade;
    let a = cover * (1.0 - alpha);
    colour += lit * a;
    alpha += a;
    if (alpha > 0.985) { break; }
  }
  // The skin beneath the coat.
  let skin = saturate(0.5 - d) * (1.0 - alpha);
  colour += params.skin * skin;
  alpha += skin;
  if (params.scene == 0u) {
    let uv = p / vec2f(params.width, params.height);
    let back = mix(params.back_top.rgb, params.back_bottom.rgb, uv.y);
    return vec4f(colour + back * (1.0 - alpha), 1.0);
  }
  return vec4f(colour, alpha);
}
