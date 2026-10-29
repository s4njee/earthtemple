import { describe, expect, it } from 'vitest';
import { nodToward, turnHead } from '../src/gpu/flower/heliotropism.ts';

// Story 12.4: a sunflower's head turns after the light by growing, with a lag and a top speed.

const angle = (a: readonly number[], b: readonly number[]) =>
  Math.acos(Math.min(1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!));
const EAST = [-1, 0, 0];
const WEST = [1, 0, 0];
const SOUTH = [0, 0, -1];

describe('heliotropism', () => {
  it('eases towards the light over its lag', () => {
    // With no limit on its speed, after one lag it has 1/e of the angle left to turn.
    let facing = SOUTH;
    const aim = [Math.SQRT1_2, 0, -Math.SQRT1_2];
    for (let k = 0; k < 100; k++) facing = turnHead(facing, aim, 0.01, 1, 100);
    expect(angle(facing, aim) / angle(SOUTH, aim)).toBeCloseTo(Math.exp(-1), 2);
    for (let k = 0; k < 2000; k++) facing = turnHead(facing, aim, 0.01, 1, 100);
    expect(angle(facing, aim)).toBeLessThan(1e-3);
  });

  it('turns no faster than the stem can grow', () => {
    let facing = EAST;
    for (let k = 0; k < 60; k++) {
      const next = turnHead(facing, WEST, 1 / 60, 0.1, 0.9);
      expect(angle(facing, next)).toBeLessThanOrEqual(0.9 / 60 + 1e-9);
      facing = next;
    }
    // A second at its top speed: 0.9 rad of the half-turn from east to west.
    expect(angle(facing, EAST)).toBeCloseTo(0.9, 2);
  });

  it('holds still in a held frame, and turns back east over the top when the light goes', () => {
    expect(turnHead(WEST, EAST, 0, 1, 1)).toEqual(WEST);
    let facing = WEST;
    let highest = 0;
    for (let k = 0; k < 3000; k++) {
      facing = turnHead(facing, EAST, 0.01, 1.2, 0.9);
      highest = Math.max(highest, facing[1]!);
    }
    expect(angle(facing, EAST)).toBeLessThan(1e-3);
    expect(highest).toBeCloseTo(1, 2);
  });

  it('nods an upright head round a level axis to face the light', () => {
    const [ax, az, a] = nodToward(SOUTH);
    expect(a).toBeCloseTo(Math.PI / 2, 9);
    // Rotating up (0, 1, 0) about (ax, 0, az) by a gives the facing: up x axis * sin a.
    const axis = [ax, 0, az];
    const turned = [
      axis[1]! * 0 - axis[2]! * 1,
      axis[2]! * 0 - axis[0]! * 0,
      axis[0]! * 1 - axis[1]! * 0,
    ].map((c) => c * Math.sin(a));
    expect(turned[0]).toBeCloseTo(0, 9);
    expect(turned[2]).toBeCloseTo(-1, 9);
  });
});
