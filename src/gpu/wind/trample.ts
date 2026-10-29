import { createShader, withChunks } from '../shader.ts';
import { createUniformBuffer, defineUniformStruct, uniformArray } from '../uniforms.ts';
import shader from './trample.wgsl';

// Stories 2.5 and 3.4: the trample field (trample.wgsl), and its CPU twin for tests. Each cell is
// four numbers: the bend (x, z), which springs back, and the lay (x, z) a mower leaves, which stays.

export const TrampleParams = defineUniformStruct('TrampleParams', {
  origin: 'vec2i',
  cell: 'f32',
  size: 'u32',
  dt: 'f32',
  /** Recovery time constant, s. */
  tau: 'f32',
  /** How fast a brush presses a cell to its bend, per second. */
  press: 'f32',
  /** How long mown grass takes to regrow, s (time constant); 0 for never. */
  regrow: 'f32',
  /** How many of the brushes are in use. */
  count: 'u32',
  /** Up to BRUSHES brushes: centre (x, z), radius, strength. */
  brushes: uniformArray('vec4f', 64),
  /**
   * Their bends: a direction (x, z); 1 to push along it, 0 to push out from the centre; 0 for a
   * push, or 1 plus the pass's length for a mower, which cuts and lays instead of pressing.
   */
  motions: uniformArray('vec4f', 64),
});

/** Brushes one step can take: a mower catching up lays many in a frame. */
export const BRUSHES = 64;

export interface Brush {
  x: number;
  z: number;
  radius: number;
  /** The tip's push, in blade heights. */
  strength: number;
  /** A push along a direction (unit), or out from the centre when absent. */
  along?: readonly [number, number];
  /** A mower: cuts and lays the grass along `along`, which stays laid. */
  mow?: boolean;
  /**
   * A mower's pass, m: it covers the path from `length` back along `along` to (x, z), so a whole
   * row is one brush.
   */
  length?: number;
}

export interface TrampleOptions {
  /** Cells along each side of the window. */
  size: number;
  /** Cell size, m. */
  cell: number;
  /** Recovery time constant, s. */
  tau: number;
  press?: number;
  /** Mown grass's regrowth time constant, s; 0 (the default) for never. */
  regrow?: number;
}

/** What the grass field reads: where the window is, and the buffer. */
export interface TrampleView {
  readonly buffer: GPUBuffer;
  readonly origin: readonly [number, number];
  readonly cell: number;
  readonly size: number;
}

export interface Trample extends TrampleView {
  /**
   * Moves the window to centre on (x, z), then presses and recovers by `dt` seconds. Once a frame:
   * two steps in one command buffer would both read the second's uniforms. Up to BRUSHES brushes.
   */
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
  const b = new Float32Array(4 * BRUSHES);
  const m = new Float32Array(4 * BRUSHES);
  brushes.slice(0, BRUSHES).forEach((brush, k) => {
    b.set([brush.x, brush.z, brush.radius, brush.strength], k * 4);
    if (brush.along) {
      m.set([brush.along[0], brush.along[1], 1, brush.mow ? 1 + (brush.length ?? 0) : 0], k * 4);
    }
  });
  return { b, m };
};

export function createTrample(device: GPUDevice, options: TrampleOptions): Trample {
  const { size, cell, tau } = options;
  const press = options.press ?? 20;
  const regrow = options.regrow ?? 0;
  const uniforms = createUniformBuffer(device, TrampleParams, 'trample params');
  const buffer = device.createBuffer({
    label: 'trample cells',
    size: size * size * 16,
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
      const count = Math.min(brushes.length, BRUSHES);
      uniforms.set({ origin, cell, size, dt, tau, press, regrow, count, brushes: b, motions: m });
      uniforms.upload();
      const pass = encoder.beginComputePass({ label: 'trample' });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.dispatchWorkgroups(groups, groups);
      pass.end();
    },
    clear() {
      device.queue.writeBuffer(buffer, 0, new Float32Array(size * size * 4));
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
  /** Four numbers a cell, as the GPU's buffer: bend (x, z), then lay (x, z). */
  readonly cells: Float64Array;
  readonly origin: [number, number] = [0, 0];

  constructor(readonly options: TrampleOptions) {
    this.cells = new Float64Array(options.size * options.size * 4);
  }

  step(dt: number, x: number, z: number, brushes: readonly Brush[]): void {
    const { size, cell, tau } = this.options;
    const press = this.options.press ?? 20;
    this.origin[0] = Math.floor(x / cell) - (size >> 1);
    this.origin[1] = Math.floor(z / cell) - (size >> 1);
    const decay = Math.exp(-dt / tau);
    const regrow = this.options.regrow ?? 0;
    const fade = regrow > 0 ? Math.exp(-dt / regrow) : 1;
    for (let sj = 0; sj < size; sj++) {
      for (let si = 0; si < size; si++) {
        const wx = this.origin[0] + mod(si - this.origin[0], size);
        const wz = this.origin[1] + mod(sj - this.origin[1], size);
        const cx = (wx + 0.5) * cell;
        const cz = (wz + 0.5) * cell;
        const i = (sj * size + si) * 4;
        let bx = this.cells[i]! * decay;
        let bz = this.cells[i + 1]! * decay;
        let lx = this.cells[i + 2]! * fade;
        let lz = this.cells[i + 3]! * fade;
        for (const brush of brushes.slice(0, BRUSHES)) {
          if (brush.strength <= 0) continue;
          let d = Math.hypot(cx - brush.x, cz - brush.z);
          if (brush.mow && brush.along && brush.length) {
            // The distance to the pass, from its start to the brush.
            const [ax, az] = brush.along;
            const back = (brush.x - cx) * ax + (brush.z - cz) * az;
            const s = Math.min(Math.max(back, 0), brush.length);
            d = Math.hypot(cx - (brush.x - ax * s), cz - (brush.z - az * s));
          }
          if (d >= brush.radius) continue;
          const q = 1 - (d / brush.radius) ** 2;
          const [dx, dz] =
            brush.along ?? (d > 1e-4 ? [(cx - brush.x) / d, (cz - brush.z) / d] : [1, 0]);
          if (brush.mow && brush.along) {
            const k = Math.min(Math.max(4 * q, 0), 1);
            lx += (dx * brush.strength - lx) * k;
            lz += (dz * brush.strength - lz) * k;
            continue;
          }
          const tx = dx * brush.strength * q * q;
          const tz = dz * brush.strength * q * q;
          if (tx * tx + tz * tz > bx * bx + bz * bz) {
            const k = 1 - Math.exp(-dt * press);
            bx += (tx - bx) * k;
            bz += (tz - bz) * k;
          }
        }
        if (bx * bx + bz * bz < 1e-6) bx = bz = 0;
        if (lx * lx + lz * lz < 1e-6) lx = lz = 0;
        this.cells[i] = bx;
        this.cells[i + 1] = bz;
        this.cells[i + 2] = lx;
        this.cells[i + 3] = lz;
      }
    }
  }

  /** The cell at a world point (bend x, z, lay x, z), bilinear, zero outside the window. */
  sample(x: number, z: number): [number, number, number, number] {
    return sampleTrample(this.cells, this.origin, this.options.cell, this.options.size, x, z);
  }
}

/** Bilinear lookup as field.wgsl does it, for any copy of the buffer (four numbers a cell). */
export function sampleTrample(
  cells: ArrayLike<number>,
  origin: readonly [number, number],
  cell: number,
  size: number,
  x: number,
  z: number,
): [number, number, number, number] {
  const u = x / cell - 0.5;
  const v = z / cell - 0.5;
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const fu = u - i0;
  const fv = v - j0;
  const out: [number, number, number, number] = [0, 0, 0, 0];
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
    const k = (mod(wj, size) * size + mod(wi, size)) * 4;
    for (let c = 0; c < 4; c++) out[c]! += w * cells[k + c]!;
  }
  return out;
}
