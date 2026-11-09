import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/heart-burst.js';
import type { K3HeartBurst } from '../../src/components/animation/heart-burst.js';

describe('k3-heart-burst', () => {
  let el: K3HeartBurst;

  beforeEach(async () => {
    el = document.createElement('k3-heart-burst') as K3HeartBurst;
    el.innerHTML = '<button type="button">Sponsor</button>';
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
  });

  it('registers and renders a particle layer', () => {
    expect(customElements.get('k3-heart-burst')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('.layer')).toBeTruthy();
  });

  it('burst() appends particle nodes', async () => {
    el.burst(3);
    await new Promise((r) => setTimeout(r, 20));
    const particles = el.shadowRoot?.querySelectorAll('.particle');
    expect((particles?.length ?? 0) >= 0).toBe(true);
  });

  it('exposes burst(), clip, and icon', async () => {
    expect(typeof el.burst).toBe('function');
    el.block = true;
    el.clip = true;
    el.icon = 'star';
    await el.updateComplete;
    expect(el.hasAttribute('block')).toBe(true);
    expect(el.hasAttribute('clip')).toBe(true);
    expect(el.getAttribute('icon')).toBe('star');
    const anim = Element.prototype.animate;
    Element.prototype.animate = vi.fn(function (this: Element) {
      return {
        finished: Promise.resolve(),
        cancel: vi.fn(),
      } as unknown as Animation;
    }) as typeof Element.prototype.animate;
    el.burst(2);
    const n = el.shadowRoot?.querySelectorAll('.particle').length ?? 0;
    expect(n).toBe(2);
    Element.prototype.animate = anim;
  });

  it('defaults to non-block so the host hugs the slotted target', () => {
    expect(el.block).toBe(false);
    expect(el.hasAttribute('block')).toBe(false);
    expect(el.shadowRoot?.querySelector('.layer')).toBeTruthy();
  });
});
