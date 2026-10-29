import { arrange, FLOWERS, openReach, openTop, type FlowerName } from '../../gpu/flower/diagram.ts';
import { LOOKS, STEMS } from '../../gpu/flower/looks.ts';
import { createFlowerRenderer } from '../../gpu/flower/render.ts';
import { headTilt, StemSway } from '../../gpu/flower/stem.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { createHdrTail, OVERLAY_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { trackScroll } from '../../gpu/scroll.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';

// Story 12.1: one flower opening, built from its floral diagram (story 11.2) with grown petals
// (story 11.1), drawn by the flower renderer the blooms share (src/gpu/flower/render.ts). The
// diagram's organs go to the GPU once, as instances; each frame only the opening, the view and the
// light change. Drawn with 4x multisampling straight into the scene.

type Vec3 = [number, number, number];

// The single flowers. The field's daisy and cornflower are composite heads for the meadow.
const NAMES: FlowerName[] = [
  'lily',
  'buttercup',
  'cherry',
  'poppy',
  'rose',
  'camellia',
  'hibiscus',
  'morning glory',
  'daffodil',
];
const PITCH = (38 * Math.PI) / 180;
const OPEN = 8;
const HOLD = 4;
const CLOSE = 5;
const REST = 1.5;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    flower: { type: 'select', default: 'poppy', options: NAMES },
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
    // Every flower is a species of one renderer; the one shown is the only group drawn.
    const flowers = createFlowerRenderer(device, {
      format: tail.scene.format,
      label: 'flower-opening',
      species: NAMES.map((name) => ({ diagram: FLOWERS[name], stem: STEMS[name] })),
    });
    flowers.setLooks(NAMES.map((name) => ({ look: LOOKS[name], stem: STEMS[name] })));
    const scroll = trackScroll(canvas);
    const reaches = new Map<FlowerName, [number, number]>();
    let shown: FlowerName | undefined;
    let sway: StemSway | undefined;
    let colour: GPUTexture | undefined;
    let depth: GPUTexture | undefined;
    let width = 1;
    let height = 1;
    let clock = 0;

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
        const name = (NAMES as string[]).includes(params.flower)
          ? (params.flower as FlowerName)
          : 'poppy';
        if (!reaches.has(name)) {
          const all = arrange(FLOWERS[name]);
          reaches.set(name, [openReach(all), openTop(all)]);
        }
        const [size, tall] = reaches.get(name)!;
        if (name !== shown) {
          // The stem sways as a cantilever under the head, whose open reach's disc takes the wind.
          sway = new StemSway({
            ...STEMS[name],
            modulus: 1e9,
            density: 1000,
            headArea: Math.PI * size ** 2,
          });
          shown = name;
        }
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
        // Its open reach fills about two thirds of the shorter side: so many px a metre.
        const perMetre = (Math.min(width, height) * (LOOKS[name].fill ?? 1)) / (3 * size);
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
        flowers.prepare(
          {
            viewProj: camera.viewProj,
            eye,
            time: clock,
            sun: [-0.4, 0.75, 0.55, 2.2],
            ruffle: params.ruffle,
            flutter: time.still ? 0 : dosed(dose, 0, 0.02, 0.05),
          },
          [
            {
              species: NAMES.indexOf(name),
              perMetre,
              heads: [
                {
                  position: centre,
                  progress,
                  yaw: 2 * Math.PI * params.spin * dosed(dose, 0, 1, 1.2) * clock,
                  sway: swayUniform(wind, heading, dt),
                  look: NAMES.indexOf(name),
                },
              ],
            },
          ],
        );
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
        flowers.draw(pass);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => {
        const { organs, vertices } = flowers.stats();
        return { organs, vertices };
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
