import { createShader, withChunks } from '../shader.ts';
import { createUniformBuffer, defineUniformStruct } from '../uniforms.ts';
import { petalColours } from '../optics/petal.ts';
import { arrange, GOLDEN_ANGLE, openReach, type FloralDiagram, type Organ } from './diagram.ts';
import { SEPAL, type FlowerLook, type StemSize } from './looks.ts';
import { budStretch } from './opening.ts';
import { FLAT_PETAL, GRIDS, petalLod, ringLod, type PetalShape } from './petal.ts';
import shader from './flower.wgsl';

/*
 * Story 12.1's flower, as a renderer the blooms share: any number of heads of any of a few species,
 * each from its floral diagram (story 11.2), opening, turned, nodding and swaying on its stem. The
 * species' organs go to the GPU once; each frame only the heads (where they are, how open) and the
 * view change. An organ of a head is an instance, drawn with the coarsest grid that stays within a
 * pixel at that head's size on screen (story 11.1): heads are drawn in groups, each with its own
 * scale in pixels a metre, so a field's near flowers get fine grids and its far ones coarse.
 *
 * It can also draw the heads a grass field placed (story 12.3): the field sets its nearest flower
 * heads aside in a list of their own, already swayed and trampled with their stems, and these are
 * drawn whole from it with indirect draws, their count never leaving the GPU (`FieldHeads`).
 *
 * `prepare` once a frame (and `computeField` after the field's compute, for its heads), then `draw`
 * into a pass with a multisampled colour target in the scene format (and, with `distance`, the grass
 * strip's distance target) and a depth24plus depth target.
 */

type Vec3 = readonly [number, number, number];
type Vec4 = readonly [number, number, number, number];

export interface FlowerSpecies {
  diagram: FloralDiagram;
  stem: StemSize;
  /** Leaves up the stem (story 12.4). */
  leaves?: StemLeaves;
}

/**
 * Leaves up a stem: `count` of `shape`, the golden angle apart round it, from `from` to `to` of the
 * way up, leaning `tilt` out from it and shrinking to `top` of their size at the highest.
 */
export interface StemLeaves {
  count: number;
  from: number;
  to: number;
  tilt: number;
  top: number;
  shape: PetalShape;
}

export interface FlowerHead {
  /** The receptacle, m. */
  position: Vec3;
  /** Its opening, 0 (bud) to 1. */
  progress: number;
  /** Turn about its axis, rad. */
  yaw?: number;
  scale?: number;
  /** The stem's tip (story 11.5): displacement (x, z), the head's tilt and the tip's drop. */
  sway?: Vec4;
  /** The head turned about a horizontal axis (x, z) through its receptacle, by an angle, rad. */
  nod?: Vec3;
  /** Index into the looks. */
  look?: number;
  /** Draw its stem (the default). */
  stem?: boolean;
  /**
   * A pedicel, not a stem standing up from the ground: it runs back along the head's axis, as it
   * is nodded, to the twig it grows from (story 12.7).
   */
  pedicel?: boolean;
  /** How many of its petals have fallen, 0 to 1 (story 12.7). */
  shed?: number;
}

export interface FlowerGroup {
  species: number;
  heads: readonly FlowerHead[];
  /** How many pixels a metre is at these heads, for their levels of detail. */
  perMetre: number;
}

/** A grass field's near flower heads (src/gpu/grass/field.ts, `nearList`), to draw whole. */
export interface FieldHeads {
  blades: GPUBuffer;
  args: GPUBuffer;
  /**
   * Its near bands, nearest first: pixels a metre at each band's nearest heads, for their levels of
   * detail, and its list for each of the field's wildflowers, where it starts in the blades and
   * where it is counted in the arguments, in u32s.
   */
  bands: readonly { perMetre: number; lists: readonly { first: number; count: number }[] }[];
  /** The renderer's species for each of the field's wildflowers; looks 0 to 3 are theirs. */
  species: readonly number[];
}

export interface FlowerView {
  viewProj: ArrayLike<number>;
  eye: Vec3;
  time: number;
  /** Towards the light, and its strength. */
  sun: Vec4;
  sunColour?: Vec3;
  skyTop?: Vec3;
  skyBottom?: Vec3;
  ambient?: number;
  translucency?: number;
  /** The petals' edge growth (story 11.1's ruffles), 1 as grown. */
  ruffle?: number;
  /** How much of a head's opening its organs' order spreads over. */
  stagger?: number;
  flutter?: number;
  /** The air's colour and its density, per metre. */
  haze?: Vec4;
}

const Params = defineUniformStruct('Params', {
  view_proj: 'mat4x4f',
  eye: 'vec3f',
  time: 'f32',
  sun: 'vec4f',
  sun_colour: 'vec4f',
  sky_top: 'vec4f',
  sky_bottom: 'vec4f',
  haze: 'vec4f',
  ruffle: 'f32',
  stagger: 'f32',
  flutter: 'f32',
  ambient: 'f32',
  translucency: 'f32',
});

const KIND = {
  sepal: 0,
  petal: 1,
  stamen: 2,
  carpel: 3,
  receptacle: 4,
  tube: 5,
  stem: 6,
  leaf: 7,
} as const;
const ORGAN_FLOATS = 24;
const HEAD_FLOATS = 20;
const LOOK_FLOATS = 18 * 4;
const DRAW_STRIDE = 256;
const DRAW_BYTES = 16;

/** Most near lists (bands times species) a field may give. */
const FIELD_LISTS = 8;
const FIELD_DRAWS = FIELD_LISTS * 6;
// The field's heads: each list's indirect arguments at each level of detail, from its count.
const ARGS_SHADER = /* wgsl */ `
struct Lods {
  /** Per list and level of detail: its vertex count, organs a head, where its list is counted. */
  lod: array<vec4u, ${FIELD_DRAWS}>,
}
@group(0) @binding(0) var<uniform> lods: Lods;
@group(0) @binding(1) var<storage, read> source: array<u32>;
@group(0) @binding(2) var<storage, read_write> out: array<u32>;
@compute @workgroup_size(1) fn main() {
  for (var k = 0u; k < ${FIELD_DRAWS}u; k++) {
    let heads = source[lods.lod[k].z];
    out[k * 4u] = lods.lod[k].x;
    out[k * 4u + 1u] = heads * lods.lod[k].y;
    out[k * 4u + 2u] = 0u;
    out[k * 4u + 3u] = 0u;
  }
}`;
/** A petal's curl in the bud, unless its bud is nested (story 12.2). */
export const BUD_CURL = 1.6;

const wraps = (o: Readonly<Organ>) => o.organ === 'petal' || o.organ === 'sepal';

function packOrgans(organs: readonly Organ[]): Float32Array {
  const data = new Float32Array(organs.length * ORGAN_FLOATS);
  organs.forEach((o, i) => {
    const s = o.shape;
    const t = o.tube;
    const seed = (i * 0.618) % 1;
    if (t) {
      // A tube: its rim in the bud and open, its flare and waves; its twist and folds in the bud in
      // b.x and b.y, its rim's ruffle in b.w.
      data.set(
        [0, o.radius, o.height, o.order, 0, 0, 1, t.length, t.rim[0], t.rim[1], t.flare]
          .concat([t.waves ?? 0, t.twist ?? 0, t.folds ?? 0, 0, t.ruffle ?? 0, 0.3, KIND.tube])
          .concat([seed, 0])
          .concat([0, 0, 1, 0]),
        i * ORGAN_FLOATS,
      );
      return;
    }
    data.set(
      [o.azimuth, o.radius, o.height, o.order, o.closed, o.open, o.scale, s.length]
        .concat([s.width, s.widest, s.tip, s.claw, s.notch, s.cup, o.curl, s.excess])
        .concat([s.fringe, KIND[o.organ], seed, o.radiusClosed ?? 0])
        // Petals and sepals wrap the bud; stamens and carpels keep their own curl.
        .concat([o.budCurl ?? (wraps(o) ? BUD_CURL : o.curl), o.nested ? 1 : 0])
        .concat([o.budScale ?? 0.75, s.roll]),
      i * ORGAN_FLOATS,
    );
  });
  return data;
}

/**
 * A look's colours, from its pigments (story 11.3), as the shader's Look, with its stem and (for a
 * field's heads) its species' open reach.
 */
export function packLook(
  look: Readonly<FlowerLook>,
  stem: Readonly<StemSize>,
  reach = 1,
): Float32Array {
  const petal = petalColours(look.petal);
  const base = petalColours(look.base);
  const bud = petalColours(look.bud ?? look.petal);
  const tubeBase = petalColours(look.tube?.base ?? look.base);
  const tubeRim = petalColours(look.tube?.rim ?? look.petal);
  const sepal = look.sepal ?? SEPAL;
  const grating = look.grating ?? [0, 0];
  return new Float32Array([
    ...[look.gloss, look.throat, look.edge ?? look.throat, look.petal.velvet ?? 0],
    ...[look.base.velvet ?? 0, grating[0], grating[1], look.bands ?? 0],
    ...[...petal.reflect, petal.uv, ...petal.transmit, 1],
    ...[...base.reflect, base.uv, ...base.transmit, 1],
    ...[...sepal.reflect, 1, ...sepal.transmit, 1],
    ...[...bud.reflect, bud.uv, ...bud.transmit, 1],
    ...[...tubeBase.reflect, tubeBase.uv, ...tubeBase.transmit, 1],
    ...[...tubeRim.reflect, tubeRim.uv, ...tubeRim.transmit, 1],
    ...[...look.filament, 1, ...look.anther, 1, ...(look.carpel ?? [0.25, 0.32, 0.08]), 1],
    ...[stem.length, stem.radius, reach, 0],
  ]);
}

/** A species' organs, its stem and its leaves, as one list. A leaf's height is a fraction up the stem. */
function speciesOrgans(species: Readonly<FlowerSpecies>): Organ[] {
  const leaves = species.leaves;
  const leafOrgans: Organ[] = [];
  for (let k = 0; leaves && k < leaves.count; k++) {
    const t = leaves.count > 1 ? k / (leaves.count - 1) : 0;
    leafOrgans.push({
      organ: 'leaf',
      azimuth: k * GOLDEN_ANGLE,
      radius: species.stem.radius,
      height: leaves.from + (leaves.to - leaves.from) * t,
      closed: leaves.tilt,
      open: leaves.tilt,
      scale: 1 + (leaves.top - 1) * t,
      shape: leaves.shape,
      order: 0,
      curl: leaves.shape.curl,
    });
  }
  return [
    ...arrange(species.diagram),
    ...leafOrgans,
    {
      organ: 'stem',
      azimuth: 0,
      radius: species.stem.radius,
      height: 0,
      closed: 0,
      open: 0,
      scale: 1,
      shape: { ...FLAT_PETAL, length: species.stem.length },
      order: 0,
      curl: 0,
    },
  ];
}

/**
 * Below these sizes on screen (the head's open reach, px) a head's small parts are not drawn: its
 * stamens and carpels (a daisy's 130 florets, a poppy's 89 stamens), over which the receptacle shows
 * their colour; and its sepals, under it.
 */
const PARTS_FROM = 24;
const SEPALS_FROM = 10;
/** Nor is any small part under this length on screen, px. */
const MIN_PART = 1.5;

/**
 * An organ's level of detail at `perMetre` px a metre, within `tolerance` px, or -1 when it is not
 * drawn at all on a head reaching `headPx`. Stems are ten sides round.
 */
function organLod(o: Readonly<Organ>, perMetre: number, headPx: number, tolerance: number): number {
  if (o.organ === 'stem') return 2;
  if ((o.organ === 'stamen' || o.organ === 'carpel') && headPx < PARTS_FROM) return -1;
  if (o.organ === 'sepal' && headPx < SEPALS_FROM) return -1;
  // A part under a pixel and a half is not worth its grid: a sunflower's florets at a few metres.
  const small = o.organ === 'stamen' || o.organ === 'carpel' || o.organ === 'sepal';
  if (small && o.shape.length * o.scale * perMetre < MIN_PART) return -1;
  if (o.organ === 'tube' || o.organ === 'receptacle') {
    return ringLod((o.tube?.rim[1] ?? o.shape.length) * perMetre, tolerance);
  }
  return petalLod({ ...o.shape, curl: o.curl }, o.shape.length * o.scale * perMetre, tolerance);
}

export interface FlowerRenderer {
  /**
   * Sets each look's colours, with the stem it stands on and, for a field's heads, its species'
   * open reach (`openReach`), which the field's head size is scaled to.
   */
  setLooks(looks: readonly { look: FlowerLook; stem: StemSize; reach?: number }[]): void;
  /** Writes this frame's view and heads, and the levels of detail for a field's. */
  prepare(
    view: Readonly<FlowerView>,
    groups: readonly FlowerGroup[],
    field?: Readonly<FieldHeads>,
  ): void;
  /** For a field's heads: their draws' arguments, once the field's compute has listed them. */
  computeField(encoder: GPUCommandEncoder): void;
  draw(pass: GPURenderPassEncoder): void;
  /** This frame's organs drawn (an organ of each head counts once), heads and vertices. */
  stats(): { organs: number; heads: number; vertices: number };
  destroy(): void;
}

export function createFlowerRenderer(
  device: GPUDevice,
  options: {
    format: GPUTextureFormat;
    species: readonly FlowerSpecies[];
    label?: string;
    sampleCount?: number;
    depthCompare?: GPUCompareFunction;
    /** A second target, the grass strip's distance (DISTANCE_FORMAT), for its depth of field. */
    distance?: GPUTextureFormat;
    /** How far a grid may miss the surface, px: 1, or more for a field of small heads. */
    tolerance?: number;
  },
): FlowerRenderer {
  const label = options.label ?? 'flowers';
  const uniforms = createUniformBuffer(device, Params, `${label} params`);
  const module = createShader(device, withChunks(shader, { 'params.wgsl': Params.wgsl }));
  const storage = (binding: number, visibility: number): GPUBindGroupLayoutEntry => ({
    binding,
    visibility,
    buffer: { type: 'read-only-storage' },
  });
  const VS = GPUShaderStage.VERTEX;
  const FS = GPUShaderStage.FRAGMENT;
  const bindLayout = device.createBindGroupLayout({
    label,
    entries: [
      { binding: 0, visibility: VS | FS, buffer: { type: 'uniform' } },
      storage(1, VS),
      storage(2, VS),
      storage(3, VS | FS),
      storage(4, VS),
      { binding: 5, visibility: VS, buffer: { type: 'uniform', hasDynamicOffset: true } },
      storage(6, VS),
      storage(7, VS),
    ],
  });
  const layout = device.createPipelineLayout({ bindGroupLayouts: [bindLayout] });
  // One pipeline a level of detail (story 11.1): the grid's size is an override constant.
  const pipelines = GRIDS.map((lod) =>
    device.createRenderPipeline({
      label: `${label} ${lod.nu}x${lod.nv}`,
      layout,
      vertex: { module, entryPoint: 'organ_vs', constants: { NU: lod.nu, NV: lod.nv } },
      fragment: options.distance
        ? {
            module,
            entryPoint: 'organ_distance_fs',
            targets: [{ format: options.format }, { format: options.distance }],
          }
        : { module, entryPoint: 'organ_fs', targets: [{ format: options.format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: options.depthCompare ?? 'less',
      },
      multisample: { count: options.sampleCount ?? 4 },
    }),
  );

  // Every species' organs, one after another.
  const species = options.species.map(speciesOrgans);
  const reaches = options.species.map((sp) => openReach(arrange(sp.diagram)));
  const tolerance = options.tolerance ?? 1;
  const firsts: number[] = [];
  let total = 0;
  for (const organs of species) {
    firsts.push(total);
    total += organs.length;
  }
  const organBuffer = device.createBuffer({
    label: `${label} organs`,
    size: Math.max(total, 1) * ORGAN_FLOATS * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  species.forEach((organs, k) =>
    device.queue.writeBuffer(organBuffer, firsts[k]! * ORGAN_FLOATS * 4, packOrgans(organs)),
  );

  // The field's heads: a stand-in until a field is given, and each level's indirect arguments.
  const noField = device.createBuffer({
    label: `${label} no field`,
    size: 48,
    usage: GPUBufferUsage.STORAGE,
  });
  let fieldBlades: GPUBuffer = noField;
  let fieldCounts: GPUBuffer = noField;
  let fieldSource: GPUBuffer | undefined;
  const fieldArgs = device.createBuffer({
    label: `${label} field args`,
    size: FIELD_DRAWS * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT,
  });
  const lodsBuffer = device.createBuffer({
    label: `${label} field lods`,
    size: FIELD_DRAWS * 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const argsPipeline = device.createComputePipeline({
    label: `${label} field args`,
    layout: 'auto',
    compute: { module: device.createShaderModule({ code: ARGS_SHADER }), entryPoint: 'main' },
  });
  let argsGroup: GPUBindGroup | undefined;
  /** This frame's field draws: the level of detail, its arguments, and the draw record's index. */
  let fieldDraws: { lod: number; args: number; record: number }[] = [];

  let headBuffer: GPUBuffer | undefined;
  let lookBuffer: GPUBuffer | undefined;
  let orderBuffer: GPUBuffer | undefined;
  let drawBuffer: GPUBuffer | undefined;
  let group: GPUBindGroup | undefined;
  let headCapacity = 0;
  let orderCapacity = 0;
  let drawCapacity = 0;
  let stale = true;
  /** This frame's draws: pipeline, vertices, instances. */
  let draws: { lod: number; instances: number }[] = [];
  let heads = 0;
  // Per species and scale: the organs (global indices) sorted by level of detail, and how many at
  // each.
  const sorted = new Map<string, { order: number[]; counts: number[] }>();
  const sortedFor = (s: number, perMetre: number) => {
    const key = `${s},${Math.round(perMetre)}`;
    let hit = sorted.get(key);
    if (!hit) {
      const headPx = reaches[s]! * perMetre;
      const levels = species[s]!.map((o) => organLod(o, perMetre, headPx, tolerance));
      const order = levels
        .map((_, i) => i)
        .filter((i) => levels[i]! >= 0)
        .sort((a, b) => levels[a]! - levels[b]!);
      const counts = GRIDS.map((_, k) => levels.filter((l) => l === k).length);
      hit = { order: order.map((i) => firsts[s]! + i), counts };
      if (sorted.size > 256) sorted.clear();
      sorted.set(key, hit);
    }
    return hit;
  };

  const grow = (buffer: GPUBuffer | undefined, size: number, name: string, usage: number) => {
    buffer?.destroy();
    stale = true;
    return device.createBuffer({ label: `${label} ${name}`, size, usage });
  };
  const STORAGE = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;

  return {
    setLooks(looks) {
      const data = new Float32Array(Math.max(looks.length, 1) * LOOK_FLOATS);
      looks.forEach(({ look, stem, reach }, i) =>
        data.set(packLook(look, stem, reach), i * LOOK_FLOATS),
      );
      if (!lookBuffer || lookBuffer.size < data.byteLength) {
        lookBuffer = grow(lookBuffer, data.byteLength, 'looks', STORAGE);
      }
      device.queue.writeBuffer(lookBuffer, 0, data);
    },

    prepare(view, groups, field) {
      uniforms.set({
        view_proj: view.viewProj,
        eye: view.eye,
        time: view.time,
        sun: view.sun,
        sun_colour: [...(view.sunColour ?? [1, 1, 1]), 1],
        sky_top: [...(view.skyTop ?? [0.6, 0.6, 0.6]), 1],
        sky_bottom: [...(view.skyBottom ?? [0.25, 0.25, 0.25]), 1],
        haze: view.haze ?? [0, 0, 0, 0],
        ruffle: view.ruffle ?? 1,
        stagger: view.stagger ?? 0.45,
        flutter: view.flutter ?? 0,
        ambient: view.ambient ?? 0.9,
        translucency: view.translucency ?? 0.5,
      });
      uniforms.upload();

      heads = groups.reduce((n, g) => n + g.heads.length, 0);
      const headData = new Float32Array(Math.max(heads, 1) * HEAD_FLOATS);
      const order: number[] = [];
      const drawData: number[][] = [];
      draws = [];
      let h = 0;
      for (const g of groups) {
        if (g.heads.length === 0) continue;
        const diagram = options.species[g.species]!.diagram;
        let scale = 0;
        for (const head of g.heads) {
          const sway = head.sway ?? [0, 0, 0, 0];
          const nod = head.nod ?? [1, 0, 0];
          headData.set(
            [...head.position, head.yaw ?? 0]
              .concat([head.progress, head.scale ?? 1, budStretch(diagram.bud, head.progress)])
              .concat([
                head.look ?? 0,
                ...sway,
                nod[0],
                nod[1],
                nod[2],
                head.stem === false ? 0 : 1,
              ])
              .concat([head.shed ?? 0, head.pedicel ? 1 : 0, 0, 0]),
            h * HEAD_FLOATS,
          );
          scale = Math.max(scale, head.scale ?? 1);
          h++;
        }
        const first = h - g.heads.length;
        const { order: organs, counts } = sortedFor(g.species, g.perMetre * scale);
        let at = order.length;
        order.push(...organs);
        counts.forEach((count, lod) => {
          if (count > 0) {
            drawData.push([at, first, g.heads.length]);
            draws.push({ lod, instances: count * g.heads.length });
          }
          at += count;
        });
      }
      if (headCapacity < headData.byteLength) {
        headCapacity = headData.byteLength * 2;
        headBuffer = grow(headBuffer, headCapacity, 'heads', STORAGE);
      }
      device.queue.writeBuffer(headBuffer!, 0, headData);
      // A field's heads: each list's organs at each level of detail, drawn for as many heads as
      // the field counted in it, which only the GPU knows.
      fieldDraws = [];
      if (field) {
        const lods = new Uint32Array(FIELD_DRAWS * 4);
        let list = 0;
        for (const band of field.bands) {
          band.lists.forEach((at, s) => {
            if (list >= FIELD_LISTS) return;
            const { order: organs, counts } = sortedFor(field.species[s]!, band.perMetre);
            let first = order.length;
            order.push(...organs);
            GRIDS.forEach((grid, lod) => {
              const k = list * GRIDS.length + lod;
              lods.set([(grid.nu - 1) * (grid.nv - 1) * 6, counts[lod]!, at.count], k * 4);
              if (counts[lod]! > 0) {
                fieldDraws.push({ lod, args: k * 16, record: drawData.length });
                drawData.push([first, at.first, at.count, 1]);
              }
              first += counts[lod]!;
            });
            list++;
          });
        }
        device.queue.writeBuffer(lodsBuffer, 0, lods);
        if (field.blades !== fieldBlades || field.args !== fieldCounts) {
          fieldBlades = field.blades;
          fieldCounts = field.args;
          stale = true;
        }
        if (field.args !== fieldSource) {
          fieldSource = field.args;
          argsGroup = device.createBindGroup({
            label: `${label} field args`,
            layout: argsPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: lodsBuffer } },
              { binding: 1, resource: { buffer: field.args } },
              { binding: 2, resource: { buffer: fieldArgs } },
            ],
          });
        }
      }
      const orderData = new Uint32Array(Math.max(order.length, 1));
      orderData.set(order);
      if (orderCapacity < orderData.byteLength) {
        orderCapacity = orderData.byteLength * 2;
        orderBuffer = grow(orderBuffer, orderCapacity, 'order', STORAGE);
      }
      device.queue.writeBuffer(orderBuffer!, 0, orderData);
      const size = Math.max(drawData.length, 1) * DRAW_STRIDE;
      if (drawCapacity < size) {
        drawCapacity = size * 2;
        drawBuffer = grow(
          drawBuffer,
          drawCapacity,
          'draws',
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        );
      }
      const packed = new Uint32Array(size / 4);
      drawData.forEach((d, i) => packed.set(d, (i * DRAW_STRIDE) / 4));
      device.queue.writeBuffer(drawBuffer!, 0, packed);
      if (stale && lookBuffer) {
        group = device.createBindGroup({
          label,
          layout: bindLayout,
          entries: [
            { binding: 0, resource: { buffer: uniforms.buffer } },
            { binding: 1, resource: { buffer: organBuffer } },
            { binding: 2, resource: { buffer: headBuffer! } },
            { binding: 3, resource: { buffer: lookBuffer } },
            { binding: 4, resource: { buffer: orderBuffer! } },
            { binding: 5, resource: { buffer: drawBuffer!, size: DRAW_BYTES } },
            { binding: 6, resource: { buffer: fieldBlades } },
            { binding: 7, resource: { buffer: fieldCounts } },
          ],
        });
        stale = false;
      }
    },

    computeField(encoder) {
      if (fieldDraws.length === 0 || !argsGroup) return;
      const pass = encoder.beginComputePass({ label: `${label} field args` });
      pass.setPipeline(argsPipeline);
      pass.setBindGroup(0, argsGroup);
      pass.dispatchWorkgroups(1);
      pass.end();
    },

    draw(pass) {
      if (!group) return;
      draws.forEach((d, i) => {
        const lod = GRIDS[d.lod]!;
        pass.setPipeline(pipelines[d.lod]!);
        pass.setBindGroup(0, group!, [i * DRAW_STRIDE]);
        pass.draw((lod.nu - 1) * (lod.nv - 1) * 6, d.instances);
      });
      for (const d of fieldDraws) {
        pass.setPipeline(pipelines[d.lod]!);
        pass.setBindGroup(0, group, [d.record * DRAW_STRIDE]);
        pass.drawIndirect(fieldArgs, d.args);
      }
    },

    stats: () => ({
      organs: draws.reduce((n, d) => n + d.instances, 0),
      heads,
      vertices: draws.reduce(
        (n, d) => n + d.instances * (GRIDS[d.lod]!.nu - 1) * (GRIDS[d.lod]!.nv - 1) * 6,
        0,
      ),
    }),

    destroy() {
      organBuffer.destroy();
      headBuffer?.destroy();
      lookBuffer?.destroy();
      orderBuffer?.destroy();
      drawBuffer?.destroy();
      noField.destroy();
      fieldArgs.destroy();
      lodsBuffer.destroy();
      uniforms.destroy();
    },
  };
}
