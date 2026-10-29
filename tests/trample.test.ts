import { describe, expect, it } from 'vitest';
import { createTrample, TrampleModel, type Brush } from '../src/gpu/wind/trample.ts';
import { getTestDevice } from './gpu.ts';

// Story 2.5: grass pressed down springs back, to exactly nothing, and the shader does what its
// CPU twin does.

const OPTIONS = { size: 64, cell: 0.05, tau: 1.5 };

const stroke = (k: number): Brush[] =>
  k < 30 ? [{ x: 0.4 + 0.02 * k, z: 0.1, radius: 0.3, strength: 1.2, along: [1, 0] }] : [];

const maxBend = (m: TrampleModel) => {
  let worst = 0;
  for (let i = 0; i < m.cells.length; i += 4)
    worst = Math.max(worst, Math.hypot(m.cells[i]!, m.cells[i + 1]!));
  return worst;
};

const maxLay = (m: TrampleModel) => {
  let worst = 0;
  for (let i = 0; i < m.cells.length; i += 4)
    worst = Math.max(worst, Math.hypot(m.cells[i + 2]!, m.cells[i + 3]!));
  return worst;
};

/** A mower driving along x and back along the next row, as a lawn is striped. */
const mower = (k: number): Brush[] =>
  k < 40
    ? [
        {
          x: k < 20 ? 0.2 + 0.05 * k : 1.2 - 0.05 * (k - 20),
          z: k < 20 ? 0 : 0.3,
          radius: 0.12,
          strength: 1,
          along: k < 20 ? [1, 0] : [-1, 0],
          mow: true,
        },
      ]
    : [];

describe('trample field', () => {
  it('matches its CPU twin as a brush sweeps across and the grass recovers', async () => {
    const device = await getTestDevice();
    const gpu = createTrample(device, OPTIONS);
    const cpu = new TrampleModel(OPTIONS);
    for (let k = 0; k < 60; k++) {
      const encoder = device.createCommandEncoder();
      gpu.step(encoder, 1 / 60, 0.7, 0.2, stroke(k));
      device.queue.submit([encoder.finish()]);
      cpu.step(1 / 60, 0.7, 0.2, stroke(k));
    }
    const read = device.createBuffer({
      size: gpu.buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(gpu.buffer, 0, read, 0, gpu.buffer.size);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const bend = new Float32Array(read.getMappedRange().slice(0));
    let worst = 0;
    for (let i = 0; i < bend.length; i++)
      worst = Math.max(worst, Math.abs(bend[i]! - cpu.cells[i]!));
    expect(maxBend(cpu)).toBeGreaterThan(0.3);
    expect(worst).toBeLessThan(1e-4);
    read.destroy();
    gpu.destroy();
  });

  it('keeps mown grass laid the way the mower went, stripe by stripe, until it regrows', async () => {
    const device = await getTestDevice();
    const gpu = createTrample(device, OPTIONS);
    const cpu = new TrampleModel(OPTIONS);
    for (let k = 0; k < 40 + 120; k++) {
      const encoder = device.createCommandEncoder();
      gpu.step(encoder, 1 / 60, 0.7, 0.2, mower(k));
      device.queue.submit([encoder.finish()]);
      cpu.step(1 / 60, 0.7, 0.2, mower(k));
    }
    // Two seconds after the mower has passed, the stripes are as laid as it left them.
    const there = cpu.sample(0.6, 0);
    const back = cpu.sample(0.6, 0.3);
    expect(there[2]).toBeGreaterThan(0.9);
    expect(back[2]).toBeLessThan(-0.9);
    expect(Math.abs(there[3]!)).toBeLessThan(1e-9);
    const read = device.createBuffer({
      size: gpu.buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(gpu.buffer, 0, read, 0, gpu.buffer.size);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const cells = new Float32Array(read.getMappedRange().slice(0));
    let worst = 0;
    for (let i = 0; i < cells.length; i++)
      worst = Math.max(worst, Math.abs(cells[i]! - cpu.cells[i]!));
    expect(worst).toBeLessThan(1e-4);
    read.destroy();
    gpu.destroy();
    // With regrowth, the lay fades to exactly nothing.
    const growing = new TrampleModel({ ...OPTIONS, regrow: 2 });
    for (let k = 0; k < 40; k++) growing.step(1 / 60, 0.7, 0.2, mower(k));
    expect(maxLay(growing)).toBeGreaterThan(0.9);
    for (let k = 0; k < 60 * 20; k++) growing.step(1 / 60, 0.7, 0.2, []);
    expect(maxLay(growing)).toBe(0);
  });

  it('mows a whole pass in one brush, from its start to the mower', async () => {
    // One frame: a 1 m pass along x ending at x = 1.2, as a held frame catching up would mow it.
    const pass: Brush[] = [
      { x: 1.2, z: 0, radius: 0.12, strength: 1, along: [1, 0], mow: true, length: 1 },
    ];
    const device = await getTestDevice();
    const gpu = createTrample(device, OPTIONS);
    const cpu = new TrampleModel(OPTIONS);
    const encoder = device.createCommandEncoder();
    gpu.step(encoder, 1 / 60, 0.7, 0.2, pass);
    const read = device.createBuffer({
      size: gpu.buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    encoder.copyBufferToBuffer(gpu.buffer, 0, read, 0, gpu.buffer.size);
    device.queue.submit([encoder.finish()]);
    cpu.step(1 / 60, 0.7, 0.2, pass);
    for (const x of [0.25, 0.7, 1.15]) expect(cpu.sample(x, 0)[2]).toBeGreaterThan(0.9);
    // Not before its start, nor past the mower, nor beside the row.
    for (const [x, z] of [
      [0.05, 0],
      [1.4, 0],
      [0.7, 0.3],
    ] as const) {
      expect(cpu.sample(x, z)[2]).toBe(0);
    }
    await read.mapAsync(GPUMapMode.READ);
    const cells = new Float32Array(read.getMappedRange().slice(0));
    let worst = 0;
    for (let i = 0; i < cells.length; i++)
      worst = Math.max(worst, Math.abs(cells[i]! - cpu.cells[i]!));
    expect(worst).toBeLessThan(1e-4);
    read.destroy();
    gpu.destroy();
  });

  it('springs back without overshoot, to exactly zero, and stands still while paused', () => {
    const m = new TrampleModel(OPTIONS);
    for (let k = 0; k < 30; k++) m.step(1 / 60, 0.7, 0.2, stroke(k));
    const pressed = maxBend(m);
    expect(pressed).toBeGreaterThan(0.5);
    // Never pressed harder than the brush.
    expect(pressed).toBeLessThanOrEqual(1.2);
    // Paused: no time passes, nothing changes.
    const before = Float64Array.from(m.cells);
    m.step(0, 0.7, 0.2, []);
    expect(m.cells.every((b, i) => b === before[i])).toBe(true);
    let last = pressed;
    for (let k = 0; k < 60 * 12; k++) {
      m.step(1 / 60, 0.7, 0.2, []);
      const now = maxBend(m);
      expect(now).toBeLessThanOrEqual(last + 1e-12);
      last = now;
    }
    expect(m.cells.every((b) => b === 0)).toBe(true);
  });

  it('keeps a pressed cell where it is on the ground as the window follows the camera', () => {
    const m = new TrampleModel(OPTIONS);
    for (let k = 0; k < 10; k++) {
      m.step(1 / 60, 0, 0, [{ x: 0.3, z: 0.3, radius: 0.15, strength: 1 }]);
    }
    const here = m.sample(0.35, 0.3);
    expect(Math.hypot(...here)).toBeGreaterThan(0.2);
    // The camera moves half a window; the pressed spot is still in it, and still pressed.
    m.step(1e-6, 1.2, 0.4, []);
    const moved = m.sample(0.35, 0.3);
    expect(moved[0]).toBeCloseTo(here[0], 4);
    expect(moved[1]).toBeCloseTo(here[1], 4);
    // Out of the window, there is nothing.
    expect(m.sample(-3, -3)).toEqual([0, 0, 0, 0]);
  });
});
