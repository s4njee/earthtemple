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
  for (let i = 0; i < m.bend.length; i += 2)
    worst = Math.max(worst, Math.hypot(m.bend[i]!, m.bend[i + 1]!));
  return worst;
};

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
      worst = Math.max(worst, Math.abs(bend[i]! - cpu.bend[i]!));
    expect(maxBend(cpu)).toBeGreaterThan(0.3);
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
    const before = Float64Array.from(m.bend);
    m.step(0, 0.7, 0.2, []);
    expect(m.bend.every((b, i) => b === before[i])).toBe(true);
    let last = pressed;
    for (let k = 0; k < 60 * 12; k++) {
      m.step(1 / 60, 0.7, 0.2, []);
      const now = maxBend(m);
      expect(now).toBeLessThanOrEqual(last + 1e-12);
      last = now;
    }
    expect(m.bend.every((b) => b === 0)).toBe(true);
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
    expect(m.sample(-3, -3)).toEqual([0, 0]);
  });
});
