import { describe, expect, it } from 'vitest';
import { colonise, type Vec3 } from '../src/gpu/plant/colonise.ts';
import { createRandom } from '../src/gpu/random.ts';

// Story 5.1: space colonisation grows a branching structure into the space its attractors fill.

const random = createRandom(3);
const cloud: Vec3[] = [];
while (cloud.length < 400) {
  const p: Vec3 = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1];
  if (Math.hypot(...p) < 1) cloud.push([p[0] * 0.4, 1 + p[1] * 0.4, p[2] * 0.4]);
}
const nodes = colonise({
  attractors: cloud,
  root: [0, 0, 0],
  direction: [0, 1, 0],
  step: 0.03,
  influence: 0.25,
  kill: 0.06,
});

describe('space colonisation', () => {
  it('grows a trunk to the crown and branches through it', () => {
    expect(nodes.length).toBeGreaterThan(100);
    const forks = nodes.filter((n) => n.children.length > 1).length;
    expect(forks).toBeGreaterThan(10);
    // Every node is a step from its parent and its depth is the path to the root.
    for (const n of nodes.slice(1)) {
      const p = nodes[n.parent]!;
      const d = Math.hypot(...n.position.map((c, i) => c - p.position[i]!));
      expect(d).toBeCloseTo(0.03, 9);
      expect(n.depth).toBeCloseTo(p.depth + 0.03, 9);
    }
    // The crown is filled: most attractors have a node near them.
    const near = cloud.filter((a) =>
      nodes.some((n) => Math.hypot(...a.map((c, i) => c - n.position[i]!)) < 0.12),
    );
    expect(near.length / cloud.length).toBeGreaterThan(0.9);
  });

  it('tapers by the pipe model, from twigs to the trunk', () => {
    const root = nodes[0]!;
    expect(root.radius).toBeGreaterThan(5 * 0.002);
    for (const n of nodes) {
      if (n.children.length === 0) {
        expect(n.radius).toBe(0.002);
        continue;
      }
      const sum = n.children.reduce((s, c) => s + nodes[c]!.radius ** 2.5, 0);
      expect(n.radius ** 2.5).toBeCloseTo(sum, 12);
    }
  });
});
