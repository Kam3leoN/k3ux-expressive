import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { init } from '../../src/bootstrap/init.js';
import {
  formatCountdownTime,
  msToCountdownTime,
  parseCountdownFormat,
} from '../../src/components/feedback/countdown.specs.js';
import type { K3Countdown } from '../../src/components/feedback/countdown.js';

describe('countdown specs', () => {
  it('formats HH : mm : ss', () => {
    const t = msToCountdownTime(3661000);
    expect(formatCountdownTime('HH : mm : ss', t)).toBe('01 : 01 : 01');
  });

  it('parses segment tokens', () => {
    const parts = parseCountdownFormat('HH : mm : ss');
    expect(parts.filter((p) => p.kind === 'unit').map((p) => (p.kind === 'unit' ? p.unit : ''))).toEqual([
      'HH',
      'mm',
      'ss',
    ]);
  });
});

describe('k3-countdown', () => {
  let host: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers();
    window.K3UI_MANUAL = true;
    await import('../../src/components/feedback/countdown.js');
    await init();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    host.remove();
    vi.useRealTimers();
  });

  async function mount(markup: string): Promise<K3Countdown> {
    host.innerHTML = markup;
    const el = host.querySelector('k3-countdown') as K3Countdown;
    await el.updateComplete;
    return el;
  }

  it('counts down from time and emits k3-end', async () => {
    const el = await mount(
      `<k3-countdown time="3000" auto-start format="ss"></k3-countdown>`,
    );
    const changes: number[] = [];
    el.addEventListener('k3-change', ((e: Event) => {
      changes.push((e as CustomEvent<{ remaining: number }>).detail.remaining);
    }) as EventListener);
    const onEnd = vi.fn();
    el.addEventListener('k3-end', onEnd);

    vi.advanceTimersByTime(3100);
    await el.updateComplete;

    expect(el.getRemainingTime()).toBe(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(changes.length).toBeGreaterThan(0);
  });

  it('pause and reset restore initial duration', async () => {
    const el = await mount(`<k3-countdown time="5000" auto-start></k3-countdown>`);
    vi.advanceTimersByTime(2000);
    await el.updateComplete;
    el.pause();
    const paused = el.getRemainingTime();
    expect(paused).toBeLessThan(5000);
    el.reset();
    await el.updateComplete;
    expect(el.getRemainingTime()).toBe(5000);
  });

  it('auto-starts by default when auto-start attribute is omitted', async () => {
    const el = await mount(`<k3-countdown time="5000" format="ss"></k3-countdown>`);
    expect(el.autoStart).toBe(true);
    vi.advanceTimersByTime(1500);
    await el.updateComplete;
    expect(el.getRemainingTime()).toBeLessThan(5000);
  });

  it('tracks end-date and restarts when the date changes', async () => {
    const el = await mount(
      `<k3-countdown end-date="${new Date(Date.now() + 10_000).toISOString()}" format="ss"></k3-countdown>`,
    );
    expect(el.getRemainingTime()).toBeGreaterThan(0);
    el.endDate = new Date(Date.now() + 60_000).toISOString();
    await el.updateComplete;
    expect(el.getRemainingTime()).toBeGreaterThan(50_000);
  });
});
