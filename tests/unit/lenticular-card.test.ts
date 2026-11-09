import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/lenticular-card.js';
import type { K3LenticularCard } from '../../src/components/animation/lenticular-card.js';

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

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

describe('k3-lenticular-card', () => {
  let el: K3LenticularCard;

  beforeEach(async () => {
    /* Reduced motion: views switch at once — deterministic */
    document.documentElement.setAttribute('data-k3-reduce-motion', '');
    el = document.createElement('k3-lenticular-card');
    el.innerHTML = `<img alt="Day" src="${GIF}" /><img alt="Night" src="${GIF}" />`;
    document.body.append(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
    document.documentElement.removeAttribute('data-k3-reduce-motion');
    vi.restoreAllMocks();
  });

  it('routes each child to its own view slot', () => {
    expect(customElements.get('k3-lenticular-card')).toBeTruthy();
    const [day, night] = Array.from(el.children);
    expect(day!.getAttribute('slot')).toBe('frame-0');
    expect(night!.getAttribute('slot')).toBe('frame-1');
    const frames = el.shadowRoot!.querySelectorAll('[part="frame"] slot');
    expect(Array.from(frames, (s) => s.getAttribute('name'))).toEqual(['frame-0', 'frame-1']);
    expect(el.shadowRoot!.querySelector('[part="lens"]')).toBeTruthy();
  });

  it('is a focusable group named after the visible view', () => {
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-roledescription')).toBe('lenticular image');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('aria-label')).toBe('Day');
    expect(el.index).toBe(0);
  });

  it('switches views with the arrow keys and announces them', async () => {
    const changes: unknown[] = [];
    el.addEventListener('k3-change', (e) => changes.push((e as CustomEvent).detail));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await el.updateComplete;
    expect(el.index).toBe(1);
    expect(changes).toEqual([{ index: 1, label: 'Night' }]);
    expect(el.getAttribute('aria-label')).toBe('Night');
    expect(el.shadowRoot!.querySelector('.status')!.textContent).toBe('View 2 of 2: Night');
    const second = el.shadowRoot!.querySelectorAll<HTMLElement>('.frame')[1]!;
    expect(second.style.getPropertyValue('--k3-lenticular-reveal')).toBe('1.000');
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(el.index).toBe(0);
    expect(second.style.getPropertyValue('--k3-lenticular-reveal')).toBe('0.000');
  });

  it('follows the pointer across the card', () => {
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 200, height: 280 }));
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 190, clientY: 140 }));
    expect(el.index).toBe(1);
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 140 }));
    expect(el.index).toBe(0);
  });

  it('takes new children as views', async () => {
    const dusk = document.createElement('img');
    dusk.alt = 'Dusk';
    dusk.src = GIF;
    el.append(dusk);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(dusk.getAttribute('slot')).toBe('frame-2');
    expect(el.shadowRoot!.querySelectorAll('[part="frame"]').length).toBe(3);
  });

  it('can leave the keyboard alone', async () => {
    el.setAttribute('keyboard', 'false');
    await el.updateComplete;
    expect(el.hasAttribute('tabindex')).toBe(false);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(el.index).toBe(0);
  });
});
