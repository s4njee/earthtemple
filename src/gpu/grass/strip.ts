import { createShader } from '../shader.ts';
import { DISTANCE_FORMAT } from './field.ts';
import shader from './strip.wgsl';

// Grass drawn only over the rows it covers. A strip along the bottom of a tall canvas leaves most
// of the canvas empty, and multisampling all of it costs fill and memory for nothing: at DPR 2, 4x
// colour and depth over a whole 1080p canvas are 160 MB. So the multisampled targets are the
// strip's rows only, resolved there, then copied into the bottom of the scene.

export interface GrassStrip {
  /** Rows of the strip, counted up from the bottom of the canvas. */
  readonly rows: number;
  /** Multisampled colour and depth, and the resolve target, all `width` x `rows`. */
  readonly colour: GPUTextureView;
  readonly depth: GPUTextureView;
  readonly resolve: GPUTextureView;
  /** With `distance`: each pixel's distance, multisampled and resolved. */
  readonly distance?: GPUTextureView;
  readonly distanceResolve?: GPUTextureView;
  /**
   * What a render pass resolves into: the resolve views, or undefined without multisampling, when
   * the pass draws straight into them.
   */
  readonly resolveTarget?: GPUTextureView;
  readonly distanceResolveTarget?: GPUTextureView;
  /** Reallocates if the size changed. */
  resize(width: number, rows: number): void;
  /**
   * Copies the resolved strip into the bottom rows of `scene`. By default it replaces the scene
   * (clearing the rest); `over` composites it over what the scene holds, premultiplied.
   */
  composite(
    encoder: GPUCommandEncoder,
    scene: GPUTextureView,
    sceneHeight: number,
    over?: boolean,
  ): void;
  destroy(): void;
}

export function createGrassStrip(
  device: GPUDevice,
  options: { format: GPUTextureFormat; samples: number; distance?: boolean; label?: string },
): GrassStrip {
  const label = options.label ?? 'grass strip';
  const module = createShader(device, shader);
  const copy = (blend?: GPUBlendState) =>
    device.createRenderPipeline({
      label: `${label} copy`,
      layout: 'auto',
      vertex: { module, entryPoint: 'strip_vs' },
      fragment: {
        module,
        entryPoint: 'strip_fs',
        targets: [{ format: options.format, blend }],
      },
    });
  const replace = copy();
  const over = copy({
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  });
  let width = 0;
  let rows = 0;
  let textures: GPUTexture[] = [];
  let views: GPUTextureView[] = [];
  let groups: [GPUBindGroup, GPUBindGroup] | undefined;

  const make = (format: GPUTextureFormat, samples: number, usage: GPUTextureUsageFlags) =>
    device.createTexture({ label, size: [width, rows], format, sampleCount: samples, usage });

  return {
    get rows() {
      return rows;
    },
    get colour() {
      return views[0]!;
    },
    get depth() {
      return views[1]!;
    },
    get resolve() {
      return views[2]!;
    },
    get distance() {
      return views[3];
    },
    get distanceResolve() {
      return views[4];
    },
    get resolveTarget() {
      return options.samples > 1 ? views[2] : undefined;
    },
    get distanceResolveTarget() {
      return options.samples > 1 ? views[4] : undefined;
    },
    resize(w, r) {
      if (w === width && r === rows) return;
      width = Math.max(1, w);
      rows = Math.max(1, r);
      for (const t of new Set(textures)) t.destroy();
      const resolved = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
      // Without multisampling, the pass draws straight into the textures it would resolve into.
      const single = options.samples === 1;
      const colour = make(options.format, 1, resolved);
      textures = [
        single ? colour : make(options.format, options.samples, GPUTextureUsage.RENDER_ATTACHMENT),
        make('depth24plus', options.samples, GPUTextureUsage.RENDER_ATTACHMENT),
        colour,
      ];
      if (options.distance) {
        const distance = make(DISTANCE_FORMAT, 1, resolved);
        textures.push(
          single
            ? distance
            : make(DISTANCE_FORMAT, options.samples, GPUTextureUsage.RENDER_ATTACHMENT),
          distance,
        );
      }
      views = textures.map((t) => t.createView());
      if (single) {
        views[0] = views[2]!;
        if (options.distance) views[3] = views[4]!;
      }
      const group = (p: GPURenderPipeline) =>
        device.createBindGroup({
          layout: p.getBindGroupLayout(0),
          entries: [{ binding: 0, resource: views[2]! }],
        });
      groups = [group(replace), group(over)];
    },
    composite(encoder, scene, sceneHeight, blend = false) {
      const pass = encoder.beginRenderPass({
        label: `${label} copy`,
        colorAttachments: [
          {
            view: scene,
            loadOp: blend ? 'load' : 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            storeOp: 'store',
          },
        ],
      });
      const r = Math.min(rows, sceneHeight);
      pass.setViewport(0, sceneHeight - r, width, r, 0, 1);
      pass.setPipeline(blend ? over : replace);
      pass.setBindGroup(0, groups![blend ? 1 : 0]);
      pass.draw(3);
      pass.end();
    },
    destroy() {
      for (const t of new Set(textures)) t.destroy();
    },
  };
}
