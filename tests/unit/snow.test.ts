import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/snow.js';
import type { K3Snow } from '../../src/components/animation/snow.js';
import {
  SnowEngine,
  SnowSpecs,
  resolveSnowColor,
  SNOW_COLOR_FALLBACK,
} from '../../src/components/animation/snow.js';

/** jsdom has no 2D canvas — stub enough for the snow loop. */
function stubCanvasContext(): void {
  const ctx = {
    canvas: document.createElement('canvas'),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
}

describe('k3-snow', () => {
  let el: K3Snow;

  beforeEach(async () => {
    stubCanvasContext();
    el = document.createElement('k3-snow') as K3Snow;
    el.disableForReducedMotion = false;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.reset();
    el.remove();
    document.querySelectorAll('body > canvas').forEach((c) => c.remove());
    vi.restoreAllMocks();
  });

  it('registers with react-snowfall defaults', async () => {
    expect(customElements.get('k3-snow')).toBeTruthy();
    expect(el.snowflakeCount).toBe(SnowSpecs.snowflakeCount);
    expect(el.color).toBe('');
    expect(el.speed).toEqual([1, 3]);
    expect(el.wind).toEqual([-0.5, 2]);
    expect(el.radius).toEqual([0.5, 3]);
    expect(el.getAttribute('role')).toBe('presentation');
  });

  it('resolveSnowColor uses on-surface when color is empty', () => {
    document.documentElement.style.setProperty(
      '--k3-sys-color-on-surface',
      '#abcdef',
    );
    expect(resolveSnowColor('')).toBe('#abcdef');
    expect(resolveSnowColor('on-surface')).toBe('#abcdef');
    expect(resolveSnowColor('#ff0000')).toBe('#ff0000');
    document.documentElement.style.removeProperty('--k3-sys-color-on-surface');
    expect(resolveSnowColor('', null)).toBe(SNOW_COLOR_FALLBACK);
  });

  it('start() emits and marks running', async () => {
    const onStart = vi.fn();
    el.addEventListener('k3-snow-start', onStart);
    el.start();
    expect(onStart).toHaveBeenCalled();
    expect(el.isRunning).toBe(true);
    el.stop();
    expect(el.isRunning).toBe(false);
  });

  it('refuses start() while buried under [hidden] (no body canvas)', async () => {
    el.remove();
    const wrap = document.createElement('div');
    wrap.hidden = true;
    el = document.createElement('k3-snow') as K3Snow;
    el.disableForReducedMotion = false;
    wrap.appendChild(el);
    document.body.appendChild(wrap);
    await el.updateComplete;
    const before = document.body.querySelectorAll(':scope > canvas').length;
    el.start();
    expect(el.isRunning).toBe(false);
    expect(document.body.querySelectorAll(':scope > canvas').length).toBe(before);
    wrap.remove();
  });

  it('SnowEngine keeps a lib canvas until destroy', () => {
    const engine = new SnowEngine(null, {
      resize: false,
      disableForReducedMotion: false,
      snowflakeCount: 12,
    });
    engine.warm();
    const canvases = () => document.body.querySelectorAll(':scope > canvas').length;
    const warmed = canvases();
    expect(warmed).toBeGreaterThan(0);
    engine.start();
    expect(engine.isRunning).toBe(true);
    engine.configure({ snowflakeCount: 20, color: '#fff' });
    engine.stop();
    expect(canvases()).toBe(warmed);
    engine.destroy();
    expect(canvases()).toBe(0);
  });

  it('min/max HTML helpers feed the engine config', async () => {
    el.speedMin = 0.5;
    el.speedMax = 2.5;
    el.windMin = -1;
    el.windMax = 1;
    el.radiusMin = 1;
    el.radiusMax = 4;
    await el.updateComplete;
    el.start();
    const opts = el.getEngine();
    expect(opts.isRunning).toBe(true);
    /* Helpers override array props without mutating them in updated(). */
    expect(el.speedMin).toBe(0.5);
    expect(el.speedMax).toBe(2.5);
    expect(el.radiusMin).toBe(1);
  });

  it('use-host-canvas renders an in-host canvas', async () => {
    el.remove();
    el = document.createElement('k3-snow') as K3Snow;
    el.useHostCanvas = true;
    el.disableForReducedMotion = false;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector('canvas')).toBeTruthy();
  });
});
