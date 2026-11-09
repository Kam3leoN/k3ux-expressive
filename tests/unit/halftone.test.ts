import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/halftone.js';
import type { K3Halftone } from '../../src/components/animation/halftone.js';
import {
  HALFTONE_PRESETS,
  applyDotGain,
  channelValue,
  dotSizeTable,
  parseInks,
  separate,
} from '../../src/components/animation/halftone.engine.js';

/* jsdom has no 2D canvas — a recording stub is enough for the engine */
function fakeContext(opts: { taint?: boolean } = {}) {
  const calls = { fill: 0, arc: 0, getImageData: 0 };
  const ctx = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillStyle: '#000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    drawImage: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      calls.getImageData++;
      if (opts.taint) throw new DOMException('tainted', 'SecurityError');
      const data = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        data[i * 4] = (i * 37) % 256;
        data[i * 4 + 1] = (i * 91) % 256;
        data[i * 4 + 2] = (i * 53) % 256;
        data[i * 4 + 3] = 255;
      }
      return { data };
    },
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
    createPattern: () => ({}),
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => void calls.arc++,
    ellipse: () => {},
    fill: () => void calls.fill++,
    save: () => {},
    restore: () => {},
  };
  return { ctx, calls };
}

const settle = () => new Promise((r) => setTimeout(r, 60));

describe('halftone engine', () => {
  it('sizes square and line dots exactly', () => {
    const square = dotSizeTable('square');
    expect(square[0]).toBe(0);
    expect(square[255]).toBeCloseTo(1, 5);
    expect(square[64]).toBeCloseTo(Math.sqrt(64 / 255), 5);
    expect(dotSizeTable('line')[128]).toBeCloseTo(128 / 255, 5);
  });

  it('builds a monotonic circle table up to full coverage', () => {
    const lut = dotSizeTable('circle');
    for (let i = 1; i < lut.length; i++) expect(lut[i]!).toBeGreaterThanOrEqual(lut[i - 1]!);
    /* 25 % coverage with isolated dots: πr² = 0.25 → r ≈ 0.282 */
    expect(lut[Math.round(0.25 * 255)]!).toBeCloseTo(Math.sqrt(0.25 / Math.PI), 1);
    expect(lut[255]!).toBeLessThanOrEqual(Math.SQRT1_2 + 1e-6);
  });

  it('separates with grey-component replacement', () => {
    const white = separate(255, 255, 255, 1, 1);
    expect(white.c + white.m + white.y + white.k).toBeCloseTo(0, 5);
    const black = separate(0, 0, 0, 1, 1);
    expect(black.k).toBeCloseTo(1, 5);
    expect(black.c).toBeCloseTo(0, 5);
    const red = separate(255, 0, 0, 1, 0);
    expect(red.c).toBeCloseTo(0, 5);
    expect(red.m).toBeCloseTo(1, 5);
    expect(red.y).toBeCloseTo(1, 5);
    expect(channelValue(black, 'mk')).toBeCloseTo(1, 5);
  });

  it('applies dot gain to midtones only', () => {
    expect(applyDotGain(0, 0.2)).toBe(0);
    expect(applyDotGain(1, 0.2)).toBe(1);
    expect(applyDotGain(0.5, 0.1)).toBeCloseTo(0.6, 5);
  });

  it('parses custom inks and rejects garbage', () => {
    expect(parseInks('[{"color":"#e8301f","angle":75,"channel":"m"}]')).toEqual([
      { color: '#e8301f', angle: 75, channel: 'm', offset: undefined, opacity: undefined },
    ]);
    expect(parseInks('not json')).toBeNull();
    expect(parseInks('[]')).toBeNull();
    expect(HALFTONE_PRESETS.cmyk.map((i) => i.angle)).toEqual([0, 75, 15, 45]);
  });
});

describe('k3-halftone — overlay (any content, unchanged)', () => {
  let el: K3Halftone;

  beforeEach(async () => {
    el = document.createElement('k3-halftone') as K3Halftone;
    el.innerHTML = '<div style="height:40px">Hello</div>';
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => el.remove());

  it('registers and renders a screen layer', () => {
    expect(customElements.get('k3-halftone')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('.screen')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('slot')).toBeTruthy();
  });

  it('reflects animated and tone', async () => {
    el.animated = true;
    el.tone = 'light';
    el.size = 12;
    el.intensity = 0.4;
    await el.updateComplete;
    expect(el.hasAttribute('animated')).toBe(true);
    expect(el.getAttribute('tone')).toBe('light');
    const screen = el.shadowRoot?.querySelector<HTMLElement>('.screen');
    expect(screen?.style.getPropertyValue('--k3-halftone-cell')).toBe('12px');
    expect(screen?.style.getPropertyValue('--k3-halftone-opacity')).toBe('0.4');
  });
});

describe('k3-halftone — print (screen-printed image)', () => {
  let el: K3Halftone;
  let stub: ReturnType<typeof fakeContext>;

  const mount = async (attrs: Record<string, string> = {}, taint = false) => {
    stub = fakeContext({ taint });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => stub.ctx as unknown as CanvasRenderingContext2D,
    );
    el = document.createElement('k3-halftone') as K3Halftone;
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const source = document.createElement('canvas');
    source.width = 80;
    source.height = 40;
    el.appendChild(source);
    document.body.appendChild(el);
    await el.updateComplete;
    await settle();
    await el.updateComplete;
    await settle();
  };

  afterEach(() => {
    el?.remove();
    vi.restoreAllMocks();
  });

  it('prints one plate per ink over the paper', async () => {
    const renders: Array<{ dots: number }> = [];
    document.addEventListener('k3-render', (e) => renders.push((e as CustomEvent).detail), { once: true });
    await mount({ preset: 'cmyk' });
    expect(el.shadowRoot!.querySelector('.print')).toBeTruthy();
    expect(el.shadowRoot!.querySelectorAll('canvas.plate').length).toBe(4);
    expect(el.shadowRoot!.querySelector('canvas.paper')).toBeTruthy();
    expect(renders[0]?.dots).toBeGreaterThan(0);
    /* one fill per plate — dots of an ink merge instead of darkening each other */
    expect(stub.calls.fill).toBe(4);
  });

  it('follows the preset / custom ink count', async () => {
    await mount({ preset: 'riso' });
    expect(el.shadowRoot!.querySelectorAll('canvas.plate').length).toBe(2);
    el.inks = '[{"color":"#111","angle":45,"channel":"luma"}]';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('canvas.plate').length).toBe(1);
  });

  it('labels the print with the image alt text', async () => {
    await mount({ alt: 'Harbour at dusk' });
    const print = el.shadowRoot!.querySelector('.print')!;
    expect(print.getAttribute('role')).toBe('img');
    expect(print.getAttribute('aria-label')).toBe('Harbour at dusk');
  });

  it('falls back to the overlay for cross-origin pixels', async () => {
    const errors: string[] = [];
    document.addEventListener('k3-error', (e) => errors.push((e as CustomEvent).detail.reason));
    await mount({}, true);
    await settle();
    await el.updateComplete;
    expect(errors).toContain('cross-origin');
    expect(el.shadowRoot!.querySelector('.screen')).toBeTruthy();
  });

  it('keeps overlay when mode="overlay" even with an image', async () => {
    await mount({ mode: 'overlay' });
    expect(el.shadowRoot!.querySelector('.print')).toBeNull();
    expect(el.shadowRoot!.querySelector('.screen')).toBeTruthy();
  });
});
