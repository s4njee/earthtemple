import { SPECIES } from '../../gpu/grass/blade.ts';
import { trackDomRects } from '../../gpu/dom-rects.ts';
import { leafColours } from '../../gpu/optics/leaf.ts';
import { trackPointer } from '../../gpu/pointer.ts';
import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { trackScroll } from '../../gpu/scroll.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct, uniformArray } from '../../gpu/uniforms.ts';
import { defineEffect } from '../types.ts';
import shader from './edges.wgsl';
import { meta } from './meta.ts';

// Story 3.5: grass growing along the top edges of the page's own elements, marked
// `data-et-obstacle` (dom-rects.ts), and along the bottom of the canvas. 2D blades in one
// instanced draw (edges.wgsl). The plan imagined Snow Temple's per-column rows holding a length,
// as they held snow; grass does not slide or pile, so a blade's length is a pure function of the
// growth, and nothing per column needs keeping.

const EDGES = 24;
const MAX_BLADES = 12_000;

const Params = defineUniformStruct('Params', {
  width: 'f32',
  height: 'f32',
  time: 'f32',
  spacing: 'f32',
  tall: 'f32',
  blade: 'f32',
  growth: 'f32',
  lean: 'f32',
  gust: 'f32',
  speed: 'f32',
  scale: 'f32',
  flutter: 'f32',
  /** Pointer x, y in px, its reach in px, how hard it parts the grass. */
  pointer: 'vec4f',
  edges: 'f32',
  light: 'f32',
  glow: 'f32',
  base: 'vec3f',
  tip_lush: 'vec3f',
  tip_pale: 'vec3f',
  transmit: 'vec3f',
  /** Per edge: x0, x1, y (px), and a seed. */
  edge: uniformArray('vec4f', EDGES),
  /** Per edge: the index of its first blade. */
  starts: uniformArray('vec4f', EDGES),
});

const VERTICES = 11;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    follow: { type: 'select', default: 'time', options: ['time', 'scroll'] },
    grow: { type: 'number', default: 6, min: 1, max: 30, step: 0.5, label: 'grows in, s' },
    height: { type: 'number', default: 1, min: 0.3, max: 2.5, step: 0.05, label: 'blade height' },
    density: { type: 'number', default: 1, min: 0.3, max: 2, step: 0.05 },
    part: { type: 'number', default: 0.8, min: 0, max: 1.3, step: 0.05, label: 'pointer parts it' },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
    ...OVERLAY_PARAMS,
    alpha: { ...OVERLAY_PARAMS.alpha, default: 'coverage' },
  },
  presets: {
    spring: {},
    'on scroll': { follow: 'scroll' },
    meadow: { height: 1.8, density: 1.4 },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'grass-edges' });
    const uniforms = createUniformBuffer(device, Params, 'grass-edges params');
    const module = createShader(device, withChunks(shader, { 'params.wgsl': Params.wgsl }));
    const pipeline = device.createRenderPipeline({
      label: 'grass-edges blades',
      layout: 'auto',
      vertex: { module, entryPoint: 'blade_vs' },
      fragment: {
        module,
        entryPoint: 'blade_fs',
        targets: [
          {
            format: tail.scene.format,
            blend: {
              color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
              alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            },
          },
        ],
      },
      primitive: { topology: 'triangle-strip' },
    });
    const group = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniforms.buffer } }],
    });
    const dom = trackDomRects(canvas);
    const pointer = trackPointer(canvas);
    const scroll = trackScroll(canvas);
    const pg = SPECIES.meadow.pigments;
    const colours = {
      base: leafColours(pg.root[0]).reflect,
      tip_lush: leafColours(pg.tip[0]).reflect,
      tip_pale: leafColours(pg.tip[1]).reflect,
      transmit: leafColours(pg.tip[0]).transmit,
    };
    let width = 1;
    let height = 1;
    let dpr = 1;
    // The first frame shows the grass half grown, so a held frame or a poster is grass coming up.
    let clock = 0.5 * params.grow;
    let push = 0;

    return {
      resize(w, h, pixelRatio) {
        width = w;
        height = h;
        dpr = pixelRatio;
        tail.resize(w, h);
      },
      frame(time, encoder, target) {
        clock += time.delta;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        // The ground, then the top of every marked element in view.
        const spacing = (3 * dpr) / params.density;
        const edges: [number, number, number, number][] = [[0, width, height + 1, 0]];
        for (const o of dom.update(time.delta).obstacles) {
          const x0 = Math.max(0, o.box.left) * width;
          const x1 = Math.min(1, o.box.right) * width;
          const y = o.box.top * height;
          if (x1 - x0 < 8 * dpr || y < 0 || y > height) continue;
          edges.push([x0, x1, y, edges.length * 17.3]);
          if (edges.length === EDGES) break;
        }
        const edge = new Float32Array(4 * EDGES);
        const starts = new Float32Array(4 * EDGES);
        let count = 0;
        edges.forEach((e, k) => {
          edge.set(e, 4 * k);
          starts[4 * k] = count;
          count += Math.ceil((e[1] - e[0]) / spacing) + 2;
        });
        count = Math.min(count, MAX_BLADES);
        const growth =
          params.follow === 'scroll'
            ? scroll.update(time.delta).progress * 1.4
            : Math.min(clock / params.grow, 1) * 1.05;
        const p = pointer.state;
        push += ((p.inside ? params.part : 0) - push) * Math.min(1, time.delta * 6);
        uniforms.set({
          width,
          height,
          time: clock,
          spacing,
          tall: 26 * dpr * params.height,
          blade: 3.2 * dpr,
          // Held, it shows the grass grown, unless the scroll grows it: that is the visitor's
          // own motion, so the held frame keeps the scroll's growth.
          growth: time.still && params.follow !== 'scroll' ? Math.max(growth, 1) : growth,
          lean: dosed(dose, 0, 0.1, 0.18),
          gust: time.still ? 0 : dosed(dose, 0, 0.28, 0.34),
          speed: dosed(dose, 60, 150, 190) * dpr,
          scale: 260 * dpr,
          flutter: dosed(dose, 0, 0.04, 0.05),
          pointer: [p.x * width, p.y * height, 34 * dpr, push],
          edges: edges.length,
          light: 1.9,
          glow: 0.6,
          ...colours,
          edge,
          starts,
        });
        uniforms.upload();
        const pass = encoder.beginRenderPass({
          label: 'grass-edges blades',
          colorAttachments: [
            {
              view: tail.scene.view,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: 'store',
            },
          ],
          timestampWrites: profiler.pass('blades'),
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        if (count > 0) pass.draw(VERTICES, count);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => ({ edges: 0 }),
      destroy() {
        dom.destroy();
        pointer.destroy();
        scroll.destroy();
        uniforms.destroy();
        tail.destroy();
      },
    };
  },
});
