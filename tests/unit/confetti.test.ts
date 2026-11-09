import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/feedback/confetti.js';
import type { K3Confetti } from '../../src/components/feedback/confetti.js';
import {
  ConfettiCannon,
  ConfettiPresets,
  shapeFromPath,
} from '../../src/components/feedback/confetti.js';

describe('k3-confetti', () => {
  let el: K3Confetti;

  beforeEach(async () => {
    el = document.createElement('k3-confetti') as K3Confetti;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.reset();
    el.remove();
    document.querySelectorAll('body > canvas').forEach((c) => c.remove());
  });

  it('registers and exposes fire / presetFire / rain', async () => {
    expect(customElements.get('k3-confetti')).toBeTruthy();
    expect(typeof el.fire).toBe('function');
    expect(typeof el.presetFire).toBe('function');
    expect(typeof el.rain).toBe('function');
    expect(el.getAttribute('role')).toBe('presentation');
  });

  it('rain() emits start and schedules particles', async () => {
    const onStart = vi.fn();
    el.addEventListener('k3-confetti-start', onStart);
    el.rain({ count: 3, gravity: 0.9, duration: 0.2 });
    expect(onStart).toHaveBeenCalled();
    expect(ConfettiPresets.rain).toBeTypeOf('function');
    expect(ConfettiPresets.fireRain).toBeTypeOf('function');
  });

  it('fire() emits start and resolves (jsdom may skip paint)', async () => {
    const onStart = vi.fn();
    el.addEventListener('k3-confetti-start', onStart);
    await el.fire({
      particleCount: 2,
      ticks: 2,
      disableForReducedMotion: false,
    });
    expect(onStart).toHaveBeenCalled();
  });

  it('ConfettiCannon + presets are exported', () => {
    expect(ConfettiCannon).toBeTruthy();
    expect(typeof ConfettiPresets.fireBasic).toBe('function');
    const c = new ConfettiCannon(null, { resize: false, disableForReducedMotion: false });
    expect(typeof c.fire).toBe('function');
    expect(typeof c.warm).toBe('function');
    expect(typeof c.fireSpread).toBe('function');
    c.destroy();
  });

  it('keeps the lib canvas mounted across bursts', async () => {
    const c = new ConfettiCannon(null, { resize: false, disableForReducedMotion: false });
    c.warm();
    const canvases = () => document.body.querySelectorAll(':scope > canvas').length;
    const warmed = canvases();
    expect(warmed).toBeGreaterThan(0);
    await c.fire({ particleCount: 1, ticks: 2, disableForReducedMotion: false });
    expect(canvases()).toBe(warmed);
    await c.fire({ particleCount: 1, ticks: 2, disableForReducedMotion: false });
    expect(canvases()).toBe(warmed);
    c.destroy();
    expect(canvases()).toBe(0);
  });

  it('shapeFromPath throws or returns path shape when Path2D exists', () => {
    if (typeof Path2D !== 'function') return;
    const shape = shapeFromPath('M0 0 L10 0 L5 10 z');
    expect(shape.type).toBe('path');
    expect(shape.path).toContain('M0');
  });
});
