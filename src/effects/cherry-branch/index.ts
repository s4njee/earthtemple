import { CHERRY, type FloralDiagram, type Whorl } from '../../gpu/flower/diagram.ts';
import { nodToward } from '../../gpu/flower/heliotropism.ts';
import { LOOKS, STEMS } from '../../gpu/flower/looks.ts';
import { createFlowerRenderer, type FlowerHead } from '../../gpu/flower/render.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { colonise, type Vec3 } from '../../gpu/plant/colonise.ts';
import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { createRandom } from '../../gpu/random.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { trackScroll } from '../../gpu/scroll.ts';
import { createShader, withChunks } from '../../gpu/shader.ts';
import { createUniformBuffer, defineUniformStruct } from '../../gpu/uniforms.ts';
import { defineEffect } from '../types.ts';
import branchShader from './branch.wgsl';
import { meta } from './meta.ts';

// Story 12.7: a cherry branch that grows, buds and blossoms as the page scrolls, then sheds its
// petals on the wind. The branch is grown by space colonisation (story 5.1, src/gpu/plant/
// colonise.ts) into a spray of attractors, thickened by the pipe model, and drawn as tubes that
// extend from the root out and thicken behind the growing tips. Blossoms stand on pedicels along
// the twigs, the shared flower renderer's cherry (src/gpu/flower/diagram.ts): buds swell, open a
// little out of step with each other, and then let their petals go. A fallen petal is the same
// petal alone, tumbling as it falls and carried on the breeze (story 4.3's petals).

const BranchParams = defineUniformStruct('BranchParams', {
  view_proj: 'mat4x4f',
  sun_dir: 'vec3f',
  grown: 'f32',
  sun: 'vec3f',
  pad0: 'f32',
  sky: 'vec3f',
  pad1: 'f32',
  low: 'vec3f',
  pad2: 'f32',
  high: 'vec3f',
});

/** A cherry petal, falling alone. */
const PETAL: FloralDiagram = {
  name: 'cherry petal',
  receptacle: false,
  rings: [
    {
      ...(CHERRY.rings[1] as Whorl),
      count: 1,
      radius: 0,
      height: 0,
      closed: 1.45,
      open: 1.45,
    },
  ],
};

const EYE: Vec3 = [0, 0.02, -1.55];
const PITCH = 0.02;
const FOV = (38 * Math.PI) / 180;
/** A cycle in the time mode, s: from a bare branch through blossom to bare again. */
const CYCLE = 34;
const MAX_FALLING = 900;
const SIDES = 10;

interface Blossom {
  position: Vec3;
  axis: Vec3;
  /** How far behind the others it is, 0 to 1. */
  lag: number;
  yaw: number;
  shed: number;
}

interface Falling {
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
  angle: number;
  rate: number;
  yaw: number;
  age: number;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    follow: {
      type: 'select',
      default: 'time',
      options: ['time', 'scroll'],
      label: 'grows with',
    },
    seed: { type: 'number', default: 5, min: 1, max: 999, step: 1 },
    behind: { type: 'select', default: 'sky', options: ['sky', 'page'], label: 'behind' },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0.15 },
    ...OVERLAY_PARAMS,
    alpha: { ...OVERLAY_PARAMS.alpha, default: 'coverage' },
  },
  presets: {
    blossom: {},
    'on scroll': { follow: 'scroll' },
    'another branch': { seed: 23 },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'cherry-branch' });
    const flowers = createFlowerRenderer(device, {
      format: tail.scene.format,
      label: 'cherry-branch',
      species: [
        { diagram: CHERRY, stem: STEMS.cherry },
        { diagram: PETAL, stem: STEMS.cherry },
      ],
    });
    flowers.setLooks([{ look: LOOKS.cherry, stem: STEMS.cherry }]);
    const uniforms = createUniformBuffer(device, BranchParams, 'cherry-branch params');
    const module = createShader(
      device,
      withChunks(branchShader, { 'branch-params.wgsl': BranchParams.wgsl }),
    );
    const depthStencil = (write: boolean): GPUDepthStencilState => ({
      format: 'depth24plus',
      depthWriteEnabled: write,
      depthCompare: write ? 'less' : 'always',
    });
    const branchPipeline = device.createRenderPipeline({
      label: 'cherry-branch wood',
      layout: 'auto',
      vertex: { module, entryPoint: 'branch_vs' },
      fragment: { module, entryPoint: 'branch_fs', targets: [{ format: tail.scene.format }] },
      depthStencil: depthStencil(true),
      multisample: { count: 4 },
    });
    const skyPipeline = device.createRenderPipeline({
      label: 'cherry-branch sky',
      layout: 'auto',
      vertex: { module, entryPoint: 'sky_vs' },
      fragment: { module, entryPoint: 'sky_fs', targets: [{ format: tail.scene.format }] },
      depthStencil: depthStencil(false),
      multisample: { count: 4 },
    });
    const skyGroup = device.createBindGroup({
      layout: skyPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniforms.buffer } }],
    });

    // The branch, its blossoms and its fallen petals, for a seed.
    let segmentBuffer: GPUBuffer | undefined;
    let branchGroup: GPUBindGroup | undefined;
    let segments = 0;
    let longest = 1;
    let blossoms: Blossom[] = [];
    let grownFor = -1;
    const falling: Falling[] = [];
    const grow = (seed: number) => {
      const random = createRandom(seed);
      // A spray reaching up and across the view from the lower left.
      const attractors: Vec3[] = [];
      while (attractors.length < 420) {
        const p: Vec3 = [random() * 2 - 1, random() * 2 - 1, random() * 2 - 1];
        if (Math.hypot(...p) > 1) continue;
        const x = 0.12 + p[0] * 0.58;
        const y = 0.08 + p[1] * 0.3 + 0.25 * (x - 0.1);
        attractors.push([x, y, p[2] * 0.12]);
      }
      const nodes = colonise({
        attractors,
        root: [-0.78, -0.36, 0.02],
        direction: [1, 0.45, 0],
        step: 0.012,
        influence: 0.13,
        kill: 0.028,
        tropism: [0.05, 0.08, 0],
        tip: 0.0016,
        maxNodes: 2400,
      });
      const data = new Float32Array((nodes.length - 1) * 12);
      let k = 0;
      longest = 0;
      for (const n of nodes) {
        longest = Math.max(longest, n.depth);
        if (n.parent < 0) continue;
        const p = nodes[n.parent]!;
        data.set(
          [...p.position, p.radius, ...n.position, n.radius, p.depth, n.depth, 0, 0],
          k * 12,
        );
        k++;
      }
      segments = k;
      segmentBuffer?.destroy();
      segmentBuffer = device.createBuffer({
        label: 'cherry-branch segments',
        size: Math.max(data.byteLength, 48),
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(segmentBuffer, 0, data);
      branchGroup = device.createBindGroup({
        layout: branchPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: uniforms.buffer } },
          { binding: 1, resource: { buffer: segmentBuffer } },
        ],
      });
      // Blossoms on the twigs, in clusters of one to three on their pedicels.
      blossoms = [];
      nodes.forEach((n, i) => {
        if (n.radius > 0.0034 || i % 3 !== 0 || random() > 0.75) return;
        const cluster = 1 + Math.floor(random() * 3);
        for (let c = 0; c < cluster; c++) {
          const a = random() * 6.283;
          // Out from the twig, up a little and towards the viewer.
          const axis = norm([Math.cos(a) * 0.8, Math.sin(a) * 0.8 + 0.35, -0.55]);
          const length = STEMS.cherry.length * (0.7 + 0.6 * random());
          blossoms.push({
            position: [
              n.position[0] + axis[0] * length,
              n.position[1] + axis[1] * length,
              n.position[2] + axis[2] * length,
            ],
            axis,
            lag: random(),
            yaw: random() * 6.283,
            shed: 0,
          });
        }
      });
      falling.length = 0;
      grownFor = seed;
    };

    const scroll = trackScroll(canvas);
    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;
    const random = createRandom(99);

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
        colour = make('cherry-branch colour', tail.scene.format);
        depth = make('cherry-branch depth', 'depth24plus');
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : time.delta;
        clock += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        const seed = Math.round(params.seed);
        if (seed !== grownFor) grow(seed);
        // Grown over the first third, budding, in blossom, and shedding by the end. In time, the
        // branch grows once, then blossoms and sheds every spring; the first frame is in bud.
        let p: number;
        if (params.follow === 'scroll') {
          p = scroll.update(dt).progress;
        } else {
          const t = clock / CYCLE + 0.55;
          p = t < 1 ? t : 0.3 + 0.7 * (t % 1);
        }
        const grown = longest * smoothstep(0, 0.32, p) * 1.05;

        // The breeze, gusting; it carries the fallen petals and stirs the blossoms.
        const gust = 1 + 0.6 * Math.sin(0.35 * clock) + 0.3 * Math.sin(1.1 * clock + 1.7);
        const breeze = dosed(dose, 0, 0.35, 0.6) * Math.max(gust, 0.2);
        const heads: FlowerHead[] = [];
        for (const b of blossoms) {
          const swell = smoothstep(0.32 + 0.08 * b.lag, 0.44 + 0.08 * b.lag, p);
          if (swell <= 0.01) {
            b.shed = 0;
            continue;
          }
          const open = smoothstep(0.44 + 0.12 * b.lag, 0.6 + 0.12 * b.lag, p);
          const shed = smoothstep(0.76 + 0.12 * b.lag, 0.97, p);
          // As a blossom lets its petals go, they fall from it: five a blossom.
          if (shed > b.shed && dt > 0) {
            const count = Math.round(5 * shed) - Math.round(5 * b.shed);
            for (let c = 0; c < count && falling.length < MAX_FALLING; c++) {
              falling.push({
                position: [...b.position],
                velocity: [0.05 * (random() - 0.5), -0.05, 0.05 * (random() - 0.5)],
                spin: norm([random() - 0.5, random() - 0.5, random() - 0.5]),
                angle: random() * 6.283,
                rate: 2 + 4 * random(),
                yaw: random() * 6.283,
                age: 0,
              });
            }
          }
          b.shed = shed;
          if (shed >= 0.999) continue;
          heads.push({
            position: b.position,
            progress: open,
            yaw: b.yaw,
            scale: 0.4 + 0.6 * swell,
            nod: nodToward(b.axis),
            pedicel: true,
            shed,
          });
        }
        // Fallen petals: a terminal fall of about half a metre a second, carried on the breeze,
        // fluttering side to side and tumbling as they go.
        const petals: FlowerHead[] = [];
        for (let i = falling.length - 1; i >= 0; i--) {
          const f = falling[i]!;
          if (dt > 0) {
            f.age += dt;
            const flutter = Math.sin(f.age * f.rate + f.yaw) * 0.25;
            const target: Vec3 = [breeze + flutter, -0.45, 0.12 * Math.cos(f.age * 1.3 + f.yaw)];
            const k = 1 - Math.exp(-dt / 0.35);
            f.velocity = f.velocity.map((v, j) => v + (target[j]! - v) * k) as Vec3;
            f.position = f.position.map((x, j) => x + f.velocity[j]! * dt) as Vec3;
            f.angle += f.rate * dt;
          }
          if (f.position[1] < -1 || f.position[0] > 1.6 || f.age > 14) {
            falling.splice(i, 1);
            continue;
          }
          // Tumbling: the petal's axis turned about its spin axis.
          const c = Math.cos(f.angle);
          const s = Math.sin(f.angle);
          const a = f.spin;
          const up: Vec3 = [0, 1, 0];
          const dotA = a[1];
          const turned = norm([
            up[0] * c + (a[1] * up[2] - a[2] * up[1]) * s + a[0] * dotA * (1 - c),
            up[1] * c + (a[2] * up[0] - a[0] * up[2]) * s + a[1] * dotA * (1 - c),
            up[2] * c + (a[0] * up[1] - a[1] * up[0]) * s + a[2] * dotA * (1 - c),
          ]);
          petals.push({
            position: f.position,
            progress: 1,
            yaw: f.yaw + f.angle * 0.3,
            nod: nodToward(turned),
            stem: false,
          });
        }

        const aspect = width / height;
        const camera = pitchedCamera({
          aspect,
          eye: EYE,
          pitch: PITCH,
          fovY: FOV,
          near: 0.05,
          far: 10,
        });
        const perMetre = height / (2 * Math.abs(EYE[2]) * Math.tan(FOV / 2));
        const sunDir = norm([-0.5, 0.7, -0.5]);
        flowers.prepare(
          {
            viewProj: camera.viewProj,
            eye: EYE,
            time: clock,
            sun: [...sunDir, 2],
            sunColour: [1, 0.96, 0.9],
            skyTop: [0.45, 0.52, 0.62],
            skyBottom: [0.22, 0.2, 0.2],
            translucency: 0.7,
            flutter: time.still ? 0 : dosed(dose, 0, 0.03, 0.06),
          },
          [
            { species: 0, perMetre, heads },
            { species: 1, perMetre, heads: petals },
          ],
        );
        uniforms.set({
          view_proj: camera.viewProj,
          sun_dir: sunDir,
          grown,
          sun: [2, 1.92, 1.8],
          sky: [0.45, 0.52, 0.62],
          low: [0.78, 0.82, 0.86],
          high: [0.42, 0.6, 0.82],
        });
        uniforms.upload();
        const page = params.behind === 'page';
        const pass = encoder.beginRenderPass({
          label: 'cherry-branch',
          colorAttachments: [
            {
              view: colour!.createView(),
              resolveTarget: tail.scene.view,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: page ? 0 : 1 },
              storeOp: 'discard',
            },
          ],
          depthStencilAttachment: {
            view: depth!.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('branch'),
        });
        if (!page) {
          pass.setPipeline(skyPipeline);
          pass.setBindGroup(0, skyGroup);
          pass.draw(3);
        }
        pass.setPipeline(branchPipeline);
        pass.setBindGroup(0, branchGroup!);
        pass.draw(SIDES * 6, segments);
        flowers.draw(pass);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => ({ ...flowers.stats(), segments, falling: falling.length }),
      destroy() {
        scroll.destroy();
        flowers.destroy();
        segmentBuffer?.destroy();
        uniforms.destroy();
        colour?.destroy();
        depth?.destroy();
        tail.destroy();
      },
    };
  },
});

function norm(v: readonly number[]): Vec3 {
  const l = Math.hypot(...v) || 1;
  return [v[0]! / l, v[1]! / l, v[2]! / l];
}
