import { arrange, openReach, openTop, ROSE } from '../../gpu/flower/diagram.ts';
import { LOOKS, STEMS, type FlowerLook } from '../../gpu/flower/looks.ts';
import { createFlowerRenderer } from '../../gpu/flower/render.ts';
import { headTilt, StemSway } from '../../gpu/flower/stem.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { trackScroll } from '../../gpu/scroll.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';

// Story 12.2: a rose opening from a tight bud, the flower model's test. Its forty petals are a
// golden-angle spiral (Vogel), and in the bud each lies on its own sphere round a common centre,
// wrapped across and curled along to it, so each is inside the one before; the closed bud is
// stretched upwards, which keeps them nested. As they open each stays on a surface of revolution,
// a bowl that flattens and turns back, wrapped across to that bowl's curvature, and nested bowls do
// not cross either (`Bud` in src/gpu/flower/diagram.ts, `bowlWrap` in opening.ts). Their margins
// roll back as they open, which points the outer petals. Drawn by the shared flower renderer.

type Vec3 = [number, number, number];

/** Rose colours from their pigments (story 11.3). Every rose petal has conical cells: velvet. */
const VARIETIES: Record<string, FlowerLook> = {
  red: {
    ...LOOKS.rose,
    // Dense anthocyanin in a thin petal: a deep red, darker in the shade of the cup.
    petal: { anthocyanin: 300, pH: 3.6, carotenoids: 4, layers: 1.2, velvet: 1 },
    base: { anthocyanin: 60, pH: 4, carotenoids: 10, layers: 1.4, velvet: 1 },
  },
  pink: {
    ...LOOKS.rose,
    petal: { anthocyanin: 6, pH: 4.5, layers: 1.9, velvet: 0.7 },
    base: { anthocyanin: 2, pH: 4.5, carotenoids: 6, layers: 2, velvet: 0.7 },
  },
  white: {
    ...LOOKS.rose,
    petal: { carotenoids: 0.3, layers: 2.8, velvet: 0.5 },
    base: { carotenoids: 3, chlorophyll: 0.15, layers: 2.6, velvet: 0.5 },
  },
  yellow: {
    ...LOOKS.rose,
    petal: { carotenoids: 32, layers: 1.8, velvet: 0.5 },
    base: { carotenoids: 50, layers: 1.8, velvet: 0.5 },
  },
  peach: {
    ...LOOKS.rose,
    petal: { carotenoids: 10, anthocyanin: 1.5, pH: 4.5, layers: 2.1, velvet: 0.6 },
    base: { carotenoids: 24, layers: 2, velvet: 0.6 },
  },
};
const NAMES = Object.keys(VARIETIES);

const PITCH = (30 * Math.PI) / 180;
/**
 * Opening, holding open, closing and resting, s. A rose's bloom is a filled disc growing as it
 * opens, which optical flow reads as a zoom: over a minute, it stays under the cap.
 */
const OPEN = 64;
const HOLD = 8;
const CLOSE = 40;
const REST = 2;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    variety: { type: 'select', default: 'red', options: NAMES },
    follow: { type: 'select', default: 'time', options: ['time', 'scroll'], label: 'opens with' },
    // Turning is whole-field rotation: the cap is 5° a second, so at most 0.012 turns.
    spin: {
      type: 'number',
      default: 0.006,
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
    red: {},
    pink: { variety: 'pink' },
    white: { variety: 'white' },
    yellow: { variety: 'yellow' },
    peach: { variety: 'peach' },
    'on scroll': { follow: 'scroll' },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'rose' });
    const flowers = createFlowerRenderer(device, {
      format: tail.scene.format,
      label: 'rose',
      species: [{ diagram: ROSE, stem: STEMS.rose }],
    });
    flowers.setLooks(NAMES.map((name) => ({ look: VARIETIES[name]!, stem: STEMS.rose })));
    const organs = arrange(ROSE);
    const size = openReach(organs);
    const tall = openTop(organs);
    const sway = new StemSway({
      ...STEMS.rose,
      modulus: 1e9,
      density: 1000,
      headArea: Math.PI * size ** 2,
    });
    const scroll = trackScroll(canvas);
    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;

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
        colour = make('rose colour', tail.scene.format);
        depth = make('rose depth', 'depth24plus');
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : time.delta;
        clock += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        let progress: number;
        if (params.follow === 'scroll') {
          progress = scroll.update(dt).progress;
        } else {
          // Held, the clock stands still. The first frame is part way open: what a poster, or a
          // visitor who asked for less motion, sees.
          const t = (clock + OPEN * 0.6) % (OPEN + HOLD + CLOSE + REST);
          progress =
            t < OPEN
              ? t / OPEN
              : t < OPEN + HOLD
                ? 1
                : t < OPEN + HOLD + CLOSE
                  ? 1 - (t - OPEN - HOLD) / CLOSE
                  : 0;
          progress = progress * progress * (3 - 2 * progress);
        }
        // Light air through the garden, gusting, pushing the head on its stem.
        const gust = 1 + 0.5 * Math.sin(0.6 * clock) + 0.3 * Math.sin(1.7 * clock + 1);
        const wind = dosed(dose, 0, 0.25, 0.4) * Math.max(gust, 0);
        const heading = 0.3 + 0.4 * Math.sin(0.05 * clock);
        if (dt > 0) sway.step(dt, wind * Math.cos(heading), wind * Math.sin(heading));
        const tip = Math.hypot(sway.x, sway.z);
        // Close: the open rose fills most of the shorter side.
        const aspect = width / height;
        const fovY = (28 * Math.PI) / 180;
        const fit = Math.max(1, 1 / aspect);
        const distance = (size * 1.25 * fit) / Math.tan(fovY / 2);
        const centre: Vec3 = [0, 0, 0];
        const aim = 0.45 * tall;
        const eye: Vec3 = [0, aim + distance * Math.sin(PITCH), -distance * Math.cos(PITCH)];
        const camera = pitchedCamera({
          aspect,
          eye,
          pitch: PITCH,
          fovY,
          near: distance * 0.05,
          far: distance * 4,
        });
        const perMetre = Math.min(width, height) / (2.5 * size);
        const variety = Math.max(NAMES.indexOf(params.variety), 0);
        flowers.prepare(
          {
            viewProj: camera.viewProj,
            eye,
            time: clock,
            // A warm low sun to one side, a cool sky.
            // Exposed for the red: brighter, a velvet red's lit faces clip to one flat colour.
            sun: [-0.55, 0.6, 0.5, 1.4],
            sunColour: [1, 0.93, 0.84],
            skyTop: [0.42, 0.47, 0.55],
            skyBottom: [0.12, 0.1, 0.09],
            flutter: time.still ? 0 : dosed(dose, 0, 0.012, 0.03),
          },
          [
            {
              species: 0,
              perMetre,
              heads: [
                {
                  position: centre,
                  progress,
                  yaw: 2 * Math.PI * params.spin * dosed(dose, 0, 1, 1.2) * clock,
                  sway: [
                    sway.x,
                    sway.z,
                    headTilt(sway.stem, tip),
                    (0.6 * tip * tip) / sway.stem.length,
                  ],
                  look: variety,
                },
              ],
            },
          ],
        );
        const page = params.behind === 'page';
        const pass = encoder.beginRenderPass({
          label: 'rose',
          colorAttachments: [
            {
              view: colour!.createView(),
              resolveTarget: tail.scene.view,
              loadOp: 'clear',
              clearValue: page
                ? { r: 0, g: 0, b: 0, a: 0 }
                : { r: 0.014, g: 0.012, b: 0.012, a: 1 },
              storeOp: 'discard',
            },
          ],
          depthStencilAttachment: {
            view: depth!.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('petals'),
        });
        flowers.draw(pass);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => {
        const { organs: drawn, vertices } = flowers.stats();
        return { organs: drawn, vertices };
      },
      destroy() {
        scroll.destroy();
        flowers.destroy();
        colour?.destroy();
        depth?.destroy();
        tail.destroy();
      },
    };
  },
});
