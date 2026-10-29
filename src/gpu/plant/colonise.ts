/*
 * Story 5.1, first used by story 12.7: a branching structure grown by space colonisation (Runions,
 * Lane and Prusinkiewicz, "Modeling trees with a space colonization algorithm", 2007). Attractors
 * fill the space the plant will fill (a crown, or here a branch's spray). Each grows the node
 * nearest it, if within its radius of influence; a node moves one step towards the mean direction
 * of its attractors, and an attractor is used up once a node comes within its kill distance. The
 * branches compete for space, so they spread out without crossing, and fork where the attractors
 * pull two ways.
 *
 * Thickness follows the pipe model (Shinozaki; Murray): a parent's radius to the power `pipe` is
 * the sum of its children's, so the branch tapers from the root to twigs of `tip` radius. Each
 * node's depth, its path length from the root, is when it grows as the branch extends.
 *
 * Attractors pulling a node two ways at once can make it grow child after child in the same place,
 * a broom: a node grows no child within half a step of one it has, and nothing where the pulls
 * cancel.
 */

export type Vec3 = [number, number, number];

export interface BranchNode {
  position: Vec3;
  /** Index of its parent, -1 for the root. */
  parent: number;
  children: number[];
  /** Path length from the root, m. */
  depth: number;
  radius: number;
}

export interface ColoniseOptions {
  attractors: readonly Vec3[];
  root: Vec3;
  /** The way the first shoot grows until it meets the attractors. */
  direction: Vec3;
  /** Node spacing, m. */
  step: number;
  /** How far an attractor reaches, and how near a node must come to use it up, m. */
  influence: number;
  kill: number;
  /** A steady pull added to every growth direction (gravity, light), as a fraction of a step. */
  tropism?: Vec3;
  maxNodes?: number;
  /** A twig's radius, and the pipe model's exponent. */
  tip?: number;
  pipe?: number;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function colonise(options: Readonly<ColoniseOptions>): BranchNode[] {
  const { step, influence, kill } = options;
  const maxNodes = options.maxNodes ?? 4000;
  const tropism = options.tropism ?? [0, 0, 0];
  const nodes: BranchNode[] = [
    { position: [...options.root], parent: -1, children: [], depth: 0, radius: 0 },
  ];
  let live = options.attractors.map((a) => [...a] as Vec3);
  const grow = (from: number, direction: Vec3) => {
    const parent = nodes[from]!;
    const d = norm(direction);
    nodes.push({
      position: [
        parent.position[0] + d[0] * step,
        parent.position[1] + d[1] * step,
        parent.position[2] + d[2] * step,
      ],
      parent: from,
      children: [],
      depth: parent.depth + step,
      radius: 0,
    });
    parent.children.push(nodes.length - 1);
  };
  // The first shoot grows straight until an attractor can reach it.
  const reached = () => live.some((a) => length(sub(a, nodes.at(-1)!.position)) < influence);
  while (!reached() && nodes.length < maxNodes && live.length > 0) {
    if (nodes.length > 1 && nodes.length * step > 10 * influence + 100 * step) break;
    grow(nodes.length - 1, options.direction);
  }
  while (live.length > 0 && nodes.length < maxNodes) {
    // Each attractor pulls its nearest node, within its influence.
    const pull = new Map<number, Vec3>();
    for (const a of live) {
      let best = -1;
      let near = influence;
      for (let i = 0; i < nodes.length; i++) {
        const d = length(sub(a, nodes[i]!.position));
        if (d < near) {
          near = d;
          best = i;
        }
      }
      if (best < 0) continue;
      const dir = norm(sub(a, nodes[best]!.position));
      const sum = pull.get(best) ?? [0, 0, 0];
      pull.set(best, [sum[0] + dir[0], sum[1] + dir[1], sum[2] + dir[2]]);
    }
    if (pull.size === 0) break;
    const before = nodes.length;
    for (const [i, sum] of pull) {
      if (length(sum) < 1e-3) continue;
      const d = norm(sum);
      const way = norm([d[0] + tropism[0], d[1] + tropism[1], d[2] + tropism[2]]);
      const from = nodes[i]!;
      const at: Vec3 = [
        from.position[0] + way[0] * step,
        from.position[1] + way[1] * step,
        from.position[2] + way[2] * step,
      ];
      const twin = from.children.some((c) => length(sub(nodes[c]!.position, at)) < 0.5 * step);
      if (twin) continue;
      grow(i, way);
      if (nodes.length >= maxNodes) break;
    }
    if (nodes.length === before) break;
    // Used up: every attractor a new node has come within kill distance of.
    live = live.filter((a) => {
      for (let i = before; i < nodes.length; i++) {
        if (length(sub(a, nodes[i]!.position)) < kill) return false;
      }
      return true;
    });
  }
  // The pipe model, from the twigs down.
  const tip = options.tip ?? 0.002;
  const pipe = options.pipe ?? 2.5;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!;
    n.radius =
      n.children.length === 0
        ? tip
        : n.children.reduce((s, c) => s + nodes[c]!.radius ** pipe, 0) ** (1 / pipe);
  }
  return nodes;
}
