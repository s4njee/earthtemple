// Extra configurations for the cost studies, beyond "every effect at its defaults and at each
// preset", which `tests/study.test.ts` runs anyway. Keyed by epic. Use these for sweeps that
// answer a research question (how cost grows with a parameter).

export interface StudyConfig {
  effect: string;
  /** Shown in the report, e.g. "count=220". */
  name: string;
  preset?: string;
  params?: Readonly<Record<string, unknown>>;
  /** What `ctx.gamut` says (story 3.3). Default sRGB. */
  gamut?: 'srgb' | 'p3';
}

const sweep = (
  effect: string,
  key: string,
  values: readonly (string | number)[],
  fixed: Readonly<Record<string, unknown>> = {},
): StudyConfig[] =>
  values.map((value) => ({
    effect,
    name: [...Object.entries(fixed), [key, value]].map(([k, v]) => `${k}=${String(v)}`).join(' '),
    params: { ...fixed, [key]: value },
  }));

export const STUDY_SWEEPS: Readonly<Record<string, readonly StudyConfig[]>> = {
  '3': [
    // 2.3 and 3.1: what the field costs as the blades get denser, taller and the strip higher.
    ...sweep('grass-footer', 'density', [0.25, 0.5, 1]),
    ...sweep('grass-footer', 'band', [0.2, 0.6, 0.9]),
    ...sweep('grass-footer', 'height', [0.5, 2]),
    // 2.9 and 3.2: what each part of the recipe costs, the far grass by shells, and the meadow at
    // lower densities (the Tier B question).
    ...sweep('meadow', 'ablate', [
      'clumps',
      'translucency',
      'sheen',
      'canopy',
      'gusts',
      'clouds',
      'fog',
      'antialias',
      'depth of field',
      'pollen',
      'flowers',
    ]),
    ...sweep('meadow', 'ablate', ['depth of field', 'antialias'], { time: 'golden hour' }),
    ...sweep('meadow', 'distance', ['shells']),
    ...sweep('meadow', 'density', [0.3, 0.5]),
    // Story 2.8 left shells or canopy beyond the blades to be judged from above.
    ...sweep('lawn', 'far', ['shells']),
    ...sweep('lawn', 'density', [0.4, 1]),
    ...sweep('fur-text', 'length', [0.5, 2]),
    ...sweep('grass-edges', 'density', [2]),
  ],
};
