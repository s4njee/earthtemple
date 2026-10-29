import { leafColours } from '../optics/leaf.ts';
import { createShader, withChunks } from '../shader.ts';
import { createUniformBuffer, defineUniformStruct, uniformArray } from '../uniforms.ts';
import { FLOWER_MIX, HEAD_AREA, wildflowerLook } from './wildflowers.ts';

const WILDFLOWER_LOOK = wildflowerLook();

/**
 * The lists: three of blades and one of flower heads drawn as dots, `capacity` each; then, with
 * `nearHeads`, story 12.3's near flower heads in two bands by distance, a list for each wildflower in
 * each, `NEAR_CAPACITY` each, after them (`nearList`). Each list has its draw arguments, the near
 * ones only counting.
 */
const LISTS = 4;
const NEAR_BANDS = 2;
const NEAR_SPECIES = 4;
const NEAR_LISTS = NEAR_BANDS * NEAR_SPECIES;
export const NEAR_CAPACITY = 2048;

/**
 * Where near band `band`'s heads of wildflower `species` start in the blades, in blades, and where
 * the list is counted in the arguments, in u32s.
 */
export function nearList(
  capacity: number,
  band: number,
  species: number,
): { first: number; count: number } {
  const list = band * NEAR_SPECIES + species;
  return { first: LISTS * capacity + list * NEAR_CAPACITY, count: (LISTS + list) * 4 + 1 };
}
import type { TrampleView } from '../wind/trample.ts';
import { BLADE_BYTES, cellSize, LOD_LEVELS, type Species } from './blade.ts';
import type { GroundCamera } from './camera.ts';
import drawShader from './draw.wgsl';
import fieldShader from './field.wgsl';
import groundShader from './ground.wgsl';
import shellShader from './shells.wgsl';

// Stories 2.2 to 2.8: the grass field. Each frame a compute pass grows the blades the camera can
// see from a world-anchored grid (field.wgsl), appends the survivors to one list per LOD and flower
// heads to a fourth, and counts them into indirect draw arguments; then the ground and four
// indirect draws pull them from the lists (ground.wgsl, draw.wgsl). No blade is stored from one
// frame to the next; what something pressed down is kept per area, in the trample field.

/** The recipe's parts, each switchable for story 2.9's ablation. Twin of grass-flags.wgsl. */
export const FLAGS = {
  clumps: 1,
  variation: 2,
  dry: 4,
  translucency: 8,
  sheen: 16,
  rounded: 32,
  canopy: 64,
  gusts: 128,
  clouds: 256,
  fog: 512,
} as const;
export type Part = keyof typeof FLAGS;
export const ALL_PARTS = Object.values(FLAGS).reduce((a, b) => a | b, 0);

/** The flags with `off` removed. */
export const without = (...off: readonly Part[]) =>
  off.reduce((flags, part) => flags & ~FLAGS[part], ALL_PARTS);

export const Field = defineUniformStruct('Field', {
  view_proj: 'mat4x4f',
  eye: 'vec3f',
  cell: 'f32',
  origin: 'vec2i',
  count: 'vec2u',
  scale: 'vec2f',
  right: 'vec2f',
  wind_dir: 'vec2f',
  trample_origin: 'vec2i',
  /** Pointer in NDC (x, y), its reach across the view, and how hard it pushes. */
  pointer: 'vec4f',
  /** The patch of ground the field covers (x0, z0, x1, z1). */
  ground: 'vec4f',
  focal: 'f32',
  aspect: 'f32',
  density: 'f32',
  fade: 'f32',
  reach: 'f32',
  clump: 'f32',
  height_min: 'f32',
  height_max: 'f32',
  width: 'f32',
  lean: 'f32',
  freq: 'f32',
  dry: 'f32',
  stems: 'f32',
  stem_height: 'f32',
  flowers: 'f32',
  /** Story 11.6: each wildflower's claim on the meadow, and the ground their heads cover at a drift's heart. */
  flower_mix: 'vec4f',
  flower_cover: 'f32',
  /** Story 12.3: heads nearer than these go to the two near lists, for a flower renderer to draw. */
  flower_near: 'vec2f',
  near_capacity: 'u32',
  lod0: 'f32',
  lod1: 'f32',
  lod_blend: 'f32',
  min_pixels: 'f32',
  capacity: 'u32',
  seed: 'u32',
  flags: 'u32',
  trample_cell: 'f32',
  trample_size: 'u32',
  growth: 'f32',
  growth_cell: 'f32',
  growth_speed: 'f32',
  growth_spread: 'f32',
  wind_lean: 'f32',
  wind_gust: 'f32',
  gust_speed: 'f32',
  gust_scale: 'f32',
  flutter: 'f32',
  time: 'f32',
});

export const Look = defineUniformStruct('Look', {
  root_lush: 'vec3f',
  taper: 'f32',
  root_pale: 'vec3f',
  round: 'f32',
  tip_lush: 'vec3f',
  twist: 'f32',
  tip_pale: 'vec3f',
  min_width: 'f32',
  dead: 'vec3f',
  transmit: 'f32',
  head: 'vec3f',
  sheen: 'f32',
  t_root: 'vec3f',
  lai: 'f32',
  t_tip: 'vec3f',
  canopy_height: 'f32',
  t_dead: 'vec3f',
  cloud_depth: 'f32',
  sun_dir: 'vec3f',
  cloud_scale: 'f32',
  sun: 'vec3f',
  cloud_speed: 'f32',
  sky: 'vec3f',
  fog: 'f32',
  horizon: 'vec3f',
  ground_mode: 'f32',
  soil: 'vec3f',
  viewport: 'vec2f',
  /** Story 11.6: each wildflower's petal colour (and its petal count in w) and centre colour. */
  flower_petal: uniformArray('vec4f', 4),
  flower_centre: uniformArray('vec4f', 4),
});

export interface GrassSettings {
  species: Species;
  /** 0..1 of the species' density. */
  density: number;
  /** Scales the species' heights. */
  heightScale: number;
  /** Clump size, m. */
  clump: number;
  /** Distance bands: full detail to lod0, then lod1, then the lowest. */
  lod0: number;
  lod1: number;
  /** How far each band's edge is dithered, as a fraction of the distance. Default 0.3. */
  lodBlend?: number;
  /** Where blades start to thin out, m: kept as (fade / d)^2 beyond it. */
  fade: number;
  /** How far blades reach, m; beyond, only the ground. Default the camera's far plane. */
  reach?: number;
  wind: {
    dir: readonly [number, number];
    lean: number;
    gust: number;
    speed: number;
    scale: number;
    flutter: number;
  };
  /** Pointer in NDC, reach (NDC across), strength (tip offset in heights); strength 0 for none. */
  pointer: readonly [number, number, number, number];
  /** What has been pressed down, and is springing back (story 2.5). */
  trample?: TrampleView;
  seed: number;
  /** Smallest apparent width a blade is kept at, px; it is thickened to a pixel to draw. */
  minPixels: number;
  /** The parts of the recipe in use (FLAGS). Default all. */
  flags?: number;
  /** Scales the species' share of flowering stems that carry a flower. Default 1. */
  flowers?: number;
  /**
   * Story 12.3: flower heads nearer than the first distance, m, go to the first near list
   * (`nearList`), and nearer than the second to the second, instead of being drawn as dots, for
   * real heads to be drawn there (src/gpu/flower/render.ts). Needs `nearHeads`. Default none.
   */
  flowerNear?: readonly [number, number];
  /** Draw shells beyond the blades' full detail (story 2.8). Default off. */
  shells?: boolean;
  /**
   * Growth (story 3.7): blades grow in where a front spreading from seeded patches has passed.
   * `progress` in the units of `spread`; patches `cell` m apart start up to `spread` apart and
   * spread at `speed` m per unit. Leave out for grown grass.
   */
  growth?: { progress: number; cell: number; speed: number; spread: number };
}

export interface Lighting {
  sunDir: readonly [number, number, number];
  sun: readonly [number, number, number];
  /** Sky light from above. */
  sky: readonly [number, number, number];
  /** The horizon's colour: aerial perspective tends to it. */
  horizon?: readonly [number, number, number];
  /** Light through the blades, 0..1 of the leaf's own transmittance. */
  transmit: number;
  sheen: number;
  /** How much a cloud's shadow takes from the sun, 0..1; its size, m; its speed, m/s. */
  cloudDepth?: number;
  cloudScale?: number;
  cloudSpeed?: number;
  /** Aerial perspective's distance, m; 0 for none. */
  fog?: number;
  soil?: readonly [number, number, number];
  /** 0: soil that fades out (over a page). 1: soil, then the canopy to the horizon. */
  groundMode?: number;
}

export interface GrassField {
  /** The blade lists, LOD after LOD, then flower heads, `capacity` each, then the near heads. */
  readonly blades: GPUBuffer;
  /**
   * Twelve `drawIndirect` argument sets (vertex count, instance count, first vertex, first
   * instance), the last eight only counting the near heads.
   */
  readonly args: GPUBuffer;
  readonly capacity: number;
  /** Cells the last `update` dispatches over. */
  readonly cells: number;
  update(camera: GroundCamera, settings: GrassSettings, time: number, size: Size): void;
  light(lighting: Lighting): void;
  compute(encoder: GPUCommandEncoder, timestampWrites?: GPUComputePassTimestampWrites): void;
  /** The ground, then the blades and flowers (`ground` false to leave the ground out). */
  draw(pass: GPURenderPassEncoder, ground?: boolean): void;
  /** Blades drawn per LOD and flowers, read back a few frames late. */
  counts(): readonly [number, number, number, number];
  destroy(): void;
}

export interface Size {
  width: number;
  height: number;
}

export interface GrassFieldOptions {
  /** Blades per list. */
  capacity: number;
  /** Render target format and sample count. */
  format: GPUTextureFormat;
  sampleCount?: number;
  depthFormat?: GPUTextureFormat;
  /** Also write each pixel's distance to a second `r16float` target, for depth of field. */
  distance?: boolean;
  /** Most cells one frame may dispatch over; the cell grows to fit (fewer, wider-spaced blades). */
  maxCells?: number;
  /** Room for story 12.3's near flower heads (`flowerNear`). */
  nearHeads?: boolean;
  label?: string;
}

export const DISTANCE_FORMAT: GPUTextureFormat = 'r16float';

export function createGrassField(device: GPUDevice, options: GrassFieldOptions): GrassField {
  const label = options.label ?? 'grass';
  const capacity = options.capacity;
  const nearHeads = options.nearHeads ?? false;
  const maxCells = options.maxCells ?? 1 << 21;
  const samples = options.sampleCount ?? 4;
  const field = createUniformBuffer(device, Field, `${label} field`);
  const look = createUniformBuffer(device, Look, `${label} look`);
  const chunks = { 'field-params.wgsl': Field.wgsl, 'look-params.wgsl': Look.wgsl };
  const computeModule = createShader(device, withChunks(fieldShader, chunks));
  const drawModule = createShader(device, withChunks(drawShader, chunks));
  const groundModule = createShader(device, withChunks(groundShader, chunks));
  const shellModule = createShader(device, withChunks(shellShader, chunks));

  const blades = device.createBuffer({
    label: `${label} blades`,
    size: (LISTS * capacity + (nearHeads ? NEAR_LISTS * NEAR_CAPACITY : 0)) * BLADE_BYTES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });
  const args = device.createBuffer({
    label: `${label} draw args`,
    size: (LISTS + NEAR_LISTS) * 16,
    usage:
      GPUBufferUsage.STORAGE |
      GPUBufferUsage.INDIRECT |
      GPUBufferUsage.COPY_DST |
      GPUBufferUsage.COPY_SRC,
  });
  // A field nothing has trampled reads this one cell.
  const untrampled = device.createBuffer({
    label: `${label} no trample`,
    size: 16,
    usage: GPUBufferUsage.STORAGE,
  });

  const computeLayout = device.createBindGroupLayout({
    label: `${label} compute layout`,
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    ],
  });
  const computePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [computeLayout] });
  const pipeline = (entryPoint: string) =>
    device.createComputePipeline({
      label: `${label} ${entryPoint}`,
      layout: computePipelineLayout,
      compute: { module: computeModule, entryPoint },
    });
  const reset = pipeline('reset');
  const place = pipeline('place');
  const finish = pipeline('finish');
  let computeGroup: GPUBindGroup | undefined;
  let groupTrample: GPUBuffer | undefined;
  const computeGroupFor = (trample: GPUBuffer) => {
    if (computeGroup && groupTrample === trample) return computeGroup;
    groupTrample = trample;
    computeGroup = device.createBindGroup({
      layout: computeLayout,
      entries: [
        { binding: 0, resource: { buffer: field.buffer } },
        { binding: 1, resource: { buffer: blades } },
        { binding: 2, resource: { buffer: args } },
        { binding: 3, resource: { buffer: trample } },
      ],
    });
    return computeGroup;
  };

  const drawLayout = device.createBindGroupLayout({
    label: `${label} draw layout`,
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      {
        binding: 2,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });
  const drawPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [drawLayout] });
  const depthStencil: GPUDepthStencilState = {
    format: options.depthFormat ?? 'depth24plus',
    depthWriteEnabled: true,
    depthCompare: 'less',
  };
  // The distance target, or nothing: a fragment output with no target is discarded.
  const second = (): GPUColorTargetState | null =>
    options.distance ? { format: DISTANCE_FORMAT } : null;
  const draws = LOD_LEVELS.map((levels, lod) =>
    device.createRenderPipeline({
      label: `${label} draw lod ${lod}`,
      layout: drawPipelineLayout,
      vertex: {
        module: drawModule,
        entryPoint: 'blade_vs',
        constants: { LEVELS: levels, BASE: lod * capacity, THICKEN: lod === 0 ? 0 : 1 },
      },
      fragment: {
        module: drawModule,
        entryPoint: lod === 0 ? 'blade_fs_near' : 'blade_fs',
        constants: { LEVELS: levels, BASE: lod * capacity },
        targets: [{ format: options.format }, second()],
      },
      primitive: { topology: 'triangle-strip' },
      depthStencil,
      multisample: { count: samples },
    }),
  );
  const flowers = device.createRenderPipeline({
    label: `${label} flowers`,
    layout: drawPipelineLayout,
    vertex: { module: drawModule, entryPoint: 'flower_vs' },
    fragment: {
      module: drawModule,
      entryPoint: 'flower_fs',
      targets: [{ format: options.format }, second()],
    },
    primitive: { topology: 'triangle-strip' },
    depthStencil,
    multisample: { count: samples },
  });
  const ground = device.createRenderPipeline({
    label: `${label} ground`,
    layout: drawPipelineLayout,
    vertex: { module: groundModule, entryPoint: 'ground_vs' },
    fragment: {
      module: groundModule,
      entryPoint: 'ground_fs',
      targets: [
        {
          format: options.format,
          blend: {
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        },
        second(),
      ],
    },
    primitive: { topology: 'triangle-strip' },
    depthStencil,
    multisample: { count: samples },
  });
  const SHELLS = 12;
  const shells = device.createRenderPipeline({
    label: `${label} shells`,
    layout: drawPipelineLayout,
    vertex: { module: shellModule, entryPoint: 'shell_vs', constants: { SHELLS } },
    fragment: {
      module: shellModule,
      entryPoint: 'shell_fs',
      targets: [{ format: options.format }, second()],
    },
    primitive: { topology: 'triangle-strip' },
    depthStencil,
    multisample: { count: samples },
  });
  const drawGroup = device.createBindGroup({
    layout: drawLayout,
    entries: [
      { binding: 0, resource: { buffer: field.buffer } },
      { binding: 1, resource: { buffer: blades } },
      { binding: 2, resource: { buffer: look.buffer } },
    ],
  });

  // Counts, read back a few frames late, only once someone has asked for them (the HUD). The copy
  // is a small submit of its own, made before this frame resets the arguments, so it reads what
  // the previous frames left and never maps a buffer a recorded command buffer still uses (Fire
  // Temple's particle statistics).
  const ring = [0, 1].map(() => ({
    buffer: device.createBuffer({
      label: `${label} counts read`,
      size: 64,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    }),
    busy: false,
  }));
  let wanted = false;
  let destroyed = false;
  let last: [number, number, number, number] = [0, 0, 0, 0];
  const requestCounts = () => {
    const read = ring.find((r) => !r.busy);
    if (!read) return;
    read.busy = true;
    const encoder = device.createCommandEncoder({ label: `${label} counts` });
    encoder.copyBufferToBuffer(args, 0, read.buffer, 0, 64);
    device.queue.submit([encoder.finish()]);
    read.buffer.mapAsync(GPUMapMode.READ).then(
      () => {
        if (destroyed) return;
        const a = new Uint32Array(read.buffer.getMappedRange().slice(0));
        last = [a[1]!, a[5]!, a[9]!, a[13]!];
        read.buffer.unmap();
        read.busy = false;
      },
      () => (read.busy = false),
    );
  };

  let groups: [number, number] = [0, 0];
  let cells = 0;
  let trampleBuffer = untrampled;
  let withShells = false;

  return {
    blades,
    args,
    capacity,
    get cells() {
      return cells;
    },
    update(camera, s, time, size) {
      if (wanted) requestCounts();
      let cell = cellSize(s.species);
      const [x0, z0, x1, z1] = camera.ground;
      // Blades reach no further than `reach`: the grid need not either, ahead or across the view
      // (at distance d the view is d / scale[0] either side).
      const reach = s.reach ?? camera.far;
      const across = reach / camera.scale[0] + 1;
      const gx0 = Math.max(x0, camera.eye[0] - across);
      const gx1 = Math.min(x1, camera.eye[0] + across);
      const gz1 = Math.min(z1, camera.eye[2] + reach);
      while (((gx1 - gx0) / cell) * ((gz1 - z0) / cell) > maxCells) cell *= 1.25;
      const origin: [number, number] = [Math.floor(gx0 / cell), Math.floor(z0 / cell)];
      const count: [number, number] = [
        Math.max(0, Math.ceil(gx1 / cell) - origin[0]),
        Math.max(0, Math.ceil(gz1 / cell) - origin[1]),
      ];
      groups = [Math.ceil(count[0] / 8), Math.ceil(count[1] / 8)];
      cells = count[0] * count[1];
      const [hMin, hMax] = s.species.height;
      const len = Math.hypot(s.wind.dir[0], s.wind.dir[1]) || 1;
      trampleBuffer = s.trample?.buffer ?? untrampled;
      withShells = s.shells ?? false;
      field.set({
        view_proj: camera.viewProj,
        eye: camera.eye,
        cell,
        origin,
        count,
        scale: camera.scale,
        right: camera.right,
        wind_dir: [s.wind.dir[0] / len, s.wind.dir[1] / len],
        trample_origin: s.trample?.origin ?? [0, 0],
        pointer: s.pointer,
        ground: camera.ground,
        focal: (camera.scale[0] * size.width) / 2,
        aspect: size.width / size.height,
        density: Math.min(Math.max(s.density, 0), 1),
        fade: s.fade,
        reach,
        clump: s.clump,
        height_min: hMin * s.heightScale,
        height_max: hMax * s.heightScale,
        width: s.species.width,
        lean: s.species.lean,
        freq: s.species.freq,
        dry: s.species.dry,
        stems: s.species.stems,
        stem_height: s.species.stemHeight,
        flowers: s.species.flowers * (s.flowers ?? 1),
        flower_mix: FLOWER_MIX,
        // Heads at a drift's heart: blades a square metre, the share that are flowering stems with
        // a flower (twice the species' share there), and a head's area.
        flower_cover:
          s.species.density *
          s.density *
          s.species.stems *
          2 *
          s.species.flowers *
          (s.flowers ?? 1) *
          HEAD_AREA,
        flower_near: nearHeads ? (s.flowerNear ?? [0, 0]) : [0, 0],
        near_capacity: NEAR_CAPACITY,
        lod0: s.lod0,
        lod1: s.lod1,
        lod_blend: s.lodBlend ?? 0.3,
        min_pixels: s.minPixels,
        capacity,
        seed: s.seed >>> 0,
        flags: s.flags ?? ALL_PARTS,
        trample_cell: s.trample?.cell ?? 1,
        trample_size: s.trample?.size ?? 0,
        growth: s.growth?.progress ?? -1,
        growth_cell: s.growth?.cell ?? 1,
        growth_speed: s.growth?.speed ?? 1,
        growth_spread: s.growth?.spread ?? 0,
        wind_lean: s.wind.lean,
        wind_gust: s.wind.gust,
        gust_speed: s.wind.speed,
        gust_scale: s.wind.scale,
        flutter: s.wind.flutter,
        time,
      });
      field.upload();
      const pg = s.species.pigments;
      const root = [leafColours(pg.root[0]), leafColours(pg.root[1])] as const;
      const tip = [leafColours(pg.tip[0]), leafColours(pg.tip[1])] as const;
      const dead = leafColours(pg.dead);
      look.set({
        root_lush: root[0].reflect,
        root_pale: root[1].reflect,
        tip_lush: tip[0].reflect,
        tip_pale: tip[1].reflect,
        dead: dead.reflect,
        head: leafColours(pg.head).reflect,
        t_root: root[0].transmit,
        t_tip: tip[0].transmit,
        t_dead: dead.transmit,
        lai: s.species.lai,
        canopy_height: ((hMin + hMax) / 2) * s.heightScale,
        taper: s.species.taper,
        twist: s.species.twist,
        round: 0.5,
        min_width: 1,
        viewport: [size.width, size.height],
        ...WILDFLOWER_LOOK,
      });
      look.upload();
    },
    light(l) {
      look.set({
        sun_dir: l.sunDir,
        sun: l.sun,
        sky: l.sky,
        horizon: l.horizon ?? l.sky,
        transmit: l.transmit,
        sheen: l.sheen,
        cloud_depth: l.cloudDepth ?? 0,
        cloud_scale: l.cloudScale ?? 60,
        cloud_speed: l.cloudSpeed ?? 4,
        fog: l.fog ?? 0,
        soil: l.soil ?? [0.09, 0.06, 0.035],
        ground_mode: l.groundMode ?? 0,
      });
      look.upload();
    },
    compute(encoder, timestampWrites) {
      const pass = encoder.beginComputePass({ label: `${label} place`, timestampWrites });
      pass.setBindGroup(0, computeGroupFor(trampleBuffer));
      pass.setPipeline(reset);
      pass.dispatchWorkgroups(1);
      pass.setPipeline(place);
      if (groups[0] > 0 && groups[1] > 0) pass.dispatchWorkgroups(groups[0], groups[1]);
      pass.setPipeline(finish);
      pass.dispatchWorkgroups(1);
      pass.end();
    },
    draw(pass, withGround = true) {
      pass.setBindGroup(0, drawGroup);
      if (withGround) {
        pass.setPipeline(ground);
        pass.draw(4);
      }
      draws.forEach((p, lod) => {
        pass.setPipeline(p);
        pass.drawIndirect(args, lod * 16);
      });
      pass.setPipeline(flowers);
      pass.drawIndirect(args, 48);
      if (withShells) {
        pass.setPipeline(shells);
        pass.draw(4, SHELLS);
      }
    },
    counts() {
      wanted = true;
      return last;
    },
    destroy() {
      destroyed = true;
      field.destroy();
      look.destroy();
      blades.destroy();
      args.destroy();
      untrampled.destroy();
      for (const r of ring) r.buffer.destroy();
    },
  };
}
