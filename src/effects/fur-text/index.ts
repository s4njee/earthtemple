import { toHalf } from '../../gpu/colour/palette-texture.ts';
import { createFullscreenPipeline, renderFullscreen } from '../../gpu/fullscreen.ts';
import { SPECIES } from '../../gpu/grass/blade.ts';
import { leafColours } from '../../gpu/optics/leaf.ts';
import { linearSampler } from '../../gpu/passes/common.ts';
import { trackPointer } from '../../gpu/pointer.ts';
import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { withChunks } from '../../gpu/shader.ts';
import { ANTON } from '../../gpu/text/anton.generated.ts';
import { layoutLine } from '../../gpu/text/font.ts';
import { createTextField, type TextLine } from '../../gpu/text/text-field.ts';
import { createUniformBuffer, defineUniformStruct } from '../../gpu/uniforms.ts';
import { defineEffect } from '../types.ts';
import shader from './fur.wgsl';
import { meta } from './meta.ts';

// Story 3.6: a heading grown over with a coat, by shells in one pass (fur.wgsl). The letters are
// the text field's distance in device px; the comb is a coarse grid of leans kept here on the CPU,
// combed by the pointer's strokes (and by a slow stroke of its own when the pointer is idle), and
// relaxing back to the coat's rest with `relax`.

const Params = defineUniformStruct('Params', {
  width: 'f32',
  height: 'f32',
  css: 'f32',
  time: 'f32',
  cell: 'f32',
  radius: 'f32',
  length: 'f32',
  grown: 'f32',
  density: 'f32',
  feather: 'f32',
  rise: 'f32',
  shine: 'f32',
  sway: 'f32',
  seed: 'f32',
  ao: 'f32',
  ambient: 'f32',
  light: 'f32',
  /** 0 a backdrop behind the letters, 1 the page. */
  scene: 'u32',
  root: 'vec3f',
  tip: 'vec3f',
  spec: 'vec3f',
  skin: 'vec3f',
  back_top: 'vec4f',
  back_bottom: 'vec4f',
});

type Vec3 = [number, number, number];

interface Coat {
  /** Strand spacing and radius, CSS px; length as a fraction of the letters' cap height. */
  cell: number;
  thickness: number;
  length: number;
  density: number;
  /** How far the strands lie over at rest (of their length), and how upright they stand. */
  rest: number;
  rise: number;
  shine: number;
  root: Vec3;
  tip: Vec3;
  spec: Vec3;
  skin: Vec3;
}

const meadow = SPECIES.meadow.pigments;
const COATS: Record<string, Coat> = {
  fur: {
    cell: 2.2,
    thickness: 0.36,
    length: 0.09,
    density: 0.95,
    rest: 0.6,
    rise: 0.55,
    shine: 36,
    root: [0.03, 0.016, 0.008],
    tip: [0.26, 0.14, 0.06],
    spec: [0.3, 0.27, 0.23],
    skin: [0.02, 0.012, 0.008],
  },
  grass: {
    cell: 3,
    thickness: 0.34,
    length: 0.13,
    density: 0.8,
    rest: 0.3,
    rise: 1.4,
    shine: 18,
    root: leafColours(meadow.root[0]).reflect,
    tip: leafColours(meadow.tip[0]).reflect,
    spec: [0.25, 0.27, 0.2],
    skin: [0.03, 0.022, 0.012],
  },
  moss: {
    cell: 1.6,
    thickness: 0.44,
    length: 0.035,
    density: 1,
    rest: 0.15,
    rise: 1,
    shine: 10,
    root: [0.01, 0.025, 0.004],
    tip: [0.16, 0.24, 0.035],
    spec: [0.12, 0.14, 0.06],
    skin: [0.012, 0.016, 0.006],
  },
};

/** The comb grid's columns; its rows follow the canvas's aspect. */
const COMB_COLS = 96;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    text: { type: 'text', default: 'FUR', maxLength: 20 },
    coat: { type: 'select', default: 'fur', options: Object.keys(COATS) },
    size: { type: 'number', default: 0.5, min: 0.15, max: 0.8, step: 0.01, label: 'size' },
    length: { type: 'number', default: 1, min: 0.3, max: 2, step: 0.05, label: 'strand length' },
    grow: { type: 'number', default: 3, min: 0, max: 20, step: 0.5, label: 'grows in, s' },
    relax: { type: 'number', default: 4, min: 0.5, max: 30, step: 0.5, label: 'stands back up, s' },
    idle: { type: 'boolean', default: true, label: 'combs itself when idle' },
    behind: { type: 'select', default: 'dark', options: ['dark', 'page'], label: 'behind' },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
    ...OVERLAY_PARAMS,
    alpha: { ...OVERLAY_PARAMS.alpha, default: 'coverage' },
  },
  presets: {
    fur: {},
    grass: { coat: 'grass', text: 'GROW' },
    moss: { coat: 'moss', text: 'MOSS', size: 0.6 },
    'long fur': { length: 1.8, relax: 10 },
    'over the page': { behind: 'page' },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'fur-text' });
    const uniforms = createUniformBuffer(device, Params, 'fur-text params');
    const draw = createFullscreenPipeline(device, {
      fragment: withChunks(shader, { 'params.wgsl': Params.wgsl }),
      entryPoint: 'fur',
      format: tail.scene.format,
    });
    const strandPipeline = createFullscreenPipeline(device, {
      fragment: withChunks(shader, { 'params.wgsl': Params.wgsl }),
      entryPoint: 'strand_map',
      format: 'rgba16float',
    });
    const field = createTextField(device, ANTON);
    const pointer = trackPointer(canvas);
    const sampler = linearSampler(device);
    const capEm = (ANTON.glyphs.H!.bounds[3] - ANTON.glyphs.H!.bounds[1]) / ANTON.unitsPerEm;
    let distance: GPUTexture | undefined;
    let combTexture: GPUTexture | undefined;
    let strands: GPUTexture | undefined;
    let group: GPUBindGroup | undefined;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let clock = 0;
    let grownFor = 0;
    let idleFor = 10;
    let drawn = '';
    let capPx = 1;
    let rows = 1;
    let comb = new Float32Array(0);
    let rest = new Float32Array(0);
    let restKey = '';
    let halves = new Uint16Array(0);
    let combed = 0;

    // The heading in device px, centred: cap height `size` of the view, fitted to nine tenths of it.
    const layout = (): TextLine => {
      const text = params.text.trim().toUpperCase() || 'FUR';
      let size = (params.size * height) / capEm;
      const em = layoutLine(ANTON, text, 0.03).width;
      if (em * size > 0.88 * width) size = (0.88 * width) / Math.max(em, 1e-3);
      capPx = capEm * size;
      return {
        text,
        x: width / 2,
        y: height / 2 + capPx / 2,
        size,
        tracking: 0.03,
        align: 'centre',
      };
    };

    const allocate = () => {
      distance?.destroy();
      combTexture?.destroy();
      strands?.destroy();
      strands = undefined;
      rows = Math.max(8, Math.round((COMB_COLS * height) / Math.max(width, 1)));
      distance = device.createTexture({
        label: 'fur-text distance',
        size: [width, height],
        format: 'r16float',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      });
      combTexture = device.createTexture({
        label: 'fur-text comb',
        size: [COMB_COLS, rows],
        format: 'rgba16float',
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
      });
      comb = new Float32Array(COMB_COLS * rows * 2);
      rest = new Float32Array(COMB_COLS * rows * 2);
      halves = new Uint16Array(COMB_COLS * rows * 4);
      restKey = '';
    };

    // The strand map: a texel per cell of the coat, so its size follows the coat's spacing.
    const mapStrands = (encoder: GPUCommandEncoder, cell: number) => {
      const cols = Math.ceil(width / cell);
      const cellRows = Math.ceil(height / cell);
      if (!strands || strands.width !== cols || strands.height !== cellRows) {
        strands?.destroy();
        strands = device.createTexture({
          label: 'fur-text strands',
          size: [cols, cellRows],
          format: 'rgba16float',
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });
        group = device.createBindGroup({
          layout: draw.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniforms.buffer } },
            { binding: 1, resource: distance!.createView() },
            { binding: 2, resource: combTexture!.createView() },
            { binding: 3, resource: sampler },
            { binding: 4, resource: strands.createView() },
          ],
        });
      }
      const strandGroup = device.createBindGroup({
        layout: strandPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniforms.buffer } },
          { binding: 1, resource: distance!.createView() },
          { binding: 3, resource: sampler },
        ],
      });
      renderFullscreen(encoder, strands.createView(), strandPipeline, [strandGroup]);
    };

    // A coat lies downwards at rest, its flow turning gently across the letters, as a pelt's does.
    const settle = (coat: Coat) => {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < COMB_COLS; i++) {
          const u = i / COMB_COLS;
          const v = j / rows;
          const turn =
            0.55 * Math.sin(u * 7.1 + 1.3 * Math.sin(v * 5.3)) +
            0.25 * Math.sin(v * 11.7 + u * 3.1);
          const k = 2 * (j * COMB_COLS + i);
          rest[k] = coat.rest * Math.sin(turn);
          rest[k + 1] = coat.rest * Math.cos(turn);
        }
      }
      if (restKey === '') comb.set(rest);
    };

    /** Lays the strands under a stroke from (x0, y0) to (x1, y1), in comb cells, along it. */
    const stroke = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      reach: number,
      hold: number,
    ) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const moved = Math.hypot(dx, dy);
      if (moved < 1e-4) return;
      const ux = dx / moved;
      const uy = dy / moved;
      const r = Math.ceil(reach * 2);
      for (let j = Math.floor(y1) - r; j <= Math.floor(y1) + r; j++) {
        if (j < 0 || j >= rows) continue;
        for (let i = Math.floor(x1) - r; i <= Math.floor(x1) + r; i++) {
          if (i < 0 || i >= COMB_COLS) continue;
          // The distance to the stroke's segment, so a fast stroke combs its whole path.
          const px = i + 0.5 - x0;
          const py = j + 0.5 - y0;
          const s = Math.min(1, Math.max(0, (px * dx + py * dy) / (moved * moved)));
          const ex = px - dx * s;
          const ey = py - dy * s;
          const w = Math.exp(-(ex * ex + ey * ey) / (reach * reach)) * hold;
          const k = 2 * (j * COMB_COLS + i);
          comb[k] = comb[k]! + (ux * 0.95 - comb[k]!) * w;
          comb[k + 1] = comb[k + 1]! + (uy * 0.95 - comb[k + 1]!) * w;
        }
      }
      combed++;
    };

    return {
      resize(w, h, ratio) {
        width = w;
        height = h;
        dpr = ratio;
        tail.resize(w, h);
        allocate();
        drawn = '';
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : Math.min(time.delta, 0.1);
        clock += dt;
        grownFor += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        const coat = COATS[params.coat] ?? COATS.fur!;
        if (!distance) allocate();
        const cell = coat.cell * dpr;
        const key = [width, height, params.text, params.size, params.coat].join();
        if (key !== drawn) {
          field.draw(encoder, distance!.createView(), width, height, layout());
          mapStrands(encoder, cell);
          drawn = key;
        }
        if (restKey !== params.coat) {
          settle(coat);
          restKey = params.coat;
        }
        // The pointer's stroke since the last frame, then the idle comb's.
        const p = pointer.state;
        const { dx, dy } = pointer.takeDelta();
        const reach = 2.2;
        if (p.inside && Math.hypot(dx, dy) > 1e-5) {
          idleFor = 0;
          stroke(
            (p.x - dx) * COMB_COLS,
            (p.y - dy) * rows,
            p.x * COMB_COLS,
            p.y * rows,
            reach,
            0.7,
          );
        } else {
          idleFor += dt;
        }
        if (params.idle && idleFor > 3 && dt > 0) {
          // A slow figure of eight over the letters.
          const speed = dosed(dose, 0.05, 0.16, 0.22);
          const at = (s: number) => [
            (0.5 + 0.38 * Math.sin(s)) * COMB_COLS,
            (0.5 + 0.22 * Math.sin(2 * s + 0.6)) * rows,
          ];
          const [x0, y0] = at((clock - dt) * speed * 2 * Math.PI);
          const [x1, y1] = at(clock * speed * 2 * Math.PI);
          stroke(x0!, y0!, x1!, y1!, reach, 0.35);
        }
        // Relaxing back to rest.
        const back = dt > 0 ? 1 - Math.exp(-dt / params.relax) : 0;
        for (let k = 0; k < comb.length; k++) comb[k]! += (rest[k]! - comb[k]!) * back;
        for (let k = 0, n = comb.length / 2; k < n; k++) {
          halves[4 * k] = toHalf(comb[2 * k]!);
          halves[4 * k + 1] = toHalf(comb[2 * k + 1]!);
        }
        device.queue.writeTexture(
          { texture: combTexture! },
          halves,
          { bytesPerRow: COMB_COLS * 8 },
          [COMB_COLS, rows],
        );
        const grown =
          params.grow > 0 && !time.still ? Math.min(1, grownFor / params.grow) ** 0.7 : 1;
        uniforms.set({
          width,
          height,
          css: dpr,
          time: clock,
          cell,
          radius: coat.thickness * cell,
          length: coat.length * params.length * capPx,
          grown: Math.max(grown, 0.02),
          density: coat.density,
          feather: 1.5 * cell,
          rise: coat.rise,
          shine: coat.shine,
          sway: time.still ? 0 : dosed(dose, 0, 0.05, 0.08),
          seed: 17,
          ao: 0.22,
          ambient: 0.3,
          light: 0.95,
          scene: params.behind === 'page' ? 1 : 0,
          root: coat.root,
          tip: coat.tip,
          spec: coat.spec,
          skin: coat.skin,
          back_top: [0.05, 0.045, 0.04, 1],
          back_bottom: [0.015, 0.013, 0.012, 1],
        });
        uniforms.upload();
        renderFullscreen(encoder, tail.scene.view, draw, [group!], {
          timestampWrites: profiler.pass('fur'),
        });
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => ({ strokes: combed }),
      destroy() {
        pointer.destroy();
        field.destroy();
        distance?.destroy();
        combTexture?.destroy();
        strands?.destroy();
        uniforms.destroy();
        tail.destroy();
      },
    };
  },
});
