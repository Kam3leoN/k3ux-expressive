import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/scratch-card.js';
import type { K3ScratchCard } from '../../src/components/animation/scratch-card.js';
import { measureCleared } from '../../src/components/animation/scratch-card.engine.js';

class TestPointerEvent extends Event {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  button: number;
  constructor(type: string, init: Record<string, unknown> = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = (init.pointerId as number) ?? 1;
    this.pointerType = (init.pointerType as string) ?? 'touch';
    this.clientX = (init.clientX as number) ?? 0;
    this.clientY = (init.clientY as number) ?? 0;
    this.button = (init.button as number) ?? 0;
  }
}
if (typeof globalThis.PointerEvent === 'undefined') {
  (globalThis as unknown as { PointerEvent: typeof TestPointerEvent }).PointerEvent = TestPointerEvent;
}
if (typeof (globalThis as { Path2D?: unknown }).Path2D === 'undefined') {
  (globalThis as unknown as { Path2D: unknown }).Path2D = class {
    moveTo(): void {}
    lineTo(): void {}
  };
}

/** jsdom has no 2D canvas — a recording stub; `cleared` = share of erased pixels it reports */
function fakeContext(state: { cleared: number }) {
  const calls = { arc: 0, fill: 0, clearRect: 0 };
  const gradient = { addColorStop: () => {} };
  const ctx = {
    fillStyle: '#000',
    strokeStyle: '#000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    filter: 'none',
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    clearRect: () => void calls.clearRect++,
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    arc: () => void calls.arc++,
    fill: () => void calls.fill++,
    stroke: () => {},
    drawImage: () => {},
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData: () => {},
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(w * h * 4);
      const erased = Math.round(w * h * state.cleared);
      for (let i = erased; i < w * h; i++) data[i * 4 + 3] = 255;
      return { data };
    },
  };
  return { ctx, calls };
}

describe('scratch-card engine', () => {
  it('measures the share of fully erased pixels', () => {
    const { ctx } = fakeContext({ cleared: 0.25 });
    expect(measureCleared(ctx as unknown as CanvasRenderingContext2D, 20, 10)).toBeCloseTo(25, 5);
  });

  it('returns null when pixels cannot be read', () => {
    const ctx = {
      getImageData: () => {
        throw new DOMException('tainted', 'SecurityError');
      },
    };
    expect(measureCleared(ctx as unknown as CanvasRenderingContext2D, 4, 4)).toBeNull();
  });
});

describe('k3-scratch-card', () => {
  let el: K3ScratchCard;
  let state: { cleared: number };
  let calls: { arc: number; fill: number; clearRect: number };

  beforeEach(async () => {
    state = { cleared: 0 };
    const fake = fakeContext(state);
    calls = fake.calls;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake.ctx as unknown as CanvasRenderingContext2D);
    el = document.createElement('k3-scratch-card');
    el.innerHTML = '<img alt="You won" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />';
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 120 });
    document.body.append(el);
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0)); /* cover + brush load */
  });

  afterEach(() => {
    el.remove();
    vi.restoreAllMocks();
  });

  it('slots the content under a cover and a keyboard reveal button', () => {
    expect(customElements.get('k3-scratch-card')).toBeTruthy();
    const root = el.shadowRoot!;
    expect(root.querySelector('[part="content"] slot')).toBeTruthy();
    expect(root.querySelector('canvas[part="cover"]')).toBeTruthy();
    expect(root.querySelector('[part="content"]')!.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('[part="reveal"]')!.textContent!.trim()).toBe('Reveal all');
    expect(el.hasAttribute('data-ready')).toBe(true);
    expect(el.getAttribute('cover')).toBe('silver');
  });

  it('reveals once, with k3-scratch then k3-reveal', async () => {
    const events: string[] = [];
    el.addEventListener('k3-scratch', (e) => events.push(`scratch ${(e as CustomEvent).detail.percent}`));
    el.addEventListener('k3-reveal', (e) => events.push(`reveal ${(e as CustomEvent).detail.percent}`));
    el.reveal();
    el.reveal();
    await el.updateComplete;
    expect(events).toEqual(['scratch 100', 'reveal 100']);
    expect(el.revealed).toBe(true);
    expect(el.hasAttribute('revealed')).toBe(true);
    expect(el.percent).toBe(100);
    const root = el.shadowRoot!;
    expect(root.querySelector('[part="content"]')!.hasAttribute('aria-hidden')).toBe(false);
    expect((root.querySelector('[part="reveal"]') as HTMLButtonElement).hidden).toBe(true);
  });

  it('reveals from the keyboard button and from the revealed attribute', async () => {
    (el.shadowRoot!.querySelector('[part="reveal"]') as HTMLButtonElement).click();
    expect(el.revealed).toBe(true);
    el.reset();
    await el.updateComplete;
    expect(el.revealed).toBe(false);
    expect(el.percent).toBe(0);
    const revealed = vi.fn();
    el.addEventListener('k3-reveal', revealed);
    el.setAttribute('revealed', '');
    await el.updateComplete;
    expect(revealed).toHaveBeenCalledTimes(1);
  });

  it('scratches with the pointer and reveals past reveal-at on release', async () => {
    el.type = 'circle';
    await el.updateComplete;
    /* Synchronous frames, 20 ms apart */
    let clock = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      clock += 20;
      cb(clock);
      return 1;
    });
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    canvas.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 120 });
    const progress: number[] = [];
    el.addEventListener('k3-scratch', (e) => progress.push((e as CustomEvent).detail.percent));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 20, clientY: 20 }));
    state.cleared = 0.3;
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 60, clientY: 40 }));
    expect(calls.arc).toBeGreaterThan(0);
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 60, clientY: 40 }));
    expect(el.revealed).toBe(false); /* 30 % < 50 % */
    expect(progress.at(-1)).toBeCloseTo(30, 0);
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 20, clientY: 80, pointerId: 2 }));
    state.cleared = 0.6;
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 180, clientY: 80, pointerId: 2 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 180, clientY: 80, pointerId: 2 }));
    expect(el.revealed).toBe(true);
    expect(el.percent).toBe(100);
  });

  it('uses the localized engraved label unless one is given', () => {
    expect(el.label).toBeNull();
    el.label = '';
    expect(el.label).toBe('');
  });
});
