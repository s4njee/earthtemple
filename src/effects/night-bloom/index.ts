import { arrange, MOONFLOWER, openReach, openTop } from '../../gpu/flower/diagram.ts';
import { nodToward } from '../../gpu/flower/heliotropism.ts';
import { LOOKS, STEMS } from '../../gpu/flower/looks.ts';
import { FLAT_PETAL } from '../../gpu/flower/petal.ts';
import { createFlowerRenderer } from '../../gpu/flower/render.ts';
import { headTilt, StemSway } from '../../gpu/flower/stem.ts';
import { pitchedCamera } from '../../gpu/grass/camera.ts';
import { createHdrTail, NIGHT_PARAMS, TAIL_PARAMS } from '../../gpu/post/index.ts';
import { DOSE_PARAMS, dosed, heldDose } from '../../gpu/safety/dose.ts';
import { trackScroll } from '../../gpu/scroll.ts';
import { defineEffect } from '../types.ts';
import { meta } from './meta.ts';

// Story 12.5: a moonflower (_Ipomoea alba_) opening at dusk. Its bud is a twisted spire, the limb
// furled round the axis; at dusk it untwists and the long tube flares into a flat white limb in a
// minute or so, fast enough to watch. It is drawn by the shared flower renderer from its floral
// diagram, lit by the moon and a dark sky, and the tail shows it as dark-adapted eyes would (Moon
// Temple's night vision, src/gpu/post/night.ts): by moonlight the rods take over, colour drains and
// blue holds up, so the white limb glows and the leaves sink into the dark.

type Vec3 = [number, number, number];

const PITCH = (32 * Math.PI) / 180;
/**
 * Opening, holding open, closing at dawn and resting, s. A funnel flaring open is a filled disc
 * growing, which optical flow reads as a zoom: over 40 s it stays under the cap.
 */
const OPEN = 40;
const HOLD = 10;
const CLOSE = 24;
const REST = 3;

export const effect = defineEffect({
  meta,
  params: {
    ...DOSE_PARAMS,
    follow: { type: 'select', default: 'time', options: ['time', 'scroll'], label: 'opens with' },
    moon: { type: 'number', default: 1, min: 0.3, max: 2, step: 0.05, label: 'moonlight' },
    ...TAIL_PARAMS,
    bloom: { ...TAIL_PARAMS.bloom, default: 0.45 },
    bloomThreshold: { ...TAIL_PARAMS.bloomThreshold, default: 0.7 },
    ...NIGHT_PARAMS,
    nightVision: { ...NIGHT_PARAMS.nightVision, default: 'moonlit' },
  },
  presets: {
    moonlit: {},
    starlit: { nightVision: 'starlit', moon: 0.5 },
    'true colour': { nightVision: 'off' },
    'on scroll': { follow: 'scroll' },
  },

  async create({ device, format, hdr, canvas, params, profiler }) {
    const tail = createHdrTail(device, { format, hdr, label: 'night-bloom' });
    const stem = STEMS.moonflower;
    const flowers = createFlowerRenderer(device, {
      format: tail.scene.format,
      label: 'night-bloom',
      species: [
        {
          diagram: MOONFLOWER,
          stem,
          // Two heart-shaped leaves on the vine below it.
          leaves: {
            count: 2,
            from: 0.1,
            to: 0.35,
            tilt: 1.25,
            top: 0.85,
            shape: {
              ...FLAT_PETAL,
              length: 0.1,
              width: 0.85,
              widest: 0.32,
              tip: 0.8,
              claw: 0.3,
              cup: 0.1,
              curl: -0.35,
            },
          },
        },
      ],
    });
    flowers.setLooks([{ look: LOOKS.moonflower, stem }]);
    const organs = arrange(MOONFLOWER);
    const size = openReach(organs);
    const tall = openTop(organs);
    const sway = new StemSway({
      ...stem,
      modulus: 1e9,
      density: 1000,
      headArea: Math.PI * size * size,
    });
    // Facing up and out towards the viewer, as a moonflower on a trellis does.
    const towards = [0.15, 0.7, -0.7];
    const facing = nodToward(towards);
    const along = Math.hypot(...towards);
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
        colour = make('night-bloom colour', tail.scene.format);
        depth = make('night-bloom depth', 'depth24plus');
      },
      frame(time, encoder, target) {
        const dt = time.still ? 0 : time.delta;
        clock += dt;
        const dose = time.still ? heldDose(params.dose) : params.dose;
        let progress: number;
        if (params.follow === 'scroll') {
          progress = scroll.update(dt).progress;
        } else {
          // Held, the clock stands still. The first frame is nearly open: what a poster, or a visitor
          // who asked for less motion, sees.
          const t = (clock + OPEN * 0.75) % (OPEN + HOLD + CLOSE + REST);
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
        // The night air barely moves.
        const wind = dosed(dose, 0, 0.12, 0.25) * (1 + 0.5 * Math.sin(0.4 * clock));
        if (dt > 0) sway.step(dt, wind, wind * 0.4);
        const tip = Math.hypot(sway.x, sway.z);
        const aspect = width / height;
        const fovY = (30 * Math.PI) / 180;
        const fit = Math.max(1, 1 / aspect);
        const distance = (size * 1.6 * fit) / Math.tan(fovY / 2);
        // Aimed at the middle of the open limb, out along the way the flower faces.
        const at = towards.map((c) => (c / along) * 0.75 * tall);
        const eye: Vec3 = [
          at[0]!,
          at[1]! + distance * Math.sin(PITCH),
          at[2]! - distance * Math.cos(PITCH),
        ];
        const camera = pitchedCamera({
          aspect,
          eye,
          pitch: PITCH,
          fovY,
          near: distance * 0.05,
          far: distance * 4,
        });
        const moon = params.moon;
        flowers.prepare(
          {
            viewProj: camera.viewProj,
            eye,
            time: clock,
            // The moon high to one side, cool; a dark blue sky.
            sun: [0.45, 0.8, -0.4, 1.1 * moon],
            sunColour: [0.8, 0.87, 1],
            skyTop: [0.05, 0.07, 0.14],
            skyBottom: [0.01, 0.012, 0.02],
            ambient: moon,
            translucency: 0.6,
            flutter: time.still ? 0 : dosed(dose, 0, 0.01, 0.02),
          },
          [
            {
              species: 0,
              perMetre: Math.min(width, height) / (3.2 * size),
              heads: [
                {
                  position: [0, 0, 0],
                  progress,
                  yaw: 0.4,
                  sway: [sway.x, sway.z, headTilt(sway.stem, tip), (0.6 * tip * tip) / stem.length],
                  nod: facing,
                },
              ],
            },
          ],
        );
        const pass = encoder.beginRenderPass({
          label: 'night-bloom',
          colorAttachments: [
            {
              view: colour!.createView(),
              resolveTarget: tail.scene.view,
              loadOp: 'clear',
              clearValue: { r: 0.004, g: 0.005, b: 0.01, a: 1 },
              storeOp: 'discard',
            },
          ],
          depthStencilAttachment: {
            view: depth!.createView(),
            depthClearValue: 1,
            depthLoadOp: 'clear',
            depthStoreOp: 'discard',
          },
          timestampWrites: profiler.pass('flower'),
        });
        flowers.draw(pass);
        pass.end();
        tail.encode(encoder, target, time, params, profiler);
      },
      stats: () => flowers.stats(),
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
