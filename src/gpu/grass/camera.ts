// A camera for grass on the ground plane (y = 0, up +y), and the patch of ground it can see.
//
// The camera looks level along +z, and the horizon is placed by shifting the lens (an off-axis
// projection), not by pitching the camera, so blades stay upright on screen however low the
// horizon sits. That is how a strip of grass along the bottom of a page is framed.

export interface GroundCamera {
  /** Column-major clip-from-world matrix, depth 0 at `near` to 1 at `far`. */
  viewProj: Float32Array;
  eye: [number, number, number];
  /** Unit vector to the right on screen, on the ground. */
  right: [number, number];
  /** Clip-space scale of x and y at unit depth: the projection's [0][0] and [1][1]. */
  scale: [number, number];
  /** The ground the view can see, out to `far` (x0, z0, x1, z1), with `margin` all round. */
  ground: [number, number, number, number];
  near: number;
  far: number;
}

export interface GroundCameraOptions {
  /** Drawing-buffer width over height. */
  aspect: number;
  /** Eye height above the ground, m. */
  eyeHeight: number;
  /** Where the horizon sits, in NDC y (-1 the bottom of the view, 1 the top). */
  horizon: number;
  /** Distance to the ground at the bottom edge of the view, m. */
  bottomDistance: number;
  /** Where along x and z the eye stands. */
  x?: number;
  z?: number;
  near?: number;
  far: number;
  /** Extra ground around the view, for blades rooted outside it that lean in, m. */
  margin?: number;
  /**
   * Where the grass starts, m in front of the eye. A camera in the grass sees blades rooted a hand
   * away sweep across the whole view; one standing at the field's edge does not.
   */
  start?: number;
}

export function groundCamera(options: GroundCameraOptions): GroundCamera {
  const { aspect, eyeHeight: e, horizon, bottomDistance, far } = options;
  const x = options.x ?? 0;
  const z = options.z ?? 0;
  const near = options.near ?? 0.02;
  const margin = options.margin ?? 0.5;
  // The bottom edge is (horizon + 1) NDC units below the horizon, and looks e / bottomDistance
  // down: so one NDC unit is s of tan.
  const s = e / bottomDistance / (horizon + 1);
  const sx = 1 / (s * aspect);
  const sy = 1 / s;
  const a = far / (far - near);
  const b = (-near * far) / (far - near);
  // clip = P (world - eye), with view axes = world axes (x right, y up, z forward).
  // P: x' = sx x, y' = sy y + horizon z, z' = a z + b, w = z.
  const m = new Float32Array(16);
  m[0] = sx;
  m[5] = sy;
  m[8] = 0;
  m[9] = horizon;
  m[10] = a;
  m[11] = 1;
  m[12] = -sx * x;
  m[13] = -sy * e - horizon * z;
  m[14] = -a * z + b;
  m[15] = -z;
  const halfWidth = far * s * aspect;
  return {
    viewProj: m,
    eye: [x, e, z],
    right: [1, 0],
    scale: [sx, sy],
    ground: [
      x - halfWidth - margin,
      z + (options.start ?? 0),
      x + halfWidth + margin,
      z + far + margin,
    ],
    near,
    far,
  };
}

/** Clip coordinates of a world point, as the shader computes them. */
export function project(
  m: Float32Array,
  p: readonly [number, number, number],
): [number, number, number, number] {
  return [
    m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!,
    m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!,
    m[2]! * p[0] + m[6]! * p[1] + m[10]! * p[2] + m[14]!,
    m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!,
  ];
}

/**
 * The same camera drawn into just the rows from the bottom of the view up to NDC `top`: clip y is
 * remapped so -1 stays the bottom and `top` becomes the top of a target that many rows tall.
 */
export function cropToBottom(camera: GroundCamera, top: number): GroundCamera {
  const k = 2 / (top + 1);
  const m = new Float32Array(camera.viewProj);
  for (let c = 0; c < 4; c++) m[c * 4 + 1] = k * m[c * 4 + 1]! + (k - 1) * m[c * 4 + 3]!;
  return { ...camera, viewProj: m, scale: [camera.scale[0], camera.scale[1] * k] };
}

export interface PitchedCameraOptions {
  /** Drawing-buffer width over height. */
  aspect: number;
  /** Where the eye is, m (y its height above the ground). */
  eye: readonly [number, number, number];
  /** How far the view looks down from level, radians. */
  pitch: number;
  /** Vertical field of view, radians. */
  fovY: number;
  near?: number;
  far: number;
  /** Extra ground around the view, for blades rooted outside it that lean in, m. */
  margin?: number;
}

/**
 * A camera looking along +z and down by `pitch`, for grass seen from above: a lawn from standing
 * height. Its `ground` is the frustum's footprint on the ground out to `far`, by the rays through
 * the view's corners.
 */
export function pitchedCamera(options: PitchedCameraOptions): GroundCamera {
  const { aspect, eye, pitch, fovY, far } = options;
  const near = options.near ?? 0.05;
  const margin = options.margin ?? 0.5;
  const sy = 1 / Math.tan(fovY / 2);
  const sx = sy / aspect;
  const a = far / (far - near);
  const b = (-near * far) / (far - near);
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  // Forward, up and right in world space.
  const f = [0, -sp, cp] as const;
  const u = [0, cp, sp] as const;
  const dot = (v: readonly number[]) => v[0]! * eye[0] + v[1]! * eye[1] + v[2]! * eye[2];
  const m = new Float32Array(16);
  // Column-major: m[column * 4 + row]. Rows: x' = sx right, y' = sy up, z' = a forward + b, w = forward.
  m[0] = sx;
  m[12] = -sx * eye[0];
  m[5] = sy * u[1];
  m[9] = sy * u[2];
  m[13] = -sy * dot(u);
  m[6] = a * f[1];
  m[10] = a * f[2];
  m[14] = -a * dot(f) + b;
  m[7] = f[1];
  m[11] = f[2];
  m[15] = -dot(f);
  // The footprint: where the corner rays meet the ground, or how far they get by `far`.
  const xs: number[] = [eye[0]];
  const zs: number[] = [eye[2]];
  for (const nx of [-1, 1]) {
    for (const ny of [-1, 1]) {
      const d = [nx / sx, f[1] + (u[1] * ny) / sy, f[2] + (u[2] * ny) / sy];
      const t = d[1]! < -1e-6 ? Math.min(eye[1] / -d[1]!, far) : far;
      xs.push(eye[0] + d[0]! * t);
      zs.push(eye[2] + d[2]! * t);
    }
  }
  return {
    viewProj: m,
    eye: [eye[0], eye[1], eye[2]],
    right: [1, 0],
    scale: [sx, sy],
    ground: [
      Math.min(...xs) - margin,
      Math.min(...zs) - margin,
      Math.max(...xs) + margin,
      Math.max(...zs) + margin,
    ],
    near,
    far,
  };
}

/** The world-space ray through a point of the view (NDC), for a pitched camera. */
export function pitchedRay(
  pitch: number,
  scale: readonly [number, number],
  ndc: readonly [number, number],
): [number, number, number] {
  const sp = Math.sin(pitch);
  const cp = Math.cos(pitch);
  return [ndc[0] / scale[0], -sp + (cp * ndc[1]) / scale[1], cp + (sp * ndc[1]) / scale[1]];
}
