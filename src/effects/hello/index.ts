import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct } from '../../gpu/uniforms.ts';
import { defineEffect } from '../types.ts';
import shader from './blades.wgsl';
import { meta } from './meta.ts';

const Params = defineUniformStruct('Params', {
  width: 'f32',
  height: 'f32',
  time: 'f32',
  wind: 'f32',
  tall: 'f32',
  blade: 'f32',
  count: 'f32',
});

/** The most blades the widest strip draws. */
const MAX_BLADES = 4000;
/** Vertices per blade: four rows of two, then the tip. */
const VERTICES = 9;

const NO_TONEMAP = { output: { tonemap: 'none' } } as const;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    height: { type: 'number', default: 1, min: 0.3, max: 3, step: 0.05, label: 'blade height' },
    density: { type: 'number', default: 1, min: 0.2, max: 2, step: 0.05 },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
    ...OVERLAY_PARAMS,
    alpha: { ...OVERLAY_PARAMS.alpha, default: 'coverage' },
  },
  presets: {
    breeze: {},
    still: { dose: 0.1 },
    tall: { height: 2 },
  },

  async create({ device, format, hdr, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'hello' });
    const uniforms = createUniformBuffer(device, Params, 'hello params');
    const module = createShader(device, withChunks(shader, { 'params.wgsl': Params.wgsl }));
    const pipeline = device.createRenderPipeline({
      label: 'hello blades',
      layout: 'auto',
      vertex: { module, entryPoint: 'blade_vs' },
      fragment: {
        module,
        entryPoint: 'blade_fs',
        // Premultiplied "over", colour and coverage alike.
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
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniforms.buffer } }],
    });
    let width = 1;
    let height = 1;
    let dpr = 1;
    let clock = 0;

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
        // A blade every 3 CSS pixels at density 1.
        const count = Math.min(MAX_BLADES, Math.round((width / dpr / 3) * params.density));
        uniforms.set({
          width,
          height,
          time: clock,
          wind: dosed(dose, 0, 0.35, 0.8),
          tall: Math.min(height * 0.5, 70 * dpr * params.height),
          blade: 3 * dpr,
          count,
        });
        uniforms.upload();
        const pass = encoder.beginRenderPass({
          label: 'hello blades',
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
        pass.setBindGroup(0, bindGroup);
        pass.draw(VERTICES, count);
        pass.end();
        // Grass is darker than paper white: no tonemap curve to grey it.
        tail.encode(encoder, target, time, params, profiler, NO_TONEMAP);
      },
      destroy() {
        uniforms.destroy();
        tail.destroy();
      },
    };
  },
});
