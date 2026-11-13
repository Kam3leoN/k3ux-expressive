/**
 * Color spectrum voice ring — original canvas engine for k3ux.
 *
 * Inspired by the public Voice Ring concept (glassy multi-ribbon spectrum that
 * reacts to voice level / state) — independent implementation, no third-party
 * package import.
 *
 * @see https://libraries.dev/voice-ring
 */

import {
  VoiceRingSpecs,
  type VoiceRingEmotion,
  type VoiceRingState,
  type VoiceRingTheme,
} from './voice-ring.specs.js';

export interface VoiceRingEngineOptions {
  size?: number;
  state?: VoiceRingState;
  emotion?: VoiceRingEmotion | null;
  direction?: number;
  sensitivity?: number;
  speed?: number;
  threshold?: number;
  release?: number;
  rings?: number;
  lean?: number;
  ringGap?: number;
  deform?: number;
  halo?: number;
  radius?: number;
  theme?: VoiceRingTheme;
  /** External level 0…1, or getter sampled every frame. */
  level?: number | (() => number);
  dpr?: number;
}

type Meter = {
  ctx: AudioContext;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  source: MediaStreamAudioSourceNode;
};

const TWO_PI = Math.PI * 2;

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Emotion tints for the spectrum (hue degrees / sat boost). */
function emotionBias(
  emotion: VoiceRingEmotion | null | undefined,
): { hueShift: number; sat: number; lit: number } {
  switch (emotion) {
    case 'positive':
      return { hueShift: -40, sat: 0.92, lit: 0.58 }; // greens / lime
    case 'calm':
      return { hueShift: 20, sat: 0.72, lit: 0.55 }; // teal / cyan
    case 'negative':
      return { hueShift: -110, sat: 0.88, lit: 0.52 }; // reds / magenta
    default:
      return { hueShift: 0, sat: 0.78, lit: 0.56 };
  }
}

function resolveThemeDark(theme: VoiceRingTheme): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof matchMedia === 'function') {
    return matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return true;
}

export class VoiceRingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: Required<
    Omit<VoiceRingEngineOptions, 'level'>
  > & { level?: number | (() => number) };

  private raf = 0;
  private running = false;
  private t0 = 0;
  private last = 0;
  private displayLevel = 0;
  private spin = 0;
  private breath = 0;
  private leanX = 0;
  private meter: Meter | null = null;
  private simPhase = 0;

  constructor(canvas: HTMLCanvasElement, options: VoiceRingEngineOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('VoiceRingEngine: 2d context unavailable');
    this.ctx = ctx;
    this.opts = {
      size: options.size ?? VoiceRingSpecs.size,
      state: options.state ?? VoiceRingSpecs.state,
      emotion: (options.emotion ?? VoiceRingSpecs.emotion) || ('' as VoiceRingEmotion),
      direction: options.direction ?? VoiceRingSpecs.direction,
      sensitivity: options.sensitivity ?? VoiceRingSpecs.sensitivity,
      speed: options.speed ?? VoiceRingSpecs.speed,
      threshold: options.threshold ?? VoiceRingSpecs.threshold,
      release: options.release ?? VoiceRingSpecs.release,
      rings: options.rings ?? VoiceRingSpecs.rings,
      lean: options.lean ?? VoiceRingSpecs.lean,
      ringGap: options.ringGap ?? VoiceRingSpecs.ringGap,
      deform: options.deform ?? VoiceRingSpecs.deform,
      halo: options.halo ?? VoiceRingSpecs.halo,
      radius: options.radius ?? VoiceRingSpecs.radius,
      theme: options.theme ?? VoiceRingSpecs.theme,
      dpr:
        options.dpr ??
        (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1),
      level: options.level,
    };
    this.resize(this.opts.size);
  }

  configure(patch: Partial<VoiceRingEngineOptions>): void {
    Object.assign(this.opts, patch);
    if (patch.size != null) this.resize(patch.size);
  }

  setState(state: VoiceRingState): void {
    this.opts.state = state;
  }

  setLevel(level: number | (() => number) | undefined): void {
    this.opts.level = level;
  }

  setEmotion(emotion: VoiceRingEmotion | null | undefined): void {
    this.opts.emotion = (emotion ?? '') as VoiceRingEmotion;
  }

  setDirection(direction: number): void {
    this.opts.direction = clamp(direction, -1, 1);
  }

  /** Attach a MediaStream (mic) — analysed via Web Audio RMS. */
  async attachStream(stream: MediaStream): Promise<void> {
    this.detachStream();
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.72;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    this.meter = {
      ctx,
      analyser,
      data: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
      source,
    };
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  }

  detachStream(): void {
    if (!this.meter) return;
    try {
      this.meter.source.disconnect();
    } catch {
      /* already disconnected */
    }
    void this.meter.ctx.close().catch(() => undefined);
    this.meter = null;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.t0 = performance.now();
    this.last = this.t0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  destroy(): void {
    this.stop();
    this.detachStream();
  }

  get isRunning(): boolean {
    return this.running;
  }

  get level(): number {
    return this.displayLevel;
  }

  private resize(cssSize: number): void {
    const dpr = this.opts.dpr;
    const px = Math.max(1, Math.round(cssSize * dpr));
    if (this.canvas.width !== px || this.canvas.height !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    this.canvas.style.width = `${cssSize}px`;
    this.canvas.style.height = `${cssSize}px`;
  }

  private sampleRawLevel(dt: number): number {
    const { level, sensitivity, threshold } = this.opts;

    if (typeof level === 'function') {
      return clamp(level(), 0, 1);
    }
    if (typeof level === 'number' && Number.isFinite(level)) {
      return clamp(level, 0, 1);
    }

    if (this.meter) {
      const { analyser, data } = this.meter;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i]! - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const gated = Math.max(0, rms - threshold);
      return clamp(gated * sensitivity * 4.2, 0, 1);
    }

    /* Soft simulated pulse when no source (demo / idle preview). */
    this.simPhase += dt * 0.0018 * this.opts.speed;
    const pulse =
      0.12 +
      0.1 * Math.sin(this.simPhase * 2.1) +
      0.06 * Math.sin(this.simPhase * 5.3 + 1.2);
    if (this.opts.state === 'idle') return pulse * 0.35;
    if (this.opts.state === 'processing') return 0.45 + pulse * 0.25;
    return pulse;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(48, now - this.last);
    this.last = now;
    const elapsed = (now - this.t0) * 0.001 * this.opts.speed;

    const raw = this.sampleRawLevel(dt);
    const attack = this.opts.state === 'processing' ? 0.18 : 0.28;
    const release = this.opts.release;
    const alpha = raw > this.displayLevel ? attack : release;
    this.displayLevel = lerp(this.displayLevel, raw, 1 - Math.pow(1 - alpha, dt / 16));

    const targetLean = this.opts.direction * this.opts.lean * smoothstep(this.displayLevel * 1.4);
    this.leanX = lerp(this.leanX, targetLean, 1 - Math.pow(0.86, dt / 16));

    if (this.opts.state === 'processing') {
      this.spin += dt * 0.0022 * this.opts.speed * (1.1 + this.displayLevel);
    } else if (this.opts.state === 'listening' || this.opts.state === 'speaking') {
      this.spin += dt * 0.00055 * this.opts.speed * (0.4 + this.displayLevel);
    } else {
      this.spin += dt * 0.00022 * this.opts.speed;
    }

    this.breath = 0.5 + 0.5 * Math.sin(elapsed * (this.opts.state === 'idle' ? 1.1 : 1.7));

    this.paint(elapsed);
    this.raf = requestAnimationFrame(this.frame);
  };

  private paint(elapsed: number): void {
    const { ctx, canvas, opts } = this;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w * 0.5 + this.leanX * w * 0.12;
    const cy = h * 0.5;
    const dark = resolveThemeDark(opts.theme);
    const level = this.displayLevel;
    const bias = emotionBias(opts.emotion);
    const baseR = Math.min(w, h) * 0.5 * opts.radius;
    const deform = opts.deform * (0.55 + level * 0.9);
    const ringCount = Math.max(2, Math.round(opts.rings));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);

    /* Soft outer halo */
    const haloR = baseR * (1.35 + level * 0.35 + this.breath * 0.04);
    const halo = ctx.createRadialGradient(cx, cy, baseR * 0.55, cx, cy, haloR);
    const haloA = (dark ? 0.22 : 0.14) * opts.halo * (0.45 + level);
    halo.addColorStop(0, `hsla(${200 + bias.hueShift}, ${bias.sat * 100}%, ${bias.lit * 100}%, 0)`);
    halo.addColorStop(
      0.55,
      `hsla(${280 + bias.hueShift * 0.4}, ${bias.sat * 90}%, ${bias.lit * 110}%, ${haloA})`,
    );
    halo.addColorStop(1, `hsla(0,0%,0%,0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, TWO_PI);
    ctx.fill();

    const breathScale =
      opts.state === 'idle'
        ? 1 + this.breath * 0.018
        : 1 + level * 0.04 + this.breath * 0.01;

    for (let i = 0; i < ringCount; i++) {
      const t = i / Math.max(1, ringCount - 1);
      const gap = opts.ringGap * Math.min(w, h);
      const r = (baseR - i * gap * 3.2) * breathScale;
      if (r < 8) continue;

      const lineW =
        Math.max(1.2, (3.2 - i * 0.28) * (opts.dpr || 1)) *
        (opts.state === 'speaking' ? 1.15 : 1);
      const alpha =
        (dark ? 0.92 : 0.78) * (1 - t * 0.35) * (0.55 + level * 0.45);

      ctx.beginPath();
      const steps = 96;
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * TWO_PI + this.spin * (1 - t * 0.35);
        const wave =
          Math.sin(a * 3 + elapsed * 2.2 + i) * 0.35 +
          Math.sin(a * 7 - elapsed * 1.4 + i * 0.7) * 0.2;
        const pulse =
          opts.state === 'processing'
            ? 0.55 + 0.45 * Math.sin(a * 2 - this.spin * 4 + i)
            : level;
        const rr = r * (1 + wave * deform * 0.035 * (0.35 + pulse));
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      const hues = [
        200 + bias.hueShift,
        260 + bias.hueShift * 0.6,
        320 + bias.hueShift * 0.3,
        40 + bias.hueShift * 0.2,
        160 + bias.hueShift,
      ];
      const stops = hues.length - 1;
      for (let hIdx = 0; hIdx <= stops; hIdx++) {
        const hue = hues[hIdx]! + this.spin * 40 + t * 25;
        grad.addColorStop(
          hIdx / stops,
          `hsla(${((hue % 360) + 360) % 360}, ${bias.sat * 100}%, ${bias.lit * 100}%, ${alpha})`,
        );
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = lineW;
      ctx.lineJoin = 'round';
      ctx.shadowColor = `hsla(${220 + bias.hueShift}, 90%, 60%, ${0.25 * opts.halo})`;
      ctx.shadowBlur = 8 * opts.dpr * (0.5 + level);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    /* Inner glass disc */
    const inner = baseR * 0.42 * breathScale;
    const glass = ctx.createRadialGradient(cx - inner * 0.25, cy - inner * 0.3, 0, cx, cy, inner);
    glass.addColorStop(0, dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.35)');
    glass.addColorStop(0.45, dark ? 'rgba(180,200,255,0.06)' : 'rgba(255,255,255,0.12)');
    glass.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, TWO_PI);
    ctx.fill();

    /* Processing highlight tick */
    if (opts.state === 'processing') {
      const a = this.spin * 3.2;
      const rr = baseR * breathScale;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      const tick = ctx.createRadialGradient(x, y, 0, x, y, 14 * opts.dpr);
      tick.addColorStop(0, `hsla(${50 + bias.hueShift}, 100%, 75%, 0.95)`);
      tick.addColorStop(1, 'hsla(0,0%,100%,0)');
      ctx.fillStyle = tick;
      ctx.beginPath();
      ctx.arc(x, y, 14 * opts.dpr, 0, TWO_PI);
      ctx.fill();
    }
  }
}

export default VoiceRingEngine;
