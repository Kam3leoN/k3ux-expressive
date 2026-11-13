import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/firework.js';
import type { K3Firework } from '../../src/components/animation/firework.js';
import { FireworkSpecs } from '../../src/components/animation/firework.js';

function stubCanvasContext(): void {
  const ctx = {
    canvas: document.createElement('canvas'),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    lineCap: 'round',
    shadowBlur: 0,
    shadowColor: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
}

describe('k3-firework', () => {
  let el: K3Firework;

  beforeEach(async () => {
    stubCanvasContext();
    el = document.createElement('k3-firework') as K3Firework;
    el.disableForReducedMotion = false;
    el.autoStart = false;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.reset();
    el.remove();
    document.querySelectorAll('.firework-root').forEach((n) => n.remove());
    document.getElementById('k3-firework-styles')?.remove();
    vi.restoreAllMocks();
  });

  it('registers with v1-aligned defaults', () => {
    expect(customElements.get('k3-firework')).toBeTruthy();
    expect(el.shell).toBe(FireworkSpecs.behaviors.shell);
    expect(el.quality).toBe(2);
    expect(el.size).toBe(3);
    expect(el.layer).toBe('front');
    expect(typeof el.launch).toBe('function');
    expect(typeof el.celebrate).toBe('function');
  });

  it('start / pause toggles running state', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    el.addEventListener('k3-firework-start', onStart);
    el.addEventListener('k3-firework-stop', onStop);
    el.start();
    expect(onStart).toHaveBeenCalled();
    expect(el.isRunning).toBe(true);
    el.pause();
    expect(onStop).toHaveBeenCalled();
    expect(el.isRunning).toBe(false);
  });

  it('launchBurst mounts a firework root', () => {
    el.launchBurst(2);
    expect(document.querySelector('.firework-root')).toBeTruthy();
  });

  it('celebrate starts the preset sequence', () => {
    const onLaunch = vi.fn();
    el.addEventListener('k3-firework-launch', onLaunch);
    el.celebrate();
    expect(onLaunch).toHaveBeenCalled();
    expect(el.getEngine().isPlayingSequence).toBe(true);
  });
});
