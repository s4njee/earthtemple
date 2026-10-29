// Story 3.8: a grass strip four ways, chosen by the query string, for experiments/grass-compare.mjs.
//
//   ?method=svg&n=400        SVG blade paths, each swaying with a CSS keyframe rotation
//   ?method=css              three gradient layers masked into blades and sheared (no count)
//   ?method=canvas&n=400     Canvas 2D: every blade a curve, redrawn each frame
//   ?method=webgpu&density=0.8   the grass-footer effect on a canvas along the bottom
//
// Each draws green blades along the bottom quarter of the view. `window.__ready` turns true when
// the grass is running; for WebGPU `window.__blades` holds the blades drawn.

import { mount } from '../src/lib/index.ts';
import { effect } from '../src/effects/grass-footer/index.ts';

declare global {
  interface Window {
    __ready?: boolean;
    __blades?: number;
  }
}

const query = new URLSearchParams(location.search);
const method = query.get('method') ?? 'svg';
const n = Number(query.get('n') ?? 400);
const random = (() => {
  let s = 12345;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
})();
const greens = ['#2f5a1c', '#3d6e22', '#4f7f2a', '#5d8a33', '#6e963c'];

function strip(tag: 'div' | 'canvas') {
  const element = document.createElement(tag);
  element.className = `strip ${method}`;
  document.body.append(element);
  return element;
}

function svg() {
  const layer = strip('div');
  const ns = 'http://www.w3.org/2000/svg';
  const root = document.createElementNS(ns, 'svg');
  root.setAttribute('viewBox', '0 0 1000 100');
  root.setAttribute('preserveAspectRatio', 'none');
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');
  for (let i = 0; i < n; i++) {
    const x = 1000 * random();
    const h = 45 + 55 * random();
    const w = 1.2 + 1.2 * random();
    const lean = (random() - 0.5) * 20;
    const path = document.createElementNS(ns, 'path');
    path.setAttribute(
      'd',
      `M${x - w} 100 Q${x + lean * 0.4} ${100 - h * 0.6} ${x + lean} ${100 - h} Q${x + lean * 0.4 + w * 0.3} ${100 - h * 0.6} ${x + w} 100Z`,
    );
    path.setAttribute('fill', greens[Math.floor(random() * greens.length)]!);
    path.style.animationDuration = `${1.6 + 1.6 * random()}s`;
    path.style.animationDelay = `${-3 * random()}s`;
    root.append(path);
  }
  layer.append(root);
}

function css() {
  const layer = strip('div');
  for (const [w, colour, dur] of [
    ['14px', '#2f5a1c', 3.1],
    ['10px', '#4f7f2a', 2.6],
    ['7px', '#6e963c', 2.2],
  ] as const) {
    const tuft = document.createElement('div');
    tuft.style.cssText = `--w:${w};background:linear-gradient(to top, #1d3a10, ${colour});animation-duration:${dur}s`;
    layer.append(tuft);
  }
}

function canvas2d() {
  const canvas = strip('canvas') as HTMLCanvasElement;
  const context = canvas.getContext('2d')!;
  const blades = Array.from({ length: n }, () => ({
    x: random(),
    h: 0.45 + 0.55 * random(),
    w: 1.2 + 1.2 * random(),
    lean: (random() - 0.5) * 0.2,
    phase: random() * 6.28,
    colour: greens[Math.floor(random() * greens.length)]!,
  }));
  const tick = (now: number) => {
    const width = (canvas.width = canvas.clientWidth * devicePixelRatio);
    const height = (canvas.height = canvas.clientHeight * devicePixelRatio);
    context.clearRect(0, 0, width, height);
    for (const b of blades) {
      const x = b.x * width;
      const h = b.h * height;
      const sway = b.lean + 0.08 * Math.sin(now / 700 + b.phase + b.x * 6);
      context.fillStyle = b.colour;
      context.beginPath();
      context.moveTo(x - b.w, height);
      context.quadraticCurveTo(x + sway * h * 0.4, height - h * 0.6, x + sway * h, height - h);
      context.quadraticCurveTo(x + sway * h * 0.4 + b.w * 0.3, height - h * 0.6, x + b.w, height);
      context.fill();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function webgpu() {
  const canvas = strip('canvas') as HTMLCanvasElement;
  const host = await mount(canvas, effect, {
    initialParams: { density: Number(query.get('density') ?? 0.8) },
  });
  host.onStats((stats) => {
    const e = stats.effect ?? {};
    window.__blades = Number(e.near ?? 0) + Number(e.mid ?? 0) + Number(e.far ?? 0);
  });
}

if (method === 'svg') svg();
else if (method === 'css') css();
else if (method === 'canvas') canvas2d();
else if (method === 'webgpu') await webgpu();
window.__ready = true;
