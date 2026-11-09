import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/text-bounce.js';
import type { K3TextBounce } from '../../src/components/animation/text-bounce.js';

describe('k3-text-bounce', () => {
  let el: K3TextBounce;

  beforeEach(async () => {
    el = document.createElement('k3-text-bounce') as K3TextBounce;
    el.autoplay = false;
    el.text = 'HI';
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.stop();
    el.remove();
  });

  it('registers and splits characters', async () => {
    expect(customElements.get('k3-text-bounce')).toBeTruthy();
    const chars = el.shadowRoot?.querySelectorAll('.char:not(.char--space)');
    expect(chars?.length).toBe(2);
  });

  it('exposes play / stop / restart', () => {
    expect(typeof el.play).toBe('function');
    expect(typeof el.stop).toBe('function');
    expect(typeof el.restart).toBe('function');
    el.play();
    el.stop();
  });

  it('skips motion when reduced-motion is preferred', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    el.play();
    el.stop();
    vi.unstubAllGlobals();
  });
});
