import { arrange, FLOWERS, type FlowerName, type Organ } from '../../gpu/flower/diagram.ts';
import { FLAT_PETAL, GRIDS, petalLod, ringLod } from '../../gpu/flower/petal.ts';
import { headTilt, StemSway } from '../../gpu/flower/stem.ts';
import { leafColours } from '../../gpu/optics/leaf.ts';
import { petalColours, type PetalPigments } from '../../gpu/optics/petal.ts';
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
  throat_edge: 'f32',
  velvet: 'f32',
  base_velvet: 'f32',
  /** Grating spacing, nm, and strength (0 for none). */
  grating: 'vec2f',
  petal: 'vec4f',
  petal_through: 'vec4f',
  base: 'vec4f',
  base_through: 'vec4f',
  sepal: 'vec4f',
  sepal_through: 'vec4f',
  /** The petal in the bud, mixed towards the open petal as each opens. */
  petal_bud: 'vec4f',
  petal_bud_through: 'vec4f',
  tube_base: 'vec4f',
  tube_base_through: 'vec4f',
  tube_rim: 'vec4f',
  tube_rim_through: 'vec4f',
  /** The stem's tip: its displacement (x, z), the head's tilt and the tip's drop. */
  sway: 'vec4f',
  /** The stem's length and radius. */
  stem: 'vec4f',
  filament: 'vec4f',
  anther: 'vec4f',
  carpel: 'vec4f',
});

type Vec3 = [number, number, number];

/** A flower's petals and parts: pigments for the petal and its throat, and its surface. */
interface Look {
  petal: PetalPigments;
  /** The throat, at the petal's base: out to `throat` of its length, fading over `edge` of it. */
  base: PetalPigments;
  throat: number;
  edge?: number;
  filament: Vec3;
  anther: Vec3;
  /** A glossy epidermis over an air gap (the buttercup's), 0 to 1. */
  gloss: number;
  /** The petal's pigments in the bud, when it changes colour as it opens. */
  bud?: PetalPigments;
  /** A fused tube's colour, from its base to its rim; the throat's and the petal's if not given. */
  tube?: { base: PetalPigments; rim: PetalPigments };
  /** Cuticle striations at the throat: their spacing, nm, and how strongly they diffract. */
  grating?: [number, number];
  /**
   * How many times slower than the others it opens and closes. A rose's bloom is a filled disc
   * growing as it opens, which the motion check reads as a zoom: at the others' pace, twice the cap;
   * at an eighth of it (a minute to open), under it everywhere in the cycle.
   */
  pace?: number;
  /**
   * How much of the view it fills, against the others. A lily's six tepals and six stamens are a
   * rosette of eight pairs, and swaying it is a moving pattern, whose limit is 0.25 of the central
   * field: framed as the others, it covered 0.34.
   */
  fill?: number;
}

const SEPAL = leafColours({ chlorophyll: 40, carotenoids: 10, brown: 0, layers: 1.8 });
const LOOKS: Record<FlowerName, Look> = {
  // A pink oriental lily, green-yellow in the throat.
  lily: {
    petal: { anthocyanin: 3.5, pH: 4.5, layers: 1.8 },
    base: { chlorophyll: 3, carotenoids: 8, layers: 1.8 },
    throat: 0.35,
    filament: [0.6, 0.62, 0.4],
    anther: [0.35, 0.08, 0.02],
    gloss: 0.04,
    fill: 0.8,
  },
  // Carotenoids, and flavonols at the base: a bee sees a dark centre (story 16.1).
  buttercup: {
    petal: { carotenoids: 45, layers: 1.8 },
    base: { carotenoids: 45, flavonols: 40, layers: 1.8 },
    throat: 0.3,
    filament: [0.55, 0.5, 0.08],
    anther: [0.85, 0.65, 0.05],
    gloss: 0.6,
  },
  // Nearly white, flushed pink towards the base.
  cherry: {
    petal: { anthocyanin: 0.5, pH: 4, layers: 2.6 },
    base: { anthocyanin: 3, pH: 4, layers: 2.2 },
    throat: 0.3,
    filament: [0.85, 0.8, 0.75],
    anther: [0.75, 0.55, 0.1],
    gloss: 0.02,
  },
  // Scarlet from anthocyanin and carotenoid together, with a black blotch of dense pigment.
  poppy: {
    petal: { anthocyanin: 22, pH: 3, carotenoids: 5, layers: 1.3, velvet: 0.5 },
    base: { anthocyanin: 140, pH: 5.5, layers: 1.3, velvet: 0.5 },
    throat: 0.18,
    filament: [0.03, 0.025, 0.03],
    anther: [0.05, 0.04, 0.06],
    gloss: 0.02,
  },
  // A red rose's velvet: conical cells over dense anthocyanin.
  rose: {
    petal: { anthocyanin: 70, pH: 3.5, carotenoids: 4, layers: 1.5, velvet: 1 },
    base: { anthocyanin: 12, pH: 4, carotenoids: 8, layers: 1.5, velvet: 1 },
    throat: 0.2,
    filament: [0.7, 0.6, 0.2],
    anther: [0.8, 0.6, 0.1],
    gloss: 0.02,
    pace: 8,
  },
  camellia: {
    petal: { anthocyanin: 7, pH: 4.5, layers: 1.8, velvet: 0.2 },
    base: { anthocyanin: 1, pH: 4.5, layers: 2.6 },
    throat: 0.1,
    filament: [0.85, 0.8, 0.55],
    anther: [0.85, 0.65, 0.08],
    gloss: 0.08,
  },
  // Cream petals, a maroon base whose striations diffract (Whitney et al.: about 1.3 µm apart).
  hibiscus: {
    petal: { carotenoids: 3, layers: 2.4 },
    base: { anthocyanin: 400, pH: 5.5, layers: 1.3, velvet: 0.4 },
    throat: 0.4,
    edge: 0.06,
    filament: [0.75, 0.7, 0.35],
    anther: [0.85, 0.7, 0.1],
    gloss: 0.05,
    grating: [1300, 0.6],
  },
  // Blue when open, purple in the bud (vacuole pH 7.7 against 6.6), white deep in the funnel.
  'morning glory': {
    petal: { anthocyanin: 9, pH: 7.7, layers: 1.6 },
    bud: { anthocyanin: 9, pH: 6.6, layers: 1.6 },
    base: { anthocyanin: 9, pH: 7.7, layers: 1.6 },
    throat: 0,
    tube: { base: { carotenoids: 2, layers: 2.8 }, rim: { anthocyanin: 9, pH: 7.7, layers: 1.6 } },
    filament: [0.85, 0.85, 0.8],
    anther: [0.9, 0.88, 0.8],
    gloss: 0.04,
  },
  // Yellow tepals round a deeper yellow trumpet.
  daffodil: {
    petal: { carotenoids: 28, layers: 2 },
    base: { carotenoids: 28, chlorophyll: 2, layers: 2 },
    throat: 0.15,
    tube: { base: { carotenoids: 60, layers: 1.8 }, rim: { carotenoids: 80, layers: 1.8 } },
    filament: [0.8, 0.75, 0.4],
    anther: [0.85, 0.7, 0.1],
    gloss: 0.05,
    // Six tepals: a rosette, as the lily's.
    fill: 0.85,
  },
};

const KIND = { sepal: 0, petal: 1, stamen: 2, carpel: 3, receptacle: 4, tube: 5, stem: 6 } as const;

/**
 * Story 11.5: each flower's stem (or pedicel, for a flower on a branch): its length, radius and the
 * head's mass. Green stems are taken at 1 GPa and water's density; the head's area facing the wind
 * is its open reach's disc.
 */
const STEMS: Record<FlowerName, { length: number; radius: number; headMass: number }> = {
  lily: { length: 0.6, radius: 0.004, headMass: 0.012 },
  buttercup: { length: 0.3, radius: 0.0009, headMass: 0.0004 },
  cherry: { length: 0.025, radius: 0.0005, headMass: 0.0003 },
  poppy: { length: 0.5, radius: 0.0015, headMass: 0.001 },
  rose: { length: 0.4, radius: 0.0035, headMass: 0.008 },
  camellia: { length: 0.03, radius: 0.0025, headMass: 0.006 },
  hibiscus: { length: 0.06, radius: 0.0012, headMass: 0.002 },
  'morning glory': { length: 0.05, radius: 0.001, headMass: 0.0015 },
  daffodil: { length: 0.35, radius: 0.003, headMass: 0.006 },
};
const ORGAN_FLOATS = 20;
const PITCH = (38 * Math.PI) / 180;
const OPEN = 8;
const HOLD = 4;
const CLOSE = 5;
const REST = 1.5;

const pack = (organs: readonly Organ[]) => {
  const data = new Float32Array(organs.length * ORGAN_FLOATS);
  organs.forEach((o, i) => {
    const s = o.shape;
    const t = o.tube;
    if (t) {
      // A tube: its rim in the bud and open, its flare and waves; its rim's ruffle in b.w.
      data.set(
        [
          0,
          o.radius,
          o.height,
          o.order,
          0,
          0,
          1,
          t.length,
          t.rim[0],
          t.rim[1],
          t.flare,
          t.waves ?? 0,
        ].concat([0, 0, 0, t.ruffle ?? 0, 0.3, KIND.tube, (i * 0.618) % 1, 0]),
        i * ORGAN_FLOATS,
      );
      return;
    }
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
        o.radiusClosed ?? 0,
      ],
      i * ORGAN_FLOATS,
    );
  });
  return data;
};

/** How far the open flower reaches from its axis, m. */
const reach = (organs: readonly Organ[]) =>
  Math.max(
    ...organs.map((o) =>
      o.tube
        ? o.tube.rim[1]
        : o.radius + o.shape.length * o.scale * Math.sin(Math.min(o.open, Math.PI / 2)),
    ),
  );

/** How high the open flower stands above its receptacle, m. */
const top = (organs: readonly Organ[]) =>
  Math.max(
    ...organs.map((o) =>
      o.tube
        ? o.height + o.tube.length
        : o.height + o.shape.length * o.scale * Math.max(Math.cos(o.open), 0),
    ),
  );

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    flower: { type: 'select', default: 'poppy', options: Object.keys(FLOWERS) },
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
    poppy: {},
    lily: { flower: 'lily' },
    buttercup: { flower: 'buttercup' },
    'cherry blossom': { flower: 'cherry' },
    rose: { flower: 'rose' },
    camellia: { flower: 'camellia' },
    'frilled poppy': { flower: 'poppy', ruffle: 2.5 },
    hibiscus: { flower: 'hibiscus' },
    'morning glory': { flower: 'morning glory' },
    daffodil: { flower: 'daffodil' },
    'on scroll': { follow: 'scroll' },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'flower-opening' });
    const uniforms = createUniformBuffer(device, Params, 'flower-opening params');
    const module = createShader(device, withChunks(shader, { 'params.wgsl': Params.wgsl }));
    const bindLayout = device.createBindGroupLayout({
      label: 'flower-opening organs',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindLayout] });
    // One pipeline a level of detail (story 11.1): the grid's size is an override constant.
    const pipelines = GRIDS.map((lod) =>
      device.createRenderPipeline({
        label: `flower-opening organs ${lod.nu}x${lod.nv}`,
        layout,
        vertex: { module, entryPoint: 'organ_vs', constants: { NU: lod.nu, NV: lod.nv } },
        fragment: { module, entryPoint: 'organ_fs', targets: [{ format: tail.scene.format }] },
        primitive: { topology: 'triangle-list' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
        multisample: { count: 4 },
      }),
    );
    const scroll = trackScroll(canvas);
    let organs: Organ[] = [];
    /** Per level of detail: its first organ and how many. */
    let ranges: [number, number][] = [];
    let organBuffer: GPUBuffer | undefined;
    let group: GPUBindGroup | undefined;
    let built = '';
    const reaches = new Map<FlowerName, [number, number]>();
    let sway: StemSway | undefined;
    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;

    // The organs, sorted by level of detail for the flower's size on screen: `perMetre` px.
    const swayUniform = (
      wind: number,
      heading: number,
      dt: number,
    ): [number, number, number, number] => {
      if (!sway) return [0, 0, 0, 0];
      if (dt > 0) sway.step(dt, wind * Math.cos(heading), wind * Math.sin(heading));
      const tip = Math.hypot(sway.x, sway.z);
      const length = sway.stem.length;
      return [sway.x, sway.z, headTilt(sway.stem, tip), (0.6 * tip * tip) / length];
    };

    const build = (name: FlowerName, perMetre: number) => {
      const lod = (o: Organ) =>
        o.organ === 'tube' || o.organ === 'receptacle'
          ? ringLod((o.tube?.rim[1] ?? o.shape.length) * perMetre)
          : petalLod({ ...o.shape, curl: o.curl }, o.shape.length * o.scale * perMetre);
      const levels = new Map<Organ, number>();
      for (const o of arrange(FLOWERS[name])) levels.set(o, lod(o));
      // The stem, ten sides round.
      const stem = STEMS[name];
      levels.set(
        {
          organ: 'stem',
          azimuth: 0,
          radius: stem.radius,
          height: 0,
          closed: 0,
          open: 0,
          scale: 1,
          shape: { ...FLAT_PETAL, length: stem.length },
          order: 0,
          curl: 0,
        },
        2,
      );
      organs = [...levels.keys()].sort((a, b) => levels.get(a)! - levels.get(b)!);
      ranges = GRIDS.map((_, k) => {
        const first = organs.findIndex((o) => levels.get(o) === k);
        return [first, first < 0 ? 0 : organs.filter((o) => levels.get(o) === k).length];
      });
      organBuffer?.destroy();
      organBuffer = device.createBuffer({
        label: 'flower-opening organs',
        size: organs.length * ORGAN_FLOATS * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });
      device.queue.writeBuffer(organBuffer, 0, pack(organs));
      group = device.createBindGroup({
        layout: bindLayout,
        entries: [
          { binding: 0, resource: { buffer: uniforms.buffer } },
          { binding: 1, resource: { buffer: organBuffer } },
        ],
      });
      const all = arrange(FLOWERS[name]);
      sway = new StemSway({
        ...stem,
        modulus: 1e9,
        density: 1000,
        headArea: Math.PI * reach(all) ** 2,
      });
      built = `${name},${Math.round(perMetre)}`;
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
        const name = (params.flower in FLOWERS ? params.flower : 'poppy') as FlowerName;
        // Its open reach fills about two thirds of the shorter side: so many px a metre.
        if (!reaches.has(name)) {
          const all = arrange(FLOWERS[name]);
          reaches.set(name, [reach(all), top(all)]);
        }
        const [size, tall] = reaches.get(name)!;
        // A breeze in gusts, veering slowly, pushing the head on its stem. Held, the stem keeps
        // where it was.
        // Light air: sway grows as the wind's square, and a swaying rosette is a moving pattern,
        // held to 0.25 of the central field rather than 0.4.
        const breeze = dosed(dose, 0, 0.18, 0.3);
        const gust =
          1 +
          0.5 * Math.sin(0.7 * clock) +
          0.3 * Math.sin(1.9 * clock + 1) +
          0.2 * Math.sin(3.7 * clock + 2);
        const heading = 0.3 + 0.4 * Math.sin(0.05 * clock);
        const wind = breeze * Math.max(gust, 0);
        const perMetre = (Math.min(width, height) * (LOOKS[name].fill ?? 1)) / (3 * size);
        if (`${name},${Math.round(perMetre)}` !== built) build(name, perMetre);
        let progress: number;
        if (params.follow === 'scroll') {
          progress = scroll.update(dt).progress;
        } else {
          // Held, the clock stands still: the held frame is the moment it was held at.
          // Opens, holds, closes, rests; the first frame is part way open.
          const pace = LOOKS[name].pace ?? 1;
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
        const distance = (size * 1.5 * fit) / Math.tan(fovY / 2) / (LOOKS[name].fill ?? 1);
        const centre: Vec3 = [0, size * 0.1, 0];
        // Aimed a little up a tall flower (a funnel, a trumpet), at its receptacle otherwise.
        const aim = centre[1] + 0.5 * tall * Math.min(1, tall / size);
        const eye: Vec3 = [0, aim + distance * Math.sin(PITCH), -distance * Math.cos(PITCH)];
        const camera = pitchedCamera({
          aspect,
          eye,
          pitch: PITCH,
          fovY,
          near: distance * 0.05,
          far: distance * 4,
        });
        const look = LOOKS[name];
        const petal = petalColours(look.petal);
        const base = petalColours(look.base);
        const bud = petalColours(look.bud ?? look.petal);
        const tubeBase = petalColours(look.tube?.base ?? look.base);
        const tubeRim = petalColours(look.tube?.rim ?? look.petal);
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
          sway: swayUniform(wind, heading, dt),
          stem: [STEMS[name].length, STEMS[name].radius, 0, 0],
          ambient: 0.9,
          translucency: 0.5,
          gloss: look.gloss,
          throat: look.throat,
          throat_edge: look.edge ?? look.throat,
          velvet: look.petal.velvet ?? 0,
          base_velvet: look.base.velvet ?? 0,
          grating: look.grating ?? [0, 0],
          petal: [...petal.reflect, petal.uv],
          petal_through: [...petal.transmit, 1],
          base: [...base.reflect, base.uv],
          base_through: [...base.transmit, 1],
          sepal: [...SEPAL.reflect, 1],
          sepal_through: [...SEPAL.transmit, 1],
          petal_bud: [...bud.reflect, bud.uv],
          petal_bud_through: [...bud.transmit, 1],
          tube_base: [...tubeBase.reflect, tubeBase.uv],
          tube_base_through: [...tubeBase.transmit, 1],
          tube_rim: [...tubeRim.reflect, tubeRim.uv],
          tube_rim_through: [...tubeRim.transmit, 1],
          filament: [...look.filament, 1],
          anther: [...look.anther, 1],
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
        pass.setBindGroup(0, group!);
        ranges.forEach(([first, count], k) => {
          if (count === 0) return;
          const lod = GRIDS[k]!;
          pass.setPipeline(pipelines[k]!);
          pass.draw((lod.nu - 1) * (lod.nv - 1) * 6, count, 0, first);
        });
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => ({
        organs: organs.length,
        vertices: ranges.reduce(
          (n, [, count], k) => n + count * (GRIDS[k]!.nu - 1) * (GRIDS[k]!.nv - 1) * 6,
          0,
        ),
      }),
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
