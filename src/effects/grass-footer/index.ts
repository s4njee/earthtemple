import { SPECIES, SPECIES_NAMES, type SpeciesName } from '../../gpu/grass/blade.ts';
import { cropToBottom, groundCamera } from '../../gpu/grass/camera.ts';
import {
  ALL_PARTS,
  createGrassField,
  FLAGS,
  without,
  type Lighting,
  type Part,
} from '../../gpu/grass/field.ts';
import { createGrassStrip } from '../../gpu/grass/strip.ts';
import { trackPointer } from '../../gpu/pointer.ts';
import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';

// Story 3.1: a strip of grass along the bottom of a page, on the blade engine (stories 2.1 to
// 2.4). The camera stands just above the ground looking level, with the horizon low in the view;
// above the tallest blades the canvas is clear, so the page shows through. Only the rows the grass
// can reach are multisampled and drawn (strip.ts).

const LIGHTS = {
  afternoon: {
    sunDir: [0.33, 0.72, -0.61],
    sun: [2.1, 1.95, 1.7],
    sky: [0.2, 0.27, 0.36],
    transmit: 0.35,
    sheen: 0.5,
  },
  'golden hour': {
    sunDir: [-0.28, 0.2, 0.94],
    sun: [2.4, 1.5, 0.7],
    sky: [0.1, 0.1, 0.14],
    // Backlit thin blades against a dark page are the strip's highest contrast, and they shimmer
    // as they flutter (story 2.7): the glow is held lower than the meadow's, which has depth of
    // field to soften its near blades.
    transmit: 0.6,
    sheen: 0.4,
  },
  overcast: {
    sunDir: [0.1, 0.98, -0.15],
    sun: [0.45, 0.46, 0.48],
    sky: [0.5, 0.53, 0.56],
    transmit: 0.3,
    sheen: 0.25,
  },
} as const satisfies Record<string, Lighting>;
type LightName = keyof typeof LIGHTS;

/** Blades per LOD list: the most a strip at the densest setting needs, with room to spare. */
const CAPACITY = 160_000;
const SAMPLES = 4;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    species: { type: 'select', default: 'meadow', options: SPECIES_NAMES },
    density: { type: 'number', default: 0.8, min: 0.1, max: 1, step: 0.01 },
    height: { type: 'number', default: 1, min: 0.5, max: 2, step: 0.05, label: 'blade height' },
    band: { type: 'number', default: 0.4, min: 0.15, max: 0.9, step: 0.01, label: 'strip height' },
    light: { type: 'select', default: 'afternoon', options: Object.keys(LIGHTS) },
    part: { type: 'number', default: 0.6, min: 0, max: 1, step: 0.01, label: 'pointer parts it' },
    seed: { type: 'number', default: 1, min: 1, max: 999, step: 1 },
    ablate: {
      type: 'select',
      default: 'none',
      options: ['none', ...Object.keys(FLAGS)],
      label: 'without',
    },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
    ...OVERLAY_PARAMS,
    alpha: { ...OVERLAY_PARAMS.alpha, default: 'coverage' },
  },
  presets: {
    meadow: {},
    lawn: { species: 'lawn', band: 0.3 },
    'golden hour': { light: 'golden hour', species: 'tussock' },
    'dry grass': { species: 'dry', light: 'afternoon' },
    overcast: { light: 'overcast' },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'grass-footer' });
    const field = createGrassField(device, {
      capacity: CAPACITY,
      format: tail.scene.format,
      sampleCount: SAMPLES,
      label: 'grass-footer',
    });
    const strip = createGrassStrip(device, {
      format: tail.scene.format,
      samples: SAMPLES,
      label: 'grass-footer strip',
    });
    const pointer = trackPointer(canvas);
    let width = 1;
    let height = 1;
    let clock = 0;
    let push = 0;
    const at = { x: 0, y: -2 };

    return {
      resize(w, h) {
        width = w;
        height = h;
        tail.resize(w, h);
      },
      frame(time, encoder, target) {
        clock += time.delta;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        const species = SPECIES[params.species as SpeciesName] ?? SPECIES.meadow;
        // The camera is set by the species, not by `height`: taller blades rise higher in the
        // same view, rather than the view moving back over four times the ground.
        const tall = (species.height[0] + species.height[1]) / 2;
        // Eye a little below the tallest tips, so the strip's top edge is blades against the page,
        // and well back from the nearest ground in view, so the blades are many and fine: a long
        // lens on a meadow's edge, not a macro shot of a few.
        const eyeHeight = 0.8 * tall;
        const start = 10 * eyeHeight;
        const view = groundCamera({
          aspect: width / height,
          eyeHeight,
          horizon: -1 + 2 * params.band * 0.7,
          bottomDistance: 12 * eyeHeight,
          // The field starts just before the bottom of the view.
          start,
          far: 60 * eyeHeight,
        });
        // The highest a tip can reach on screen: the tallest blade of the tallest clump, at the
        // front of the field. Rows above it are never drawn.
        const tallest = species.height[1] * params.height * 1.3;
        const horizon = -1 + 2 * params.band * 0.7;
        // The tallest blade at the front of the field, or the horizon, which grass lower than the
        // eye rises towards with distance.
        const reach = Math.max(horizon, view.scale[1] * ((tallest - eyeHeight) / start) + horizon);
        const rows = Math.min(height, Math.ceil(((Math.min(reach, 1) + 1.04) / 2) * height));
        const top = (2 * rows) / height - 1;
        const camera = cropToBottom(view, top);
        strip.resize(width, rows);
        const k = 2 / (top + 1);

        // The pointer eases in and out, so the grass springs back rather than snapping.
        const p = pointer.state;
        push += ((p.inside ? params.part : 0) - push) * Math.min(1, time.delta * 6);
        if (p.inside) {
          at.x = 2 * p.x - 1;
          at.y = k * (2 - 2 * p.y) - 1;
        }

        field.update(
          camera,
          {
            species,
            density: params.density,
            heightScale: params.height,
            clump: 0.12 * params.height,
            lod0: 18 * eyeHeight,
            lod1: 32 * eyeHeight,
            fade: 30 * eyeHeight,
            wind: {
              // Partly into the view: wind straight across a strip is all sideways drift on screen.
              dir: [0.8, 0.6],
              lean: dosed(dose, 0, 0.1, 0.12),
              // A held frame is a lull: no gust bending the field. Blades lean from their roots,
              // so a strong gust moves their tops and not their bases, which optical flow reads as
              // a zoom: the strong end is held to the motion caps.
              gust: time.still ? 0 : dosed(dose, 0, 0.28, 0.3),
              // Gusts sweeping tall blades' tips across a dark page are the strip's shimmer at the
              // strong end (story 2.7), so the gusts stay near the default's strength and pace.
              speed: dosed(dose, 1, 2.4, 2.6),
              scale: 2.4,
              // Bright blades fluttering against a dark page shimmer at the strong end (story 2.7).
              flutter: dosed(dose, 0, 0.05, 0.055),
            },
            // Reach across the view in the strip's NDC units, as wide on screen at any strip height.
            pointer: [at.x, at.y, (0.12 * height) / rows, push * 0.9],
            seed: params.seed,
            minPixels: 0.04,
            // A strip along a page is grass; wildflowers are the meadow's.
            flowers: 0,
            flags: params.ablate in FLAGS ? without(params.ablate as Part) : ALL_PARTS,
          },
          clock,
          { width, height: rows },
        );
        field.light(LIGHTS[params.light as LightName] ?? LIGHTS.afternoon);
        field.compute(encoder, profiler.pass('place'));

        const pass = encoder.beginRenderPass({
          label: 'grass-footer blades',
          colorAttachments: [
            {
              view: strip.colour,
              resolveTarget: strip.resolveTarget,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: 'discard',
            },
            // The field's pipelines have a slot for a distance target; the footer has none.
            null,
          ],
          depthStencilAttachment: {
            view: strip.depth,
            depthLoadOp: 'clear',
            depthClearValue: 1,
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('blades'),
        });
        field.draw(pass);
        pass.end();
        strip.composite(encoder, tail.scene.view, height);
        tail.encode(encoder, target, time, params, profiler);
      },
      stats() {
        const [near, mid, far] = field.counts();
        return { near, mid, far, cells: field.cells };
      },
      destroy() {
        pointer.destroy();
        field.destroy();
        strip.destroy();
        tail.destroy();
      },
    };
  },
});
