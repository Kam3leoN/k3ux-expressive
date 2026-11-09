import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/holo-card.js';
import type { K3HoloCard } from '../../src/components/animation/holo-card.js';

/** jsdom may lack PointerEvent — minimal polyfill for unit tests */
class TestPointerEvent extends Event {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  constructor(type: string, init: Record<string, unknown> = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = (init.pointerId as number) ?? 1;
    this.pointerType = (init.pointerType as string) ?? 'mouse';
    this.clientX = (init.clientX as number) ?? 0;
    this.clientY = (init.clientY as number) ?? 0;
  }
}
if (typeof globalThis.PointerEvent === 'undefined') {
  (globalThis as unknown as { PointerEvent: typeof TestPointerEvent }).PointerEvent = TestPointerEvent;
}

const fire = (el: Element, type: string, init: Record<string, unknown> = {}) =>
  el.dispatchEvent(new PointerEvent(type, { pointerType: 'mouse', ...init }));

describe('k3-holo-card', () => {
  let el: K3HoloCard;

  beforeEach(async () => {
    /* Reduced motion: springs jump to their target — deterministic */
    document.documentElement.setAttribute('data-k3-reduce-motion', '');
    el = document.createElement('k3-holo-card');
    el.innerHTML = '<img alt="Aurora crystal" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />';
    document.body.append(el);
    await el.updateComplete;
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 280 }));
  });

  afterEach(() => {
    el.remove();
    document.documentElement.removeAttribute('data-k3-reduce-motion');
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('slots the artwork and exposes card, shine and glare parts', () => {
    expect(customElements.get('k3-holo-card')).toBeTruthy();
    const root = el.shadowRoot!;
    expect(root.querySelector('slot')).toBeTruthy();
    for (const part of ['card', 'shine', 'glare']) expect(root.querySelector(`[part="${part}"]`), part).toBeTruthy();
    expect(el.getAttribute('effect')).toBe('prism');
    expect(el.style.getPropertyValue('--k3-holo-seed-x')).not.toBe('');
  });

  it('lights the foil where the pointer is, without tilting under reduced motion', () => {
    fire(el, 'pointermove', { clientX: 200, clientY: 0 });
    expect(el.hasAttribute('data-active')).toBe(true);
    expect(el.style.getPropertyValue('--k3-holo-pointer-x')).toBe('100.00%');
    expect(el.style.getPropertyValue('--k3-holo-pointer-y')).toBe('0.00%');
    expect(el.style.getPropertyValue('--k3-holo-opacity')).toBe('1.000');
    expect(el.style.getPropertyValue('--k3-holo-pointer-from-center')).toBe('1.000');
    expect(el.style.getPropertyValue('--k3-holo-rotate-y')).toBe('0.00deg');
  });

  it('settles back once the pointer leaves (a click does not count)', () => {
    vi.useFakeTimers();
    fire(el, 'pointermove', { clientX: 150, clientY: 70 });
    fire(el, 'pointerup', { clientX: 150, clientY: 70 });
    vi.advanceTimersByTime(1000);
    expect(el.hasAttribute('data-active')).toBe(true);
    fire(el, 'pointerleave');
    vi.advanceTimersByTime(el.resetDelay + 10);
    expect(el.hasAttribute('data-active')).toBe(false);
    expect(el.style.getPropertyValue('--k3-holo-opacity')).toBe('0.000');
    expect(el.style.getPropertyValue('--k3-holo-pointer-x')).toBe('50.00%');
  });

  it('tilts toward the pointer when motion is allowed', async () => {
    document.documentElement.removeAttribute('data-k3-reduce-motion');
    /* Run the spring to completion synchronously */
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      now += 16;
      queueMicrotask(() => cb(now));
      return 1;
    });
    fire(el, 'pointermove', { clientX: 200, clientY: 140 });
    await new Promise((r) => setTimeout(r, 50));
    expect(parseFloat(el.style.getPropertyValue('--k3-holo-rotate-y'))).toBeLessThan(-14);
    expect(Math.abs(parseFloat(el.style.getPropertyValue('--k3-holo-rotate-x')))).toBeLessThan(0.5);
  });

  it('reports device tilt as unavailable without a sensor', async () => {
    expect(await el.enableMotion()).toBe(false);
    expect(el.motionActive).toBe(false);
  });
});
