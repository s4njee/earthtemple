import type { FloralDiagram, Organ } from '../src/gpu/flower/diagram.ts';
import { budStretch, openState, organPoint } from '../src/gpu/flower/opening.ts';

// Story 12.2's check that petals do not pass through each other: how much of each petal lies on the
// wrong side of a petal outside it (one that opens before it), near and over its blade.

type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export interface Crossing {
  /** The share of the inner petals' points on the outer side of a petal outside them. */
  share: number;
  /** How far the worst of them is through, m. */
  deepest: number;
}

/**
 * Samples each sepal and petal on an `nu` x `nv` grid at the flower's `progress`. A point counts
 * when it is within `near` of a petal opening before it, over that petal's surface (not past its
 * edge, nor its tip, whose triangles are slivers), and on its outer face's side by more than `slack`.
 */
export function crossings(
  diagram: Readonly<FloralDiagram>,
  organs: readonly Organ[],
  progress: number,
  options: { nu?: number; nv?: number; near?: number; slack?: number; budCurl?: number } = {},
): Crossing {
  const nu = options.nu ?? 12;
  const nv = options.nv ?? 9;
  const near = options.near ?? 0.002;
  const slack = options.slack ?? 0.00005;
  const parts = organs.filter((o) => o.organ === 'petal' || o.organ === 'sepal');
  const stretch = budStretch(diagram.bud, progress);
  const grids = parts.map((o) => {
    const state = openState(o, progress, { budCurl: options.budCurl ?? 1.6, stagger: 0.45 });
    const grid: V[][] = [];
    for (let j = 0; j < nu; j++) {
      const row: V[] = [];
      for (let i = 0; i < nv; i++) {
        row.push(organPoint(o, state, j / (nu - 1), (i / (nv - 1)) * 2 - 1, stretch) as V);
      }
      grid.push(row);
    }
    return grid;
  });
  // Triangles, their inner faces' normals, and short of the tip's row.
  const triangles = grids.map((g) => {
    const list: { a: V; e1: V; e2: V; n: V }[] = [];
    for (let j = 0; j < nu - 2; j++) {
      for (let i = 0; i < nv - 1; i++) {
        const quads: [V, V, V][] = [
          [g[j]![i]!, g[j + 1]![i]!, g[j]![i + 1]!],
          [g[j + 1]![i]!, g[j + 1]![i + 1]!, g[j]![i + 1]!],
        ];
        for (const [p, q, r] of quads) {
          const e1 = sub(q, p);
          const e2 = sub(r, p);
          const n = cross(e1, e2);
          const length = Math.hypot(...n);
          if (length < 1e-14) continue;
          list.push({ a: p, e1, e2, n: [n[0] / length, n[1] / length, n[2] / length] });
        }
      }
    }
    return list;
  });
  let wrong = 0;
  let total = 0;
  let deepest = 0;
  for (let k = 0; k < parts.length; k++) {
    for (let j = 1; j < nu; j++) {
      for (let i = 0; i < nv; i++) {
        const p = grids[k]![j]![i]!;
        total++;
        let through = 0;
        for (let m = 0; m < parts.length; m++) {
          if (parts[m]!.order >= parts[k]!.order) continue;
          let best = Infinity;
          for (const t of triangles[m]!) {
            const d = sub(p, t.a);
            const h = dot(d, t.n);
            const q: V = [d[0] - t.n[0] * h, d[1] - t.n[1] * h, d[2] - t.n[2] * h];
            const d00 = dot(t.e1, t.e1);
            const d01 = dot(t.e1, t.e2);
            const d11 = dot(t.e2, t.e2);
            const d20 = dot(q, t.e1);
            const d21 = dot(q, t.e2);
            const den = d00 * d11 - d01 * d01;
            const v = (d11 * d20 - d01 * d21) / den;
            const w = (d00 * d21 - d01 * d20) / den;
            if (v < 0 || w < 0 || v + w > 1) continue;
            if (Math.abs(h) < Math.abs(best)) best = h;
          }
          if (Math.abs(best) < near && best < -slack) through = Math.max(through, -best);
        }
        if (through > 0) {
          wrong++;
          deepest = Math.max(deepest, through);
        }
      }
    }
  }
  return { share: wrong / Math.max(total, 1), deepest };
}
