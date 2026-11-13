import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init } from '../../src/index.js';
import type { K3Rating } from '../../src/components/inputs/rating.js';

describe('k3-rating', () => {
  let host: HTMLElement;

  beforeEach(async () => {
    window.K3UI_MANUAL = true;
    await init();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
  });

  async function mount(html: string): Promise<K3Rating> {
    host.innerHTML = html;
    const el = host.querySelector('k3-rating') as K3Rating;
    await el.updateComplete;
    return el;
  }

  it('defaults to 5 stars · value 0', async () => {
    const el = await mount(`<k3-rating></k3-rating>`);
    expect(el.max).toBe(5);
    expect(el.getValue()).toBe(0);
  });

  it('clamps setValue within min…max', async () => {
    const el = await mount(`<k3-rating value="2" min="0" max="5"></k3-rating>`);
    el.setValue(9);
    expect(el.getValue()).toBe(5);
    el.setValue(-2);
    expect(el.getValue()).toBe(0);
  });

  it('snaps to step 0.5', async () => {
    const el = await mount(`<k3-rating value="0" step="0.5" max="5"></k3-rating>`);
    el.setValue(2.4);
    expect(el.getValue()).toBe(2.5);
    el.setValue(2.2);
    expect(el.getValue()).toBe(2);
  });

  it('emits k3-change on setValue', async () => {
    const el = await mount(`<k3-rating value="1"></k3-rating>`);
    const onChange = vi.fn();
    el.addEventListener('k3-change', onChange as EventListener);
    el.setValue(4);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(el.getValue()).toBe(4);
  });

  it('range input updates value and fires k3-input', async () => {
    const el = await mount(`<k3-rating value="1" max="5"></k3-rating>`);
    const onInput = vi.fn();
    el.addEventListener('k3-input', onInput as EventListener);
    const input = el.shadowRoot!.querySelector('input.native') as HTMLInputElement;
    input.value = '4';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await el.updateComplete;
    expect(el.getValue()).toBe(4);
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it('applies custom active / inactive colors as CSS vars', async () => {
    const el = await mount(
      `<k3-rating value="3" active-color="#f59e0b" inactive-color="#ccc"></k3-rating>`,
    );
    const wrap = el.shadowRoot!.querySelector('.wrap') as HTMLElement;
    expect(wrap.style.getPropertyValue('--k3-rating-active')).toBe('#f59e0b');
    expect(wrap.style.getPropertyValue('--k3-rating-inactive')).toBe('#ccc');
  });

  it('reflects color role and size', async () => {
    const el = await mount(`<k3-rating color="secondary" size="lg" value="2"></k3-rating>`);
    expect(el.getAttribute('color')).toBe('secondary');
    expect(el.getAttribute('size')).toBe('lg');
  });

  it('readonly keeps value but disables the native input', async () => {
    const el = await mount(`<k3-rating value="4" readonly></k3-rating>`);
    const input = el.shadowRoot!.querySelector('input.native') as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(el.getValue()).toBe(4);
  });
});
