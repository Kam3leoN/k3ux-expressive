import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init } from '../../src/bootstrap/init.js';
import type { K3WheelPicker } from '../../src/components/pickers/wheel-picker.js';

describe('k3-wheel-picker', () => {
  let host: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    window.K3UI_MANUAL = true;
    await import('../../src/components/pickers/wheel-picker.js');
    await init();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    vi.useRealTimers();
  });

  async function mount(markup: string): Promise<K3WheelPicker> {
    host.innerHTML = markup;
    const el = host.querySelector('k3-wheel-picker') as K3WheelPicker;
    await el.updateComplete;
    vi.runAllTimers();
    await el.updateComplete;
    return el;
  }

  it('initializes value across columns', async () => {
    const el = await mount(
      `<k3-wheel-picker length="3" value="CAT" allowed-chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ"></k3-wheel-picker>`,
    );
    expect(el.getValue()).toBe('CAT');
  });

  it('cycles with down button and emits k3-change', async () => {
    const el = await mount(
      `<k3-wheel-picker length="1" value="A" allowed-chars="AB" show-preview="false" show-submit-button="false"></k3-wheel-picker>`,
    );
    const onChange = vi.fn();
    el.addEventListener('k3-change', onChange as EventListener);
    const down = el.shadowRoot!.querySelector('.btn--down') as HTMLButtonElement;
    down.click();
    vi.advanceTimersByTime(400);
    await el.updateComplete;
    expect(el.getValue()).toBe('B');
    expect(onChange).toHaveBeenCalled();
  });

  it('submit emits k3-submit and shows saved state', async () => {
    const el = await mount(
      `<k3-wheel-picker length="2" value="AB" show-preview="false" submit-text="Go" submitted-text="Done"></k3-wheel-picker>`,
    );
    const onSubmit = vi.fn();
    el.addEventListener('k3-submit', onSubmit as EventListener);
    const submit = el.shadowRoot!.querySelector('[part="submit"]') as HTMLButtonElement;
    submit.click();
    await el.updateComplete;
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { value: 'AB' } }),
    );
    expect(el.hasAttribute('saved')).toBe(true);
    el.resetSaved();
    expect(el.hasAttribute('saved')).toBe(false);
  });
});
