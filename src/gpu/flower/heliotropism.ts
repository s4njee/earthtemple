/*
 * Story 12.4: a young sunflower's head follows the sun because its stem grows faster on one side
 * than the other: on its east side by day, turning the head west after the sun, and on its west
 * side by night, turning it back to face the dawn (Atamian et al., Science 2016). Growth is slow,
 * so the head lags: it eases towards where the light is, over its own time constant, and no faster
 * than the stem can grow, a most it can turn in a second.
 */

type Vec3 = [number, number, number];

const norm = (v: readonly number[]): Vec3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0]! / l, v[1]! / l, v[2]! / l];
};
const cross = (a: readonly number[], b: readonly number[]): Vec3 => [
  a[1]! * b[2]! - a[2]! * b[1]!,
  a[2]! * b[0]! - a[0]! * b[2]!,
  a[0]! * b[1]! - a[1]! * b[0]!,
];
const angle = (a: readonly number[], b: readonly number[]) =>
  Math.acos(Math.min(1, Math.max(-1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!)));

/**
 * Where a head faces after `dt` s, from facing `facing` towards `aim` (both unit vectors), with a lag
 * of `lag` s and turning at most `rate` rad/s. It turns about the axis between the two, and over
 * the top when they are opposite, as a head turning back from the west to the east goes.
 */
export function turnHead(
  facing: readonly number[],
  aim: readonly number[],
  dt: number,
  lag: number,
  rate: number,
): Vec3 {
  const from = norm(facing);
  if (dt <= 0) return from;
  const to = angle(from, aim);
  if (to < 1e-9) return norm(aim);
  const step = Math.min(to * (1 - Math.exp(-dt / Math.max(lag, 1e-6))), rate * dt);
  let axis = cross(from, aim);
  if (Math.hypot(...axis) < 1e-6) axis = cross(from, [0, 1, 0]);
  if (Math.hypot(...axis) < 1e-6) axis = [1, 0, 0];
  const k = norm(axis);
  // Rodrigues: the facing turned about k by the step.
  const c = Math.cos(step);
  const s = Math.sin(step);
  const kv = cross(k, from);
  const kd = k[0] * from[0] + k[1] * from[1] + k[2] * from[2];
  return norm(from.map((v, i) => v * c + kv[i]! * s + k[i]! * kd * (1 - c)));
}

/** The nod that turns an upright head to face `d`: a horizontal axis (x, z) and the angle, rad. */
export function nodToward(d: readonly number[]): [number, number, number] {
  const axis = norm([d[2]!, 0, -d[0]!]);
  return [axis[0], axis[2], Math.acos(Math.min(Math.max(d[1]!, -1), 1))];
}
