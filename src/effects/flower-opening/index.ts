import { arrange, FLOWERS, type FlowerName, type Organ } from '../../gpu/flower/diagram.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { trackScroll } from '../../gpu/scroll.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct } from '../../gpu/uniforms.ts';
import { defineEffect } from '../types.ts';
import shader from './flower.wgsl';
import { meta } from './meta.ts';

// Story 12.1: one flower opening, built from its floral diagram (story 11.2) with grown petals
// (story 11.1). The diagram's organs go to the GPU once, as instances; each frame only the
// opening, the view and the light change. Drawn with 4x multisampling straight into the scene.

const Params = defineUniformStruct('Params', {
  view_proj: 'mat4x4f',
  eye: 'vec3f',
  time: 'f32',
  centre: 'vec3f',
  progress: 'f32',
  /** Towards the sun, and its strength. */
  sun: 'vec4f',
  spin: 'f32',
  bud_curl: 'f32',
  ruffle: 'f32',
  stagger: 'f32',
  flutter: 'f32',
  ambient: 'f32',
  translucency: 'f32',
  gloss: 'f32',
  throat: 'f32',
  petal: 'vec4f',
  base: 'vec4f',
  sepal: 'vec4f',
  filament: 'vec4f',
  anther: 'vec4f',
  carpel: 'vec4f',
});

type Vec3 = [number, number, number];

interface Colours {
  petal: Vec3;
  /** The throat, at the petal's base. */
  base: Vec3;
  throat: number;
  filament: Vec3;
  anther: Vec3;
  gloss: number;
  /**
   * How many times slower than the others it opens and closes. A rose's bloom is a filled disc
   * growing as it opens, which the motion check reads as a zoom: at the others' pace, twice the cap;
   * at an eighth of it (a minute to open), under it everywhere in the cycle.
   */
  pace?: number;
}

const GREEN: Vec3 = [0.06, 0.16, 0.03];
const COLOURS: Record<FlowerName, Colours> = {
  lily: {
    petal: [0.85, 0.42, 0.5],
    base: [0.75, 0.7, 0.25],
    throat: 0.35,
    filament: [0.7, 0.65, 0.4],
    anther: [0.35, 0.08, 0.02],
    gloss: 0.04,
  },
  buttercup: {
    petal: [0.85, 0.55, 0.01],
    base: [0.7, 0.45, 0.01],
    throat: 0.2,
    filament: [0.6, 0.5, 0.05],
    anther: [0.8, 0.6, 0.02],
    gloss: 0.5,
  },
  cherry: {
    petal: [0.92, 0.72, 0.76],
    base: [0.85, 0.5, 0.58],
    throat: 0.25,
    filament: [0.85, 0.8, 0.75],
    anther: [0.75, 0.55, 0.1],
    gloss: 0.02,
  },
  poppy: {
    petal: [0.72, 0.035, 0.015],
    base: [0.02, 0.015, 0.015],
    throat: 0.18,
    filament: [0.03, 0.025, 0.03],
    anther: [0.05, 0.04, 0.06],
    gloss: 0.03,
  },
  rose: {
    petal: [0.55, 0.025, 0.06],
    base: [0.6, 0.12, 0.08],
    throat: 0.2,
    filament: [0.7, 0.6, 0.2],
    anther: [0.8, 0.6, 0.1],
    gloss: 0.06,
    pace: 8,
  },
  camellia: {
    petal: [0.8, 0.18, 0.3],
    base: [0.9, 0.85, 0.8],
    throat: 0.08,
    filament: [0.85, 0.8, 0.55],
    anther: [0.85, 0.65, 0.08],
    gloss: 0.08,
  },
};

const KIND = { sepal: 0, petal: 1, stamen: 2, carpel: 3 } as const;
const ORGAN_FLOATS = 20;
const VERTICES = 21 * 10 * 6;
const PITCH = (38 * Math.PI) / 180;
const OPEN = 8;
const HOLD = 4;
const CLOSE = 5;
const REST = 1.5;

const pack = (organs: readonly Organ[]) => {
  const data = new Float32Array(organs.length * ORGAN_FLOATS);
  organs.forEach((o, i) => {
    const s = o.shape;
    data.set(
      [
        o.azimuth,
        o.radius,
        o.height,
        o.order,
        o.closed,
        o.open,
        o.scale,
        s.length,
        s.width,
        s.widest,
        s.tip,
        s.claw,
        s.notch,
        s.cup,
        o.curl,
        s.excess,
        s.fringe,
        KIND[o.organ],
        (i * 0.618) % 1,
        0,
      ],
      i * ORGAN_FLOATS,
    );
  });
  return data;
};

/** How far the open flower reaches from its axis, m. */
const reach = (organs: readonly Organ[]) =>
  Math.max(
    ...organs.map(
      (o) => o.radius + o.shape.length * o.scale * Math.sin(Math.min(o.open, Math.PI / 2)),
    ),
  );

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    flower: { type: 'select', default: 'lily', options: Object.keys(FLOWERS) },
    follow: { type: 'select', default: 'time', options: ['time', 'scroll'], label: 'opens with' },
    ruffle: { type: 'number', default: 1, min: 0, max: 3, step: 0.05, label: 'edge growth' },
    // Turning is whole-field rotation: the cap is 5° a second, so at most 0.012 turns.
    spin: {
      type: 'number',
      default: 0.008,
      min: 0,
      max: 0.012,
      step: 0.001,
      label: 'turns, per s',
    },
    behind: { type: 'select', default: 'dark', options: ['dark', 'page'], label: 'behind' },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0 },
    ...OVERLAY_PARAMS,
    alpha: { ...OVERLAY_PARAMS.alpha, default: 'coverage' },
  },
  presets: {
    lily: {},
    buttercup: { flower: 'buttercup' },
    'cherry blossom': { flower: 'cherry' },
    poppy: { flower: 'poppy' },
    rose: { flower: 'rose' },
    camellia: { flower: 'camellia' },
    'frilled poppy': { flower: 'poppy', ruffle: 2.5 },
    'on scroll': { follow: 'scroll' },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'flower-opening' });
    const uniforms = createUniformBuffer(device, Params, 'flower-opening params');
    const module = createShader(device, withChunks(shader, { 'params.wgsl': Params.wgsl }));
    const pipeline = device.createRenderPipeline({
      label: 'flower-opening organs',
      layout: 'auto',
      vertex: { module, entryPoint: 'organ_vs' },
      fragment: { module, entryPoint: 'organ_fs', targets: [{ format: tail.scene.format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
      multisample: { count: 4 },
    });
    const scroll = trackScroll(canvas);
    let organs: Organ[] = [];
    let organBuffer: GPUBuffer | undefined;
    let group: GPUBindGroup | undefined;
    let built = '';
    let size = 0.08;
    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;

    const build = (name: FlowerName) => {
      organs = arrange(FLOWERS[name]);
      organBuffer?.destroy();
      organBuffer = device.createBuffer({
        label: 'flower-opening organs',
        size: organs.length * ORGAN_FLOATS * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(organBuffer, 0, pack(organs));
      group = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniforms.buffer } },
          { binding: 1, resource: { buffer: organBuffer } },
        ],
      });
      size = reach(organs);
      built = name;
    };

    return {
      resize(w, h) {
        width = w;
        height = h;
        tail.resize(w, h);
        colour?.destroy();
        depth?.destroy();
        const make = (label: string, f: GPUTextureFormat) =>
          device.createTexture({
            label,
            size: [w, h],
            format: f,
            sampleCount: 4,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
          });
        colour = make('flower-opening colour', tail.scene.format);
        depth = make('flower-opening depth', 'depth24plus');
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : time.delta;
        clock += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        const name = (params.flower in FLOWERS ? params.flower : 'lily') as FlowerName;
        if (name !== built) build(name);
        let progress: number;
        if (params.follow === 'scroll') {
          progress = scroll.update(dt).progress;
        } else {
          // Held, the clock stands still: the held frame is the moment it was held at.
          // Opens, holds, closes, rests; the first frame is part way open.
          const pace = COLOURS[name].pace ?? 1;
          const open = OPEN * pace;
          const close = CLOSE * pace;
          const t = (clock + open * 0.45) % (open + HOLD + close + REST);
          progress =
            t < open
              ? t / open
              : t < open + HOLD
                ? 1
                : t < open + HOLD + close
                  ? 1 - (t - open - HOLD) / close
                  : 0;
          progress = progress * progress * (3 - 2 * progress);
        }
        // The view: the open flower fills about two thirds of the shorter side. Filling it, a lily's six
        // tepals are a rosette over the pattern rule's area limit.
        const aspect = width / height;
        const fovY = (30 * Math.PI) / 180;
        const fit = Math.max(1, 1 / aspect);
        const distance = (size * 1.5 * fit) / Math.tan(fovY / 2);
        const centre: Vec3 = [0, size * 0.1, 0];
        const eye: Vec3 = [0, centre[1] + distance * Math.sin(PITCH), -distance * Math.cos(PITCH)];
        const camera = pitchedCamera({
          aspect,
          eye,
          pitch: PITCH,
          fovY,
          near: distance * 0.05,
          far: distance * 4,
        });
        const c = COLOURS[name];
        uniforms.set({
          view_proj: camera.viewProj,
          eye,
          time: clock,
          centre,
          progress,
          sun: [-0.4, 0.75, 0.55, 2.2],
          spin: 2 * Math.PI * params.spin * dosed(dose, 0, 1, 1.2) * clock,
          bud_curl: 1.6,
          ruffle: params.ruffle,
          stagger: 0.45,
          flutter: time.still ? 0 : dosed(dose, 0, 0.02, 0.05),
          ambient: 0.9,
          translucency: 0.5,
          gloss: c.gloss,
          throat: c.throat,
          petal: [...c.petal, 1],
          base: [...c.base, 1],
          sepal: [...GREEN, 1],
          filament: [...c.filament, 1],
          anther: [...c.anther, 1],
          carpel: [0.25, 0.32, 0.08, 1],
        });
        uniforms.upload();
        const page = params.behind === 'page';
        const pass = encoder.beginRenderPass({
          label: 'flower-opening organs',
          colorAttachments: [
            {
              view: colour!.createView(),
              resolveTarget: tail.scene.view,
              loadOp: 'clear',
              clearValue: page
                ? { r: 0, g: 0, b: 0, a: 0 }
                : { r: 0.012, g: 0.016, b: 0.012, a: 1 },
              storeOp: 'discard',
            },
          ],
          depthStencilAttachment: {
            view: depth!.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('organs'),
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group!);
        pass.draw(VERTICES, organs.length);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => ({ organs: organs.length }),
      destroy() {
        scroll.destroy();
        organBuffer?.destroy();
        colour?.destroy();
        depth?.destroy();
        uniforms.destroy();
        tail.destroy();
      },
    };
  },
});
