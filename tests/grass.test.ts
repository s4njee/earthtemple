import { describe, expect, it } from 'vitest';
import { arcLength, bezier, bladeShape, SPECIES, type Vec3 } from '../src/gpu/grass/blade.ts';
import { groundCamera, type GroundCamera } from '../src/gpu/grass/camera.ts';
import { createGrassField, type GrassSettings } from '../src/gpu/grass/field.ts';
import { placeBlades } from '../src/gpu/grass/place.ts';
import { groundWind, type Wind } from '../src/gpu/wind/wind.ts';
import { createTrample } from '../src/gpu/wind/trample.ts';
import { getTestDevice } from './gpu.ts';

// Stories 2.1 to 2.4: the blade, the field against its CPU twin, placement that is stable and
// never repeats, and wind that moves neighbours together.

const SIZE = { width: 480, height: 160 };

const settings = (over: Partial<GrassSettings> = {}): GrassSettings => ({
  species: SPECIES.meadow,
  density: 0.6,
  heightScale: 1,
  clump: 0.12,
  lod0: 4,
  lod1: 7,
  fade: 6,
  wind: { dir: [0.94, 0.34], lean: 0.1, gust: 0.28, speed: 2.4, scale: 1.6, flutter: 0.05 },
  pointer: [0, -2, 0.12, 0],
  seed: 7,
  minPixels: 0.04,
  ...over,
});

const camera = (x = 0): GroundCamera =>
  groundCamera({
    aspect: SIZE.width / SIZE.height,
    eyeHeight: 0.24,
    horizon: -0.44,
    bottomDistance: 2.9,
    start: 2.4,
    far: 12,
    x,
  });

interface GpuBlade {
  lod: number;
  v0: Vec3;
  v2: Vec3;
  width: number;
}

async function runGpu(cam: GroundCamera, s: GrassSettings, time: number) {
  const device = await getTestDevice();
  const field = createGrassField(device, { capacity: 60_000, format: 'rgba16float' });
  field.update(cam, s, time, SIZE);
  const encoder = device.createCommandEncoder();
  field.compute(encoder);
  const argsRead = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const bladesRead = device.createBuffer({
    size: field.blades.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  encoder.copyBufferToBuffer(field.args, 0, argsRead, 0, 64);
  encoder.copyBufferToBuffer(field.blades, 0, bladesRead, 0, field.blades.size);
  device.queue.submit([encoder.finish()]);
  await Promise.all([argsRead.mapAsync(GPUMapMode.READ), bladesRead.mapAsync(GPUMapMode.READ)]);
  const args = new Uint32Array(argsRead.getMappedRange().slice(0));
  const data = new Float32Array(bladesRead.getMappedRange().slice(0));
  const counts = [args[1]!, args[5]!, args[9]!, args[13]!];
  const blades: GpuBlade[] = [];
  counts.forEach((n, lod) => {
    for (let k = 0; k < n; k++) {
      const o = (lod * field.capacity + k) * 12;
      blades.push({
        lod,
        v0: [data[o]!, data[o + 1]!, data[o + 2]!],
        width: data[o + 3]!,
        v2: [data[o + 8]!, data[o + 9]!, data[o + 10]!],
      });
    }
  });
  argsRead.destroy();
  bladesRead.destroy();
  field.destroy();
  return { counts, blades, vertexCounts: [args[0]!, args[4]!, args[8]!, args[12]!] };
}

/** Roots matched to within a micrometre: f32 and f64 round them differently. */
function byRoot<T extends { v0: Vec3 }>(blades: readonly T[]) {
  const cells = new Map<string, T[]>();
  const at = (x: number, z: number) => `${Math.round(x * 1e3)},${Math.round(z * 1e3)}`;
  for (const b of blades) {
    const k = at(b.v0[0], b.v0[2]);
    cells.set(k, [...(cells.get(k) ?? []), b]);
  }
  return (v: Vec3): T | undefined => {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const near = cells.get(`${Math.round(v[0] * 1e3) + i},${Math.round(v[2] * 1e3) + j}`);
        const hit = near?.find((b) => Math.hypot(b.v0[0] - v[0], b.v0[2] - v[2]) < 1e-6);
        if (hit) return hit;
      }
    }
    return undefined;
  };
}

describe('grass blade', () => {
  it('keeps its length within 1% however far the wind bends it, and stays above the ground', () => {
    let worst = 0;
    for (let i = 0; i <= 120; i++) {
      const sideways = (i / 120) * 3;
      for (const angle of [0, 1.1, 2.6]) {
        const h = 0.3;
        const v0: Vec3 = [0.4, 0, -0.2];
        const tip: Vec3 = [
          v0[0] + Math.cos(angle) * sideways * h,
          h,
          v0[2] + Math.sin(angle) * sideways * h,
        ];
        const { v1, v2 } = bladeShape(v0, tip, h);
        worst = Math.max(worst, Math.abs(arcLength(v0, v1, v2) / h - 1));
        for (let k = 0; k <= 16; k++)
          expect(bezier(v0, v1, v2, k / 16)[1]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(worst).toBeLessThan(0.01);
  });
});

describe('grass field', () => {
  it('draws exactly the blades its CPU twin places, in the right LOD lists', async () => {
    const s = settings();
    const cam = camera();
    const time = 3.7;
    const gpu = await runGpu(cam, s, time);
    const cpu = placeBlades(cam, s, time, SIZE);
    expect(gpu.vertexCounts).toEqual([15, 7, 3, 4]);
    const cpuCounts = [0, 1, 2, 3].map((lod) => cpu.filter((b) => b.lod === lod).length);
    expect(cpuCounts[3]).toBeGreaterThan(0);
    const total = cpu.length;
    expect(total).toBeGreaterThan(5000);
    // A blade right on a cull's edge can fall the other way in f32: allow a handful.
    for (let lod = 0; lod < 4; lod++) {
      expect(Math.abs(gpu.counts[lod]! - cpuCounts[lod]!)).toBeLessThanOrEqual(
        Math.max(3, cpuCounts[lod]! * 0.001),
      );
    }
    // And the same blades, bent the same way.
    const find = byRoot(cpu.filter((b) => b.lod < 3));
    let matched = 0;
    let worst = 0;
    const leaves = gpu.blades.filter((b) => b.lod < 3);
    for (const b of leaves) {
      const twin = find(b.v0);
      if (!twin) continue;
      matched++;
      expect(b.lod).toBe(twin.lod);
      worst = Math.max(worst, Math.hypot(...b.v2.map((x, i) => x - twin.v2[i]!)));
    }
    expect(matched / leaves.length).toBeGreaterThan(0.999);
    expect(worst).toBeLessThan(1e-3);
  });

  it('matches its twin with a lawn half grown and mown in stripes', async () => {
    const device = await getTestDevice();
    const trample = createTrample(device, { size: 128, cell: 0.06, tau: 2 });
    for (let k = 0; k < 60; k++) {
      const row = Math.floor(k / 20);
      const along = row % 2 === 0 ? 1 : -1;
      const encoder = device.createCommandEncoder();
      trample.step(encoder, 1 / 60, 0, 4, [
        {
          x: along * (-1.5 + 0.15 * (k % 20)),
          z: 3 + 0.4 * row,
          radius: 0.25,
          strength: 1,
          along: [along, 0],
          mow: true,
        },
      ]);
      device.queue.submit([encoder.finish()]);
    }
    const read = device.createBuffer({
      size: trample.buffer.size,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(trample.buffer, 0, read, 0, trample.buffer.size);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const cells = new Float32Array(read.getMappedRange().slice(0));
    const copy = { cells, origin: [...trample.origin] as [number, number], cell: 0.06, size: 128 };
    const s = settings({
      trample,
      growth: { progress: 1.2, cell: 1.5, speed: 1.5, spread: 1 },
    });
    const gpu = await runGpu(camera(), s, 2.2);
    const cpu = placeBlades(camera(), s, 2.2, SIZE, copy);
    const full = placeBlades(camera(), settings(), 2.2, SIZE);
    // Part grown: fewer blades than a grown field, but some.
    expect(cpu.length).toBeGreaterThan(500);
    expect(cpu.length).toBeLessThan(full.length * 0.9);
    for (let lod = 0; lod < 4; lod++) {
      const n = cpu.filter((b) => b.lod === lod).length;
      expect(Math.abs(gpu.counts[lod]! - n)).toBeLessThanOrEqual(Math.max(3, n * 0.002));
    }
    const find = byRoot(cpu.filter((b) => b.lod < 3));
    let worst = 0;
    for (const b of gpu.blades.filter((g) => g.lod < 3)) {
      const twin = find(b.v0);
      if (twin) worst = Math.max(worst, Math.hypot(...b.v2.map((x, i) => x - twin.v2[i]!)));
    }
    expect(worst).toBeLessThan(2e-3);
    read.destroy();
    trample.destroy();
  });

  it('grows the same blade from the same ground when the view moves', async () => {
    // The edge-on cull depends on the direction the blade is seen from, so it is off here.
    const s = settings({ minPixels: 0 });
    const a = await runGpu(camera(0), s, 1.5);
    const b = await runGpu(camera(0.37), s, 1.5);
    // Blades rooted near the middle of both views, in the same distance band in both.
    const inner = (g: GpuBlade) => g.lod < 3 && Math.abs(g.v0[0] - 0.18) < 0.5 && g.v0[2] < 3.5;
    const first = a.blades.filter(inner);
    const find = byRoot(first);
    const second = b.blades.filter(inner);
    expect(second.length).toBeGreaterThan(200);
    expect(second.length).toBe(first.length);
    for (const g of second) {
      const twin = find(g.v0);
      expect(twin).toBeDefined();
      expect(g.v2).toEqual(twin!.v2);
    }
  });

  it('has no repeating tile: the roots are uncorrelated at every offset', () => {
    // Roots over a 3 m square, binned at 3 cm. Any tile repeated across it would show as a peak
    // in the autocorrelation away from zero offset.
    const s = settings({ density: 1, fade: 7.5 });
    const cam = groundCamera({
      aspect: 3,
      eyeHeight: 0.3,
      horizon: 0.2,
      bottomDistance: 1,
      far: 8,
    });
    const blades = placeBlades(cam, s, 0, SIZE).filter(
      (b) => Math.abs(b.v0[0]) < 1.5 && b.v0[2] > 2 && b.v0[2] < 5,
    );
    const n = 100;
    const grid = new Float64Array(n * n);
    for (const b of blades) {
      const i = Math.floor(((b.v0[0] + 1.5) / 3) * n);
      const j = Math.floor(((b.v0[2] - 2) / 3) * n);
      grid[j * n + i]! += 1;
    }
    const mean = grid.reduce((x, y) => x + y, 0) / grid.length;
    for (let k = 0; k < grid.length; k++) grid[k]! -= mean;
    const at = (dx: number, dy: number) => {
      let sum = 0;
      let count = 0;
      for (let j = 0; j + dy < n; j++) {
        for (let i = 0; i + dx < n; i++) {
          sum += grid[j * n + i]! * grid[(j + dy) * n + i + dx]!;
          count++;
        }
      }
      return sum / count;
    };
    const zero = at(0, 0);
    let peak = 0;
    for (let dy = 0; dy < 40; dy++) {
      for (let dx = dy === 0 ? 3 : 0; dx < 40; dx++) peak = Math.max(peak, at(dx, dy) / zero);
    }
    expect(blades.length).toBeGreaterThan(5000);
    expect(peak).toBeLessThan(0.2);
  });
});

describe('ground wind', () => {
  const wind = (time: number): Wind => ({
    dir: [0.94, 0.34],
    lean: 0.1,
    gust: 0.28,
    speed: 2.4,
    scale: 1.6,
    flutter: 0.05,
    time,
  });
  const series = (x: number, z: number, freq: number, phase: number) =>
    Array.from({ length: 2400 }, (_, k) => groundWind(x, z, wind(k / 60), freq, phase)[0]);
  const correlation = (a: number[], b: number[]) => {
    const ma = a.reduce((x, y) => x + y) / a.length;
    const mb = b.reduce((x, y) => x + y) / b.length;
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let i = 0; i < a.length; i++) {
      ab += (a[i]! - ma) * (b[i]! - mb);
      aa += (a[i]! - ma) ** 2;
      bb += (b[i]! - mb) ** 2;
    }
    return ab / Math.sqrt(aa * bb);
  };

  it('moves neighbours together and distant blades apart', () => {
    const here = series(0, 0, 1.6, 0.3);
    const beside = series(0.05, 0.03, 1.9, 4.1);
    const away = series(7, -5, 1.4, 2.2);
    expect(correlation(here, beside)).toBeGreaterThan(0.85);
    expect(Math.abs(correlation(here, away))).toBeLessThan(0.5);
  });

  it('moves a tip no faster than its own sway and the passing gusts allow', () => {
    const freq = 1.6;
    const w = wind(0);
    // Flutter: 2 pi f times its largest amplitude (both of its terms). Gusts: the smoothstep's
    // steepest slope (3 over its 0.55 span), the value noise's (1.5 a cell), the cells passing at
    // speed / scale, through the gust lean; the slow veer is far slower than either.
    const flutterRate = 2 * Math.PI * freq * w.flutter * 1.4 * Math.hypot(1, 0.35 * 0.71);
    const gustRate = w.gust * (1.5 / 0.55) * 1.5 * (w.speed / w.scale);
    const bound = flutterRate + gustRate + 0.01;
    let fastest = 0;
    for (let k = 1; k < 6000; k++) {
      const [ax, az] = groundWind(0.3, 0.8, wind((k - 1) / 240), freq, 1);
      const [bx, bz] = groundWind(0.3, 0.8, wind(k / 240), freq, 1);
      fastest = Math.max(fastest, Math.hypot(bx - ax, bz - az) * 240);
    }
    expect(fastest).toBeLessThan(bound);
    expect(fastest).toBeGreaterThan(0.2 * bound);
  });
});
