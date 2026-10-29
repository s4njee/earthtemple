import { arrange, ROSE } from '../../gpu/flower/diagram.ts';
import { LOOKS, STEMS, type FlowerLook } from '../../gpu/flower/looks.ts';
import { openState, organPoint } from '../../gpu/flower/opening.ts';
import { createFlowerRenderer } from '../../gpu/flower/render.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { DISTANCE_FORMAT } from '../../gpu/grass/field.ts';
import { createHdrTail, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { createRandom } from '../../gpu/random.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct } from '../../gpu/uniforms.ts';
import { defineEffect } from '../types.ts';
import dofShader from '../meadow/dof.wgsl';
import dropShader from './drops.wgsl';
import { meta } from './meta.ts';

// Story 12.8: a macro close-up of a rose's petals beaded with dew, the look of a perfume or
// skincare brand. Three passes: the open rose from the shared flower renderer, sharp, with each
// pixel's distance; the drops over it, each a lens on that sharp picture (Water Temple's drop optics,
// drops.wgsl), placed on the petals by the CPU twin of the petal shader (src/gpu/flower/opening.ts)
// so they sit on the surface the GPU draws; and the meadow's depth of field (story 3.2's dof.wgsl),
// focused a few centimetres away with a macro lens's shallow depth.

type Vec3 = [number, number, number];

const DropParams = defineUniformStruct('DropParams', {
  view_proj: 'mat4x4f',
  eye: 'vec3f',
  yaw: 'f32',
  sun: 'vec3f',
  strength: 'f32',
  sky: 'vec3f',
  pad: 'f32',
  sun_screen: 'vec2f',
  viewport: 'vec2f',
});

const DofParams = defineUniformStruct('DofParams', {
  focus: 'f32',
  aperture: 'f32',
  max_radius: 'f32',
  strip_top: 'f32',
});

const VARIETIES: Record<string, FlowerLook> = {
  blush: {
    ...LOOKS.rose,
    petal: { anthocyanin: 3, pH: 4.5, layers: 2.2, velvet: 0.6 },
    base: { anthocyanin: 1, pH: 4.5, carotenoids: 5, layers: 2.3, velvet: 0.6 },
  },
  crimson: {
    ...LOOKS.rose,
    petal: { anthocyanin: 300, pH: 3.6, carotenoids: 4, layers: 1.2, velvet: 1 },
    base: { anthocyanin: 60, pH: 4, carotenoids: 10, layers: 1.4, velvet: 1 },
  },
  ivory: {
    ...LOOKS.rose,
    petal: { carotenoids: 1.5, layers: 2.8, velvet: 0.5 },
    base: { carotenoids: 6, layers: 2.6, velvet: 0.5 },
  },
};
const NAMES = Object.keys(VARIETIES);
const DROPS = 700;
const PITCH = (48 * Math.PI) / 180;
const FOV = (34 * Math.PI) / 180;
/** The view's middle, on the petals a little out from the heart of the rose, m. */
const TARGET: Vec3 = [0.004, 0.026, -0.02];
const DISTANCE = 0.052;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    variety: { type: 'select', default: 'blush', options: NAMES },
    drops: { type: 'number', default: 1, min: 0, max: 1.5, step: 0.05, label: 'dew' },
    focus: { type: 'number', default: 1, min: 0.6, max: 1.6, step: 0.01, label: 'focus' },
    aperture: { type: 'number', default: 1, min: 0, max: 2, step: 0.05, label: 'aperture' },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0.3 },
  },
  presets: {
    blush: {},
    crimson: { variety: 'crimson' },
    ivory: { variety: 'ivory' },
    'deep focus': { aperture: 0.25 },
  },

  async create({ device, format, hdr, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'dewy-petals' });
    const sceneFormat = tail.scene.format;
    const flowers = createFlowerRenderer(device, {
      format: sceneFormat,
      label: 'dewy-petals',
      distance: DISTANCE_FORMAT,
      // Most of the view is out of focus: within two pixels is plenty.
      tolerance: 2,
      species: [{ diagram: ROSE, stem: STEMS.rose }],
    });
    flowers.setLooks(NAMES.map((name) => ({ look: VARIETIES[name]!, stem: STEMS.rose })));

    // Dew on the open rose's petals: on their faces towards the sky, sizes from a fine mist to a few
    // large beads, each sitting on the petal as a near-sphere.
    const random = createRandom(11);
    const petals = arrange(ROSE).filter((o) => o.organ === 'petal');
    const dropData = new Float32Array(DROPS * 4);
    for (let k = 0; k < DROPS;) {
      const organ = petals[Math.floor(random() * petals.length)]!;
      const state = openState(organ, 1, { budCurl: 1.6, stagger: 0.45 });
      const u = 0.25 + 0.7 * random();
      const v = (random() * 2 - 1) * 0.75;
      const at = (du: number, dv: number) => organPoint(organ, state, u + du, v + dv);
      const p = at(0, 0);
      const pu = at(0.01, 0).map((c, i) => c - p[i]!);
      const pv = at(0, 0.01).map((c, i) => c - p[i]!);
      let n = norm([
        pv[1]! * pu[2]! - pv[2]! * pu[1]!,
        pv[2]! * pu[0]! - pv[0]! * pu[2]!,
        pv[0]! * pu[1]! - pv[1]! * pu[0]!,
      ]);
      if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
      // Where the lens is: within reach of the axis the flower turns about.
      if (Math.hypot(p[0], p[2]) > 0.055) continue;
      // Mostly small: a radius from 0.25 to 2 mm, as a power law.
      const radius = 0.00025 + 0.00175 * random() ** 3;
      dropData.set(
        [
          p[0] + n[0] * radius * 0.85,
          p[1] + n[1] * radius * 0.85,
          p[2] + n[2] * radius * 0.85,
          radius,
        ],
        k * 4,
      );
      k++;
    }
    const dropBuffer = device.createBuffer({
      label: 'dewy-petals drops',
      size: dropData.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(dropBuffer, 0, dropData);

    const dropUniforms = createUniformBuffer(device, DropParams, 'dewy-petals drops');
    const dropModule = createShader(
      device,
      withChunks(dropShader, { 'drop-params.wgsl': DropParams.wgsl }),
    );
    const dropPipeline = device.createRenderPipeline({
      label: 'dewy-petals drops',
      layout: 'auto',
      vertex: { module: dropModule, entryPoint: 'drop_vs' },
      fragment: { module: dropModule, entryPoint: 'drop_fs', targets: [{ format: sceneFormat }] },
      primitive: { topology: 'triangle-strip' },
    });
    const dofUniforms = createUniformBuffer(device, DofParams, 'dewy-petals dof');
    const dofModule = createShader(
      device,
      withChunks(dofShader, { 'dof-params.wgsl': DofParams.wgsl }),
    );
    const dofPipeline = device.createRenderPipeline({
      label: 'dewy-petals dof',
      layout: 'auto',
      vertex: { module: dofModule, entryPoint: 'dof_vs' },
      // A macro lens's wide blur over bright glints: a sparse disc shows its taps as stars.
      fragment: {
        module: dofModule,
        entryPoint: 'dof_fs',
        targets: [{ format: sceneFormat }],
        constants: { TAPS: 64 },
      },
    });
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let distanceMs: GPUTexture | undefined;
    let sharp: GPUTexture | undefined;
    let wet: GPUTexture | undefined;
    let distances: GPUTexture | undefined;
    let dropGroup: GPUBindGroup | undefined;
    let dofGroup: GPUBindGroup | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;

    return {
      resize(w, h) {
        width = w;
        height = h;
        tail.resize(w, h);
        for (const t of [colour, depth, distanceMs, sharp, wet, distances]) t?.destroy();
        const make = (label: string, f: GPUTextureFormat, samples: number, usage: number) =>
          device.createTexture({ label, size: [w, h], format: f, sampleCount: samples, usage });
        const target = GPUTextureUsage.RENDER_ATTACHMENT;
        const read = target | GPUTextureUsage.TEXTURE_BINDING;
        colour = make('dewy-petals colour', sceneFormat, 4, target);
        depth = make('dewy-petals depth', 'depth24plus', 4, target);
        distanceMs = make('dewy-petals distance', DISTANCE_FORMAT, 4, target);
        sharp = make('dewy-petals sharp', sceneFormat, 1, read | GPUTextureUsage.COPY_SRC);
        wet = make('dewy-petals wet', sceneFormat, 1, read | GPUTextureUsage.COPY_DST);
        distances = make('dewy-petals distances', DISTANCE_FORMAT, 1, read);
        dropGroup = device.createBindGroup({
          layout: dropPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: dropUniforms.buffer } },
            { binding: 1, resource: { buffer: dropBuffer } },
            { binding: 2, resource: sharp.createView() },
            { binding: 3, resource: distances.createView() },
            { binding: 4, resource: sampler },
          ],
        });
        dofGroup = device.createBindGroup({
          layout: dofPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: dofUniforms.buffer } },
            { binding: 1, resource: wet.createView() },
            { binding: 2, resource: distances.createView() },
          ],
        });
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : time.delta;
        clock += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        // The flower turns slowly under the lens: whole-field rotation, well under 5° a second.
        const yaw = 2 * Math.PI * 0.004 * dosed(dose, 0, 1, 1.3) * clock;
        const aspect = width / height;
        const eye: Vec3 = [
          TARGET[0],
          TARGET[1] + DISTANCE * Math.sin(PITCH),
          TARGET[2] - DISTANCE * Math.cos(PITCH),
        ];
        const camera = pitchedCamera({ aspect, eye, pitch: PITCH, fovY: FOV, near: 0.005, far: 2 });
        const sunDir = norm([-0.5, 0.75, 0.35]);
        const sun: Vec3 = [2.2, 2.1, 1.95];
        const sky: Vec3 = [0.55, 0.6, 0.68];
        const perMetre = height / (2 * DISTANCE * Math.tan(FOV / 2));
        flowers.prepare(
          {
            viewProj: camera.viewProj,
            eye,
            time: clock,
            sun: [...sunDir, 2.2],
            sunColour: [1, 0.96, 0.9],
            skyTop: sky,
            skyBottom: [0.2, 0.18, 0.18],
            translucency: 0.6,
          },
          [
            {
              species: 0,
              perMetre,
              heads: [
                {
                  position: [0, 0, 0],
                  progress: 1,
                  yaw,
                  look: Math.max(NAMES.indexOf(params.variety), 0),
                  stem: false,
                },
              ],
            },
          ],
        );
        // The sun's direction on screen, for the glint and the crescent.
        const right: Vec3 = [1, 0, 0];
        const up: Vec3 = [0, Math.cos(PITCH), Math.sin(PITCH)];
        const sunScreen: [number, number] = [
          sunDir[0] * right[0],
          sunDir[1] * up[1] + sunDir[2] * up[2],
        ];
        dropUniforms.set({
          view_proj: camera.viewProj,
          eye,
          yaw,
          sun,
          strength: 1.6,
          sky,
          sun_screen: sunScreen,
          viewport: [width, height],
        });
        dropUniforms.upload();
        const scale = height / 1080;
        const blur = params.aperture;
        dofUniforms.set({
          focus: DISTANCE * params.focus,
          aperture: 42 * blur * scale,
          max_radius: Math.min(26 * scale, 26 * blur * scale),
          strip_top: 0,
        });
        dofUniforms.upload();

        const pass = encoder.beginRenderPass({
          label: 'dewy-petals rose',
          colorAttachments: [
            {
              view: colour!.createView(),
              resolveTarget: sharp!.createView(),
              loadOp: 'clear',
              clearValue: { r: 0.32, g: 0.27, b: 0.28, a: 1 },
              storeOp: 'discard',
            },
            {
              view: distanceMs!.createView(),
              resolveTarget: distances!.createView(),
              loadOp: 'clear',
              clearValue: { r: 1e4, g: 0, b: 0, a: 0 },
              storeOp: 'discard',
            },
          ],
          depthStencilAttachment: {
            view: depth!.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('rose'),
        });
        flowers.draw(pass);
        pass.end();
        encoder.copyTextureToTexture({ texture: sharp! }, { texture: wet! }, [width, height]);
        const count = Math.round((DROPS * Math.min(params.drops, 1.5)) / 1.5);
        if (count > 0) {
          const dew = encoder.beginRenderPass({
            label: 'dewy-petals dew',
            colorAttachments: [{ view: wet!.createView(), loadOp: 'load', storeOp: 'store' }],
            timestampWrites: profiler.pass('dew'),
          });
          dew.setPipeline(dropPipeline);
          dew.setBindGroup(0, dropGroup!);
          dew.draw(4, count);
          dew.end();
        }
        const focus = encoder.beginRenderPass({
          label: 'dewy-petals focus',
          colorAttachments: [{ view: tail.scene.view, loadOp: 'clear', storeOp: 'store' }],
          timestampWrites: profiler.pass('focus'),
        });
        focus.setPipeline(dofPipeline);
        focus.setBindGroup(0, dofGroup!);
        focus.draw(3);
        focus.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => ({ ...flowers.stats(), drops: DROPS }),
      destroy() {
        flowers.destroy();
        dropBuffer.destroy();
        dropUniforms.destroy();
        dofUniforms.destroy();
        for (const t of [colour, depth, distanceMs, sharp, wet, distances]) t?.destroy();
        tail.destroy();
      },
    };
  },
});

function norm(v: readonly number[]): Vec3 {
  const l = Math.hypot(...v) || 1;
  return [v[0]! / l, v[1]! / l, v[2]! / l];
}
