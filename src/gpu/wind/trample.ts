import { createShader, withChunks } from '../shader.ts';
import { createUniformBuffer, defineUniformStruct, uniformArray } from '../uniforms.ts';
import shader from './trample.wgsl';

// Story 2.5: the trample field (trample.wgsl), and its CPU twin for tests.

export const TrampleParams = defineUniformStruct('TrampleParams', {
  origin: 'vec2i',
  cell: 'f32',
  size: 'u32',
  dt: 'f32',
  /** Recovery time constant, s. */
  tau: 'f32',
  /** How fast a brush presses a cell to its bend, per second. */
  press: 'f32',
  /** Up to four brushes: centre (x, z), radius, strength (0 for none). */
  brushes: uniformArray('vec4f', 4),
  /** Their bends: a direction (x, z) and 1 to push along it, 0 to push out from the centre. */
  motions: uniformArray('vec4f', 4),
});

export interface Brush {
  x: number;
  z: number;
  radius: number;
  /** The tip's push, in blade heights. */
  strength: number;
  /** A push along a direction (unit), or out from the centre when absent. */
  along?: readonly [number, number];
}

export interface TrampleOptions {
  /** Cells along each side of the window. */
  size: number;
  /** Cell size, m. */
  cell: number;
  /** Recovery time constant, s. */
  tau: number;
  press?: number;
}

/** What the grass field reads: where the window is, and the buffer. */
export interface TrampleView {
  readonly buffer: GPUBuffer;
  readonly origin: readonly [number, number];
  readonly cell: number;
  readonly size: number;
}

export interface Trample extends TrampleView {
  /** Moves the window to centre on (x, z), then presses and recovers by `dt` seconds. */
  step(
    encoder: GPUCommandEncoder,
    dt: number,
    x: number,
    z: number,
    brushes: readonly Brush[],
  ): void;
  clear(): void;
  destroy(): void;
}

const packBrushes = (brushes: readonly Brush[]) => {
  const b = new Float32Array(16);
  const m = new Float32Array(16);
  brushes.slice(0, 4).forEach((brush, k) => {
    b.set([brush.x, brush.z, brush.radius, brush.strength], k * 4);
    if (brush.along) m.set([brush.along[0], brush.along[1], 1, 0], k * 4);
  });
  return { b, m };
};

export function createTrample(device: GPUDevice, options: TrampleOptions): Trample {
  const { size, cell, tau } = options;
  const press = options.press ?? 20;
  const uniforms = createUniformBuffer(device, TrampleParams, 'trample params');
  const buffer = device.createBuffer({
    label: 'trample bend',
    size: size * size * 8,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
  });
  const module = createShader(
    device,
    withChunks(shader, { 'trample-params.wgsl': TrampleParams.wgsl }),
  );
  const pipeline = device.createComputePipeline({
    label: 'trample step',
    layout: 'auto',
    compute: { module, entryPoint: 'step' },
  });
  const group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: uniforms.buffer } },
      { binding: 1, resource: { buffer } },
    ],
  });
  const origin: [number, number] = [0, 0];
  const groups = Math.ceil(size / 8);

  return {
    buffer,
    origin,
    cell,
    size,
    step(encoder, dt, x, z, brushes) {
      origin[0] = Math.floor(x / cell) - (size >> 1);
      origin[1] = Math.floor(z / cell) - (size >> 1);
      const { b, m } = packBrushes(brushes);
      uniforms.set({ origin, cell, size, dt, tau, press, brushes: b, motions: m });
      uniforms.upload();
      const pass = encoder.beginComputePass({ label: 'trample' });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(groups, groups);
      pass.end();
    },
    clear() {
      device.queue.writeBuffer(buffer, 0, new Float32Array(size * size * 2));
    },
    destroy() {
      uniforms.destroy();
      buffer.destroy();
    },
  };
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** CPU twin: the same window, cells and steps, in double precision. */
export class TrampleModel {
  readonly bend: Float64Array;
  readonly origin: [number, number] = [0, 0];

  constructor(readonly options: TrampleOptions) {
    this.bend = new Float64Array(options.size * options.size * 2);
  }

  step(dt: number, x: number, z: number, brushes: readonly Brush[]): void {
    const { size, cell, tau } = this.options;
    const press = this.options.press ?? 20;
    this.origin[0] = Math.floor(x / cell) - (size >> 1);
    this.origin[1] = Math.floor(z / cell) - (size >> 1);
    const decay = Math.exp(-dt / tau);
    for (let sj = 0; sj < size; sj++) {
      for (let si = 0; si < size; si++) {
        const wx = this.origin[0] + mod(si - this.origin[0], size);
        const wz = this.origin[1] + mod(sj - this.origin[1], size);
        const cx = (wx + 0.5) * cell;
        const cz = (wz + 0.5) * cell;
        const i = (sj * size + si) * 2;
        let bx = this.bend[i]! * decay;
        let bz = this.bend[i + 1]! * decay;
        for (const brush of brushes.slice(0, 4)) {
          if (brush.strength <= 0) continue;
          const d = Math.hypot(cx - brush.x, cz - brush.z);
          if (d >= brush.radius) continue;
          const q = 1 - (d / brush.radius) ** 2;
          const [dx, dz] =
            brush.along ?? (d > 1e-4 ? [(cx - brush.x) / d, (cz - brush.z) / d] : [1, 0]);
          const tx = dx * brush.strength * q * q;
          const tz = dz * brush.strength * q * q;
          if (tx * tx + tz * tz > bx * bx + bz * bz) {
            const k = 1 - Math.exp(-dt * press);
            bx += (tx - bx) * k;
            bz += (tz - bz) * k;
          }
        }
        if (bx * bx + bz * bz < 1e-6) bx = bz = 0;
        this.bend[i] = bx;
        this.bend[i + 1] = bz;
      }
    }
  }

  /** The bend at a world point, bilinear over cells, zero outside the window. */
  sample(x: number, z: number): [number, number] {
    return sampleTrample(this.bend, this.origin, this.options.cell, this.options.size, x, z);
  }
}

/** Bilinear lookup as field.wgsl does it, for any copy of the buffer. */
export function sampleTrample(
  bend: ArrayLike<number>,
  origin: readonly [number, number],
  cell: number,
  size: number,
  x: number,
  z: number,
): [number, number] {
  const u = x / cell - 0.5;
  const v = z / cell - 0.5;
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const fu = u - i0;
  const fv = v - j0;
  let ox = 0;
  let oz = 0;
  for (const [di, dj, w] of [
    [0, 0, (1 - fu) * (1 - fv)],
    [1, 0, fu * (1 - fv)],
    [0, 1, (1 - fu) * fv],
    [1, 1, fu * fv],
  ] as const) {
    const wi = i0 + di;
    const wj = j0 + dj;
    if (wi < origin[0] || wi >= origin[0] + size || wj < origin[1] || wj >= origin[1] + size)
      continue;
    const k = (mod(wj, size) * size + mod(wi, size)) * 2;
    ox += w * bend[k]!;
    oz += w * bend[k + 1]!;
  }
  return [ox, oz];
}
