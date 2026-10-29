import { pcg3d, toUnorm } from '../hash.ts';
import { sampleTrample } from '../wind/trample.ts';
import { groundWind, valueNoise } from '../wind/wind.ts';
import { bladeShape, cellSize, type Vec3 } from './blade.ts';
import { project, type GroundCamera } from './camera.ts';
import { ALL_PARTS, FLAGS, type GrassSettings } from './field.ts';
import { FLOWER_MIX } from './wildflowers.ts';

// Twin of field.wgsl's `place`, for tests: the same blades from the same cells, in double
// precision. A blade on the edge of a cull can fall the other way on the GPU's f32 arithmetic.

export interface PlacedBlade {
  cell: [number, number];
  /** 0 to 2 the blade lists; 3 a flower head (its v0 the head, its width its size). */
  lod: number;
  v0: Vec3;
  v1: Vec3;
  v2: Vec3;
  width: number;
  facing: number;
  tone: number;
}

/** The trample field as the CPU sees it: a copy of its buffer (four numbers a cell), and its window. */
export interface TrampleCopy {
  cells: ArrayLike<number>;
  origin: readonly [number, number];
  cell: number;
  size: number;
}

const smoothstep = (lo: number, hi: number, x: number) => {
  const t = Math.min(Math.max((x - lo) / (hi - lo), 0), 1);
  return t * t * (3 - 2 * t);
};
const unorm3 = (h: [number, number, number]) => h.map(toUnorm) as [number, number, number];
const CUT = 0.55;
const LAY = 1.2;

function arrival(px: number, pz: number, g: NonNullable<GrassSettings['growth']>, seed: number) {
  const bx = Math.floor(px / g.cell);
  const bz = Math.floor(pz / g.cell);
  let best = 1e9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const h = unorm3(pcg3d(bx + i, bz + j, (seed ^ 0x6b43a9) >>> 0));
      const sx = (bx + i + h[0]) * g.cell;
      const sz = (bz + j + h[1]) * g.cell;
      best = Math.min(best, h[2] * g.spread + Math.hypot(px - sx, pz - sz) / g.speed);
    }
  }
  return best + 0.6 * valueNoise(px * 2.5, pz * 2.5, (seed + 17) >>> 0);
}

function clumpOf(px: number, pz: number, size: number, seed: number) {
  const bx = Math.floor(px / size);
  const bz = Math.floor(pz / size);
  let best = Infinity;
  let centre: [number, number] = [0, 0];
  let hash: [number, number, number] = [0, 0, 0];
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const h = pcg3d(bx + i, bz + j, (seed ^ 0x9e3779b9) >>> 0);
      const cx = (bx + i + toUnorm(h[0])) * size;
      const cz = (bz + j + toUnorm(h[1])) * size;
      const d = Math.hypot(cx - px, cz - pz);
      if (d < best) {
        best = d;
        centre = [cx, cz];
        hash = h;
      }
    }
  }
  return { centre, hash };
}

/** Twin of `wildflower_at` (wildflowers.wgsl): the species whose drift map is highest, and how thick. */
export function wildflowerAt(
  x: number,
  z: number,
  seed: number,
): { species: number; density: number } {
  let best = 0;
  let top = 0;
  for (let k = 0; k < 4; k++) {
    const n =
      valueNoise(x / 4.5 + k * 17.3, z / 4.5 + k * 5.1, (seed + 21 + k) >>> 0) * FLOWER_MIX[k]!;
    if (n > top) {
      top = n;
      best = k;
    }
  }
  return { species: best, density: smoothstep(0.4, 0.75, top) };
}

/** Every blade (and flower head) the camera would draw, with the cell it grew from. */
export function placeBlades(
  camera: GroundCamera,
  s: GrassSettings,
  time: number,
  size: { width: number; height: number },
  trample?: TrampleCopy,
): PlacedBlade[] {
  const cell = cellSize(s.species);
  const reach = s.reach ?? camera.far;
  const [x0, z0, x1, z1] = camera.ground;
  const across = reach / camera.scale[0] + 1;
  const gx0 = Math.max(x0, camera.eye[0] - across);
  const gx1 = Math.min(x1, camera.eye[0] + across);
  const gz1 = Math.min(z1, camera.eye[2] + reach);
  const ox = Math.floor(gx0 / cell);
  const oz = Math.floor(z0 / cell);
  const nx = Math.max(0, Math.ceil(gx1 / cell) - ox);
  const nz = Math.max(0, Math.ceil(gz1 / cell) - oz);
  const [hMin, hMax] = s.species.height.map((h) => h * s.heightScale) as [number, number];
  const len = Math.hypot(s.wind.dir[0], s.wind.dir[1]) || 1;
  const flags = s.flags ?? ALL_PARTS;
  const has = (bit: number) => (flags & bit) !== 0;
  const wind = {
    ...s.wind,
    gust: has(FLAGS.gusts) ? s.wind.gust : 0,
    dir: [s.wind.dir[0] / len, s.wind.dir[1] / len] as const,
    time,
  };
  const focal = (camera.scale[0] * size.width) / 2;
  const aspect = size.width / size.height;
  const eye = camera.eye;
  const out: PlacedBlade[] = [];
  const seed = s.seed >>> 0;
  const sp = { ...s.species, flowers: s.species.flowers * (s.flowers ?? 1) };

  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = ox + i;
      const cz = oz + j;
      const h1 = pcg3d(cx, cz, seed);
      const r1 = unorm3(h1);
      const rx = (cx + r1[0]) * cell;
      const rz = (cz + r1[1]) * cell;
      const patchy = valueNoise(rx / 1.7, rz / 1.7, (seed + 5) >>> 0);
      if (r1[2] >= s.density * (0.55 + 0.45 * patchy)) continue;

      const h2 = pcg3d(...h1);
      const r2 = unorm3(h2);
      const v0: Vec3 = [rx, 0, rz];
      const d = Math.hypot(rx - eye[0], -eye[1], rz - eye[2]);
      const thin = s.fade / Math.max(d, 1e-3);
      const keep = Math.min(1, thin * thin) * (1 - smoothstep(0.75 * reach, reach, d));
      if (r2[0] >= keep) continue;

      const h3 = pcg3d(...h2);
      const r3 = unorm3(h3);
      const r4 = unorm3(pcg3d(...h3));
      const clump = has(FLAGS.clumps)
        ? clumpOf(rx, rz, s.clump, seed)
        : { centre: [rx, rz] as [number, number], hash: h3 };
      const rc = unorm3(clump.hash);
      const stem = r4[1] < sp.stems;
      const wild = wildflowerAt(rx, rz, seed);
      const flower = stem && r4[2] < sp.flowers * 2 * wild.density;
      const dry = !stem && has(FLAGS.dry) && r4[0] < sp.dry;
      let height = (hMin + (hMax - hMin) * r2[1]) * (0.7 + 0.6 * rc[2]);
      let width = (sp.width * (0.8 + 0.4 * r3[1])) / Math.sqrt(Math.max(keep, 0.05));
      if (stem) {
        height *= sp.stemHeight;
        width *= 0.45;
      }
      const facing = rc[0] * 6.2831853 + (r2[2] - 0.5) * 1.6;
      const pressed = trample
        ? sampleTrample(trample.cells, trample.origin, trample.cell, trample.size, rx, rz)
        : [0, 0, 0, 0];
      height *= 1 - CUT * Math.hypot(pressed[2]!, pressed[3]!);
      if (s.growth) {
        const grown = smoothstep(
          0,
          0.6,
          s.growth.progress - arrival(rx, rz, s.growth, seed) - 0.25 * r3[0],
        );
        if (grown < 0.03) continue;
        height *= grown;
      }

      const c = project(camera.viewProj, [rx, 0.5 * height, rz]);
      const radius = height * (0.6 + sp.lean + s.wind.lean + s.wind.gust);
      if (c[3] < -radius) continue;
      const w = Math.max(c[3], 1e-3);
      if (
        Math.abs(c[0] / w) > 1 + (radius * camera.scale[0]) / w ||
        Math.abs(c[1] / w) > 1 + (radius * camera.scale[1]) / w
      ) {
        continue;
      }

      const fx = Math.cos(facing);
      const fz = Math.sin(facing);
      const vl = Math.hypot(rx - eye[0], rz - eye[2]);
      const pixels = (width * focal) / w;
      if (pixels * Math.abs((fx * (rx - eye[0]) + fz * (rz - eye[2])) / vl) < s.minPixels) {
        continue;
      }

      const ox2 = rx - clump.centre[0];
      const oz2 = rz - clump.centre[1];
      const ol = Math.hypot(ox2, oz2);
      const [ax, az] = ol > 1e-4 ? [ox2 / ol, oz2 / ol] : [fx, fz];
      const lean = sp.lean * (0.5 + 0.8 * r3[2]) * (stem ? 0.4 : 1);
      const freq = sp.freq * Math.sqrt(0.25 / height) * (0.85 + 0.3 * r3[0]);
      const stiff = Math.min(Math.max((1.6 / freq) ** 2, 0.1), 1.2);
      const [gx, gz] = groundWind(
        rx,
        rz,
        { ...wind, flutter: wind.flutter * stiff },
        freq,
        r3[2] * 6.2831853,
      );
      const top = project(camera.viewProj, [rx, height, rz]);
      const tw = Math.max(top[3], 1e-3);
      const across = (top[0] / tw - s.pointer[0]) * aspect;
      const above = smoothstep(s.pointer[1] - 0.15, s.pointer[1] + 0.05, top[1] / tw);
      const near = 1 - smoothstep(0.7 * s.lod0, 1.3 * s.lod0, d);
      const push =
        s.pointer[3] * above * near * Math.exp(-(across * across) / (s.pointer[2] * s.pointer[2]));
      const part = Math.sign(across) * push;
      const bx = ax * lean + gx + pressed[0]! + LAY * pressed[2]! + camera.right[0] * part;
      const bz = az * lean + gz + pressed[1]! + LAY * pressed[3]! + camera.right[1] * part;
      const curve = bladeShape(v0, [rx + bx * height, height, rz + bz * height], height);

      const variation = has(FLAGS.variation) ? r3[0] : 0.5;
      const kind = flower ? 3 : stem ? 2 : dry ? 1 : 0;
      const banded = d * (1 + (r4[0] - 0.5) * (s.lodBlend ?? 0.3));
      const lod = banded < s.lod0 ? 0 : banded < s.lod1 ? 1 : 2;
      out.push({ cell: [cx, cz], lod, v0, ...curve, width, facing, tone: kind + variation });
      if (flower) {
        const headSize = 0.018 + 0.017 * r2[1];
        out.push({
          cell: [cx, cz],
          lod: 3,
          v0: curve.v2,
          v1: [curve.v2[0] - curve.v1[0], curve.v2[1] - curve.v1[1], curve.v2[2] - curve.v1[2]],
          v2: v0,
          width: headSize,
          facing,
          tone: wild.species + 0.5 * ((r4[2] * 7.31) % 1),
        });
      }
    }
  }
  return out;
}
