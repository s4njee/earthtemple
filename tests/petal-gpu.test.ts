import { describe, expect, it } from 'vitest';
import { arrange, FLOWERS } from '../src/gpu/flower/diagram.ts';
import { petalPoint, type PetalShape } from '../src/gpu/flower/petal.ts';
import { createFullscreenPipeline, renderFullscreen } from '../src/gpu/fullscreen.ts';
import fullscreen from '../src/wgsl/fullscreen.wgsl';
import petalWgsl from '../src/wgsl/petal.wgsl';
import { getTestDevice, readTexture } from './gpu.ts';

// Story 11.1: the petal shader (src/wgsl/petal.wgsl) puts every point where its CPU twin does.

const W = 32;
const H = 16;

const literal = (s: PetalShape) =>
  `PetalShape(${[
    s.width,
    s.widest,
    s.tip,
    s.claw,
    s.notch,
    s.cup,
    s.curl,
    s.excess,
    s.fringe,
    s.roll,
    s.wrap,
  ]
    .map((x) => x.toFixed(9))
    .join(', ')})`;

async function gpuPoints(shape: PetalShape): Promise<Float32Array> {
  const device = await getTestDevice();
  const texture = device.createTexture({
    size: [W, H],
    format: 'rgba32float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });
  const pipeline = createFullscreenPipeline(device, {
    fragment: {
      label: 'petal test',
      code: `#include "fullscreen.wgsl"
#include "petal.wgsl"
@fragment fn fs(in: FullscreenVarying) -> @location(0) vec4f {
  let px = floor(in.position.xy);
  let u = px.x / ${W - 1}.0;
  let v = px.y / ${H - 1}.0 * 2.0 - 1.0;
  return vec4f(petal_point(${literal(shape)}, u, v), 0.0);
}`,
      chunks: {
        ...fullscreen.chunks,
        ...petalWgsl.chunks,
        'fullscreen.wgsl': fullscreen.code,
        'petal.wgsl': petalWgsl.code,
      },
    },
    format: 'rgba32float',
  });
  const encoder = device.createCommandEncoder();
  renderFullscreen(encoder, texture.createView(), pipeline, []);
  device.queue.submit([encoder.finish()]);
  const values = new Float32Array((await readTexture(device, texture, 16)).buffer);
  texture.destroy();
  return values;
}

describe('petal shader', () => {
  it('matches its CPU twin for every petal of every flower', async () => {
    const shapes = new Map<string, PetalShape>();
    for (const diagram of Object.values(FLOWERS)) {
      for (const organ of arrange(diagram)) {
        if (organ.organ !== 'petal') continue;
        // In units of the petal's length, as the shader takes it, at its open curl.
        const shape = { ...organ.shape, length: 1, curl: organ.curl };
        shapes.set(JSON.stringify(shape), shape);
      }
    }
    let worst = 0;
    for (const shape of shapes.values()) {
      const gpu = await gpuPoints(shape);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const cpu = petalPoint(shape, x / (W - 1), (y / (H - 1)) * 2 - 1);
          const i = (y * W + x) * 4;
          for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(gpu[i + k]! - cpu[k]!));
        }
      }
    }
    expect(shapes.size).toBeGreaterThan(5);
    expect(worst).toBeLessThan(2e-4);
  });
});
