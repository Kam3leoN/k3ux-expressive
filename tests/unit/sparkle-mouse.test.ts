import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/sparkle-mouse.js';
import type { K3SparkleMouse } from '../../src/components/animation/sparkle-mouse.js';
import {
  SparkleEngine,
  SparkleMouseSpecs,
  intensityFactor,
  parseSparkleColors,
  resolveSparkleColors,
} from '../../src/components/animation/sparkle-mouse.js';
import { maxParticles } from '../../src/components/animation/sparkle-mouse/sparkle-mouse.utils.js';
import { catalog } from '../../src/registry/catalog.js';

/** jsdom has no 2D canvas — record what the engine paints. */
function stubCanvasContext(): { fills: string[] } {
  const fills: string[] = [];
  const ctx = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(() => void fills.push(ctx.fillStyle)),
    fillStyle: '',
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  return { fills };
}

/** jsdom ships no PointerEvent — a MouseEvent with the extra field is enough. */
function pointer(type: string, x: number, y: number, pointerType = 'mouse'): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  window.dispatchEvent(event);
}

const FIVE = ['#ffd54f', '#ff8a65', '#f06292', '#ba68c8', '#64b5f6'];
const TEN = [...FIVE, '#4db6ac', '#aed581', '#fff176', '#ffb74d', '#e57373'];

describe('sparkle colours', () => {
  it('parses comma lists, functional colours and JSON arrays', () => {
    expect(parseSparkleColors('#f00, rgb(0, 128, 255) ,primary,')).toEqual(['#f00', 'rgb(0, 128, 255)', 'primary']);
    expect(parseSparkleColors('color-mix(in srgb, red 40%, blue), var(--brand, #333)')).toEqual([
      'color-mix(in srgb, red 40%, blue)',
      'var(--brand, #333)',
    ]);
    expect(parseSparkleColors('["#111","#222"]')).toEqual(['#111', '#222']);
    expect(parseSparkleColors([' #abc ', '', 7 as unknown as string])).toEqual(['#abc']);
    expect(parseSparkleColors(null)).toEqual([]);
    expect(parseSparkleColors('')).toEqual([]);
  });

  it('keeps every colour of a palette, whatever its length', () => {
    expect(parseSparkleColors(FIVE.join(', '))).toEqual(FIVE);
    expect(resolveSparkleColors(TEN)).toEqual(TEN);
    expect(resolveSparkleColors(Array.from({ length: 40 }, (_v, i) => `hsl(${i * 9} 80% 60%)`))).toHaveLength(40);
  });

  it('resolves theme roles and var(), with fallbacks', () => {
    const el = document.createElement('div');
    el.style.setProperty('--k3-sys-color-primary', '#123456');
    el.style.setProperty('--brand', 'rebeccapurple');
    document.body.append(el);
    expect(resolveSparkleColors(['primary', 'var(--brand)', 'var(--nope, #0a0)', 'gold'], el)).toEqual([
      '#123456',
      'rebeccapurple',
      '#0a0',
      'gold',
    ]);
    el.remove();
    /* Default palette: five blue-violet colours */
    expect(resolveSparkleColors([])).toEqual(['#5b8def', '#6f7bf7', '#7c5cff', '#9a6bff', '#b388ff']);
    expect(resolveSparkleColors(null)).toEqual([...SparkleMouseSpecs.colors]);
    expect(resolveSparkleColors(['var(--missing)'])).toEqual([...SparkleMouseSpecs.fallbackColors]);
  });
});

describe('sparkle intensity', () => {
  it('clamps to 0–100 %', () => {
    expect(intensityFactor(20)).toBe(0.2);
    expect(intensityFactor(250)).toBe(1);
    expect(intensityFactor(-5)).toBe(0);
    expect(intensityFactor(Number.NaN)).toBe(0);
    expect(maxParticles(0)).toBe(0);
    expect(maxParticles(100)).toBeGreaterThan(maxParticles(10) * 5);
  });
});

describe('SparkleEngine', () => {
  let painted: { fills: string[] };
  let engine: SparkleEngine;

  beforeEach(() => {
    painted = stubCanvasContext();
    engine = new SparkleEngine(null, { disableForReducedMotion: false });
  });

  afterEach(() => {
    engine.destroy();
    vi.restoreAllMocks();
  });

  it('defaults to a light trail: 20 % → 1 sparkle per 10 px, 12–28 px, no gravity', () => {
    expect(SparkleMouseSpecs.intensity).toBe(20);
    expect(SparkleMouseSpecs.size).toEqual([12, 28]);
    expect(SparkleMouseSpecs.gravity).toBe(0);
    expect(engine.emitAlong(0, 0, 400, 0)).toBe(40);
    expect(engine.count).toBe(40);
  });

  it('100 % is five times denser; 0 % is silent', () => {
    engine.configure({ intensity: 100 });
    /* One move is capped (teleport guard); several moves add up. */
    expect(engine.emitAlong(0, 0, 400, 0)).toBe(SparkleMouseSpecs.maxPerMove);
    let born = 0;
    for (let x = 0; x < 400; x += 20) born += engine.emitAlong(x, 0, x + 20, 0);
    expect(born).toBe(200);
    engine.clear();
    engine.configure({ intensity: 0 });
    expect(engine.emitAlong(0, 0, 4000, 0)).toBe(0);
    expect(engine.count).toBe(0);
  });

  it('short moves accumulate instead of being lost', () => {
    let born = 0;
    for (let i = 0; i < 45; i++) born += engine.emitAlong(i, 0, i + 1, 0);
    expect(born).toBe(4);
  });

  it('never keeps more than the cap for its intensity', () => {
    for (let i = 0; i < 100; i++) engine.emitAlong(0, 0, 1000, 0);
    expect(engine.count).toBe(maxParticles(20));
    engine.configure({ intensity: 1 });
    expect(engine.count).toBeLessThanOrEqual(maxParticles(1));
  });

  it('uses every colour of the palette — 5 or 10', () => {
    for (const palette of [FIVE, TEN]) {
      engine.clear();
      painted.fills.length = 0;
      engine.configure({ intensity: 100, colors: palette });
      for (let i = 0; i < 12; i++) engine.emitAlong(0, i, 300, i);
      engine.step(16);
      expect(new Set(painted.fills)).toEqual(new Set(palette));
    }
  });

  it('sparkles drift down, fade and die; the overlay canvas appears only while needed', () => {
    engine.configure({ duration: 400, gravity: 500 });
    engine.emitAlong(100, 100, 300, 100);
    expect(engine.count).toBeGreaterThan(0);
    engine.step(16);
    expect(document.querySelector('canvas[data-k3-sparkle-mouse]')).toBeTruthy();
    for (let t = 0; t < 700; t += 16) engine.step(16);
    expect(engine.count).toBe(0);
    engine.destroy();
    expect(document.querySelector('canvas[data-k3-sparkle-mouse]')).toBeNull();
  });

  it('follows the mouse, ignores touch unless asked, and stops', () => {
    engine.start();
    expect(engine.isRunning).toBe(true);
    pointer('pointermove', 0, 0);
    pointer('pointermove', 200, 0);
    expect(engine.count).toBe(20);
    pointer('pointermove', 800, 0, 'touch');
    expect(engine.count).toBe(20);
    engine.configure({ touch: true });
    pointer('pointermove', 0, 300, 'touch');
    pointer('pointermove', 200, 300, 'touch');
    expect(engine.count).toBeGreaterThan(20);
    const before = engine.count;
    engine.stop();
    pointer('pointermove', 900, 900);
    expect(engine.count).toBe(before);
    expect(engine.isRunning).toBe(false);
  });

  it('honours reduced motion and the canEmit gate; burst() works at 0 %', () => {
    let open = false;
    engine.configure({ canEmit: () => open, intensity: 0 });
    expect(engine.burst(50, 50, 12)).toBe(0);
    open = true;
    expect(engine.burst(50, 50, 12)).toBe(12);
    expect(engine.burst(50, 50, 99_999)).toBe(400);
    expect(engine.burst(50, 50, -3)).toBe(0);

    const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const calm = new SparkleEngine(null, { intensity: 100 });
    expect(calm.emitAlong(0, 0, 500, 0)).toBe(0);
    calm.destroy();
    media.mockRestore();
  });

  it('sanitises hostile options', () => {
    engine.configure({
      size: [40, -5],
      duration: Number.NaN,
      spread: -10,
      gravity: Number.NaN,
      intensity: Number.POSITIVE_INFINITY,
    });
    expect(() => engine.emitAlong(0, 0, 100, 0)).not.toThrow();
    expect(() => engine.step(Number.POSITIVE_INFINITY)).not.toThrow();
    expect(engine.count).toBe(0);
  });
});

describe('k3-sparkle-mouse', () => {
  let el: K3SparkleMouse;

  beforeEach(async () => {
    stubCanvasContext();
    el = document.createElement('k3-sparkle-mouse') as K3SparkleMouse;
    el.disableForReducedMotion = false;
    document.body.appendChild(el);
    await el.updateComplete;
    await Promise.resolve();
  });

  afterEach(() => {
    el.remove();
    document.querySelectorAll('canvas[data-k3-sparkle-mouse]').forEach((c) => c.remove());
    vi.restoreAllMocks();
  });

  it('registers, is decorative and follows the pointer by default at 20 %', () => {
    expect(customElements.get('k3-sparkle-mouse')).toBeTruthy();
    expect(catalog.some((c) => c.tag === 'k3-sparkle-mouse')).toBe(true);
    expect(el.intensity).toBe(20);
    expect(el.sizeMin).toBe(12);
    expect(el.sizeMax).toBe(28);
    expect(el.gravity).toBe(0);
    expect(el.colors).toEqual([]);
    expect(el.getEngine().colors).toEqual(['#5b8def', '#6f7bf7', '#7c5cff', '#9a6bff', '#b388ff']);
    expect(el.getAttribute('role')).toBe('presentation');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.isRunning).toBe(true);
    pointer('pointermove', 0, 0);
    pointer('pointermove', 400, 0);
    expect(el.getEngine().count).toBe(40);
  });

  it('takes the palette from the attribute or the property — any length', async () => {
    el.setAttribute('colors', FIVE.join(', '));
    await el.updateComplete;
    expect(el.colors).toEqual(FIVE);
    expect(el.getEngine().colors).toEqual(FIVE);
    el.colors = TEN;
    await el.updateComplete;
    expect(el.getEngine().colors).toEqual(TEN);
    el.colors = [];
    await el.updateComplete;
    expect(el.getEngine().colors).toEqual([...SparkleMouseSpecs.colors]);
  });

  it('intensity updates live', async () => {
    el.intensity = 100;
    await el.updateComplete;
    pointer('pointermove', 0, 50);
    pointer('pointermove', 100, 50);
    expect(el.getEngine().count).toBe(50);
  });

  it('disabled, hidden ancestors and stop() mute it; start() resumes', async () => {
    el.disabled = true;
    await el.updateComplete;
    pointer('pointermove', 0, 0);
    pointer('pointermove', 400, 0);
    expect(el.getEngine().count).toBe(0);
    el.disabled = false;

    const page = document.createElement('article');
    page.hidden = true;
    document.body.append(page);
    page.append(el);
    await el.updateComplete;
    await Promise.resolve();
    pointer('pointermove', 0, 0);
    pointer('pointermove', 400, 0);
    expect(el.getEngine().count).toBe(0);
    page.hidden = false;
    pointer('pointermove', 800, 0);
    expect(el.getEngine().count).toBeGreaterThan(0);

    const stop = vi.fn();
    const start = vi.fn();
    el.addEventListener('k3-sparkle-mouse-stop', stop);
    el.addEventListener('k3-sparkle-mouse-start', start);
    el.stop();
    el.stop();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(el.isRunning).toBe(false);
    el.start();
    expect(start).toHaveBeenCalledTimes(1);
    expect(el.isRunning).toBe(true);
    page.remove();
  });

  it('removes its listeners and canvas when disconnected, and comes back when re-attached', async () => {
    el.burst(10, 10, 5);
    el.getEngine().step(16);
    expect(document.querySelector('canvas[data-k3-sparkle-mouse]')).toBeTruthy();
    el.remove();
    expect(document.querySelector('canvas[data-k3-sparkle-mouse]')).toBeNull();
    document.body.append(el);
    await el.updateComplete;
    await Promise.resolve();
    expect(el.isRunning).toBe(true);
  });

  it('use-host-canvas keeps sparkles inside the host box', async () => {
    el.useHostCanvas = true;
    await el.updateComplete;
    await Promise.resolve();
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      right: 300,
      bottom: 300,
      width: 200,
      height: 200,
    } as DOMRect);
    expect(el.isRunning).toBe(true);
    pointer('pointermove', 0, 0);
    pointer('pointermove', 90, 90);
    expect(el.getEngine().count).toBe(0);
    pointer('pointermove', 110, 200);
    pointer('pointermove', 290, 200);
    expect(el.getEngine().count).toBe(18);
    expect(document.querySelector('canvas[data-k3-sparkle-mouse]')).toBeNull();
  });
});
