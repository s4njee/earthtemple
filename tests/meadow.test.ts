import { describe, expect, it } from 'vitest';
import { cameraMotion, effect } from '../src/effects/meadow/index.ts';
import { MOTION_CAPS } from '../src/gpu/safety/motion.ts';

// Story 3.2: the meadow's own camera against the motion caps. Optical flow cannot follow grass
// (story 2.10: walking through read a zoom of 0.001), so the camera's motion is checked directly,
// as Snow Temple checks snow driven towards the viewer.

describe('meadow camera', () => {
  it('walks at a zoom of v / (z ln 2), and every preset over a cap is declared', () => {
    expect(cameraMotion('midday', true, 0).zoom).toBeCloseTo(0.8 / (9 * Math.LN2), 9);
    const defaults = Object.fromEntries(
      Object.entries(effect.params).map(([k, d]) => [k, d.default]),
    ) as Record<string, unknown>;
    const declared = effect.meta.scorecard?.motionPresets ?? [];
    for (const [name, preset] of Object.entries(effect.presets ?? {})) {
      const p = { ...defaults, ...preset } as { time: string; walk: boolean; drift: number };
      const m = cameraMotion(p.time, p.walk, p.drift);
      const over = m.zoom > MOTION_CAPS.zoom || m.drift > MOTION_CAPS.drift;
      if (over) expect(declared, `"${name}": ${JSON.stringify(m)}`).toContain(name);
      else expect(declared).not.toContain(name);
    }
  });
});
