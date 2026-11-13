import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/animation/voice-ring.js';
import type { K3VoiceRing } from '../../src/components/animation/voice-ring.js';
import { VoiceRingSpecs } from '../../src/components/animation/voice-ring.js';

function stubCanvasContext(): void {
  const ctx = {
    canvas: document.createElement('canvas'),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 1,
    lineJoin: 'round',
    shadowColor: '',
    shadowBlur: 0,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
}

describe('k3-voice-ring', () => {
  let el: K3VoiceRing;

  beforeEach(async () => {
    stubCanvasContext();
    el = document.createElement('k3-voice-ring') as K3VoiceRing;
    el.disableForReducedMotion = false;
    el.autoStart = false;
    document.body.appendChild(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.teardown();
    el.remove();
    vi.restoreAllMocks();
  });

  it('registers with color-ring defaults (no mono)', () => {
    expect(customElements.get('k3-voice-ring')).toBeTruthy();
    expect(el.size).toBe(VoiceRingSpecs.size);
    expect(el.state).toBe('idle');
    expect(el.rings).toBe(6);
    expect(typeof el.listen).toBe('function');
    expect(typeof el.setLevel).toBe('function');
  });

  it('start / stop toggles the loop', () => {
    const onStart = vi.fn();
    const onStop = vi.fn();
    el.addEventListener('k3-voice-ring-start', onStart);
    el.addEventListener('k3-voice-ring-stop', onStop);
    el.start();
    expect(onStart).toHaveBeenCalled();
    expect(el.isRunning).toBe(true);
    el.stop();
    expect(onStop).toHaveBeenCalled();
    expect(el.isRunning).toBe(false);
  });

  it('setLevel drives an external meter', () => {
    el.setLevel(0.7);
    el.start();
    expect(el.level).toBe(0.7);
    el.setLevel(() => 0.2);
    expect(typeof el.level).toBe('function');
  });

  it('state and emotion update the engine', async () => {
    el.start();
    el.state = 'processing';
    el.emotion = 'calm';
    el.direction = -0.5;
    await el.updateComplete;
    expect(el.state).toBe('processing');
    expect(el.emotion).toBe('calm');
    expect(el.getEngine().isRunning).toBe(true);
  });
});
