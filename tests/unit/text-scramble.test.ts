import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/text-scramble.js';
import type { K3TextScramble } from '../../src/components/animation/text-scramble.js';

describe('k3-text-scramble', () => {
  let el: K3TextScramble;

  beforeEach(async () => {
    el = document.createElement('k3-text-scramble') as K3TextScramble;
    el.autoplay = false;
    el.text = 'Hi';
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.stop();
    el.remove();
  });

  it('registers and renders text in a single stage node', async () => {
    expect(customElements.get('k3-text-scramble')).toBeTruthy();
    await el.updateComplete;
    const stage = el.shadowRoot?.querySelector('.stage');
    expect(stage?.textContent).toContain('Hi');
    expect(el.shadowRoot?.querySelectorAll('.char').length ?? 0).toBe(0);
  });

  it('exposes play / stop / restart', async () => {
    expect(typeof el.play).toBe('function');
    expect(typeof el.stop).toBe('function');
    expect(typeof el.restart).toBe('function');
    const p = el.play('Yo');
    el.stop();
    await p.catch(() => undefined);
  });

  it('accepts char presets', async () => {
    el.chars = 'braille';
    await el.updateComplete;
    expect(el.chars).toBe('braille');
    el.chars = 'blocks';
    el.chars = 'numbers';
    await el.play('42');
    el.stop();
  });

  it('skips motion when reduced-motion is preferred', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
    );
    await el.play('Hi');
    expect(el.shadowRoot?.textContent).toContain('H');
    vi.unstubAllGlobals();
  });
});
