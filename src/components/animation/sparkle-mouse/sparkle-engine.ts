/**
 * Pointer sparkle trail — canvas engine.
 *
 * Four-point stars are born along the pointer path, scatter, twinkle, drift
 * down and fade. Nothing runs while the pointer is still: the animation loop
 * only lives as long as a sparkle does.
 *
 * Original implementation for K3ux (no third-party code).
 */
import { prefersReducedMotion } from 'k3ui';
import { SparkleMouseSpecs } from './sparkle-mouse.specs.js';
import {
  intensityFactor,
  maxParticles,
  resolveSparkleColors,
  type NumberPair,
} from './sparkle-mouse.utils.js';

export interface SparkleEngineOptions {
  /** Percent, 0–100 (default 20). */
  intensity?: number;
  /** Palette — roles, CSS colours or `var(--x)`; any length. */
  colors?: readonly string[];
  /** Tip-to-tip length range, CSS px. */
  size?: NumberPair;
  /** Mean life, ms. */
  duration?: number;
  /** Scatter radius around the path, CSS px. */
  spread?: number;
  /** Downward pull, px / s². */
  gravity?: number;
  /** Also follow touch pointers (default: mouse and pen only). */
  touch?: boolean;
  /** Honor prefers-reduced-motion (default true). */
  disableForReducedMotion?: boolean;
  /** Fullscreen canvas z-index. */
  zIndex?: number;
  /** Element whose computed style resolves theme roles / `var()`. */
  themeSource?: Element | null;
  /** Return `false` to mute emission (hidden page, disabled host…). */
  canEmit?: () => boolean;
}

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  age: number;
  life: number;
  color: string;
  alpha: number;
  /** Twinkle phase offset. */
  phase: number;
}

type Config = Required<Omit<SparkleEngineOptions, 'themeSource' | 'canEmit' | 'colors'>> & {
  colors: readonly string[];
};

/** Theme roles are re-read at most this often (follows a live theme switch). */
const PALETTE_TTL_MS = 1000;
const MAX_DPR = 2;
const MAX_FRAME_MS = 50;

function createOverlay(zIndex: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-k3-sparkle-mouse', 'lib');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    margin: '0',
    padding: '0',
    pointerEvents: 'none',
    background: 'transparent',
  } as CSSStyleDeclaration);
  canvas.style.setProperty('z-index', String(zIndex), 'important');
  return canvas;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

export class SparkleEngine {
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly fullscreen: boolean;
  private config: Config;
  private themeSource: Element | null;
  private canEmit: () => boolean;
  private sparkles: Sparkle[] = [];
  private palette: string[] = [];
  private paletteAt = -Infinity;
  private raf = 0;
  private lastFrame = 0;
  private listening = false;
  private last: { x: number; y: number } | null = null;
  /** Fractional sparkles owed to the distance already travelled. */
  private carry = 0;
  private dpr = 1;
  private width = 0;
  private height = 0;

  /** `canvas` given → sparkles stay inside it; omitted → fixed overlay on `document.body`. */
  constructor(canvas: HTMLCanvasElement | null = null, options: SparkleEngineOptions = {}) {
    this.canvas = canvas;
    this.fullscreen = !canvas;
    this.themeSource = options.themeSource ?? null;
    this.canEmit = options.canEmit ?? (() => true);
    this.config = {
      intensity: SparkleMouseSpecs.intensity,
      colors: [],
      size: [...SparkleMouseSpecs.size],
      duration: SparkleMouseSpecs.duration,
      spread: SparkleMouseSpecs.spread,
      gravity: SparkleMouseSpecs.gravity,
      touch: SparkleMouseSpecs.behaviors.touch,
      disableForReducedMotion: SparkleMouseSpecs.behaviors.disableForReducedMotion,
      zIndex: SparkleMouseSpecs.zIndex,
    };
    this.configure(options);
  }

  configure(options: SparkleEngineOptions): void {
    const next = { ...this.config };
    for (const key of Object.keys(next) as (keyof Config)[]) {
      const value = options[key];
      if (value !== undefined) (next as Record<string, unknown>)[key] = value;
    }
    const [a, b] = next.size;
    next.size = [Math.max(1, Math.min(a, b)), Math.max(1, Math.max(a, b))];
    next.duration = Math.max(100, Number(next.duration) || SparkleMouseSpecs.duration);
    next.spread = Math.max(0, Number(next.spread) || 0);
    next.gravity = Number(next.gravity) || 0;
    this.config = next;
    if (options.themeSource !== undefined) this.themeSource = options.themeSource;
    if (options.canEmit) this.canEmit = options.canEmit;
    this.paletteAt = -Infinity;
    /* Lower intensity → trim the surplus now rather than waiting for it to fade. */
    const cap = maxParticles(this.config.intensity);
    if (this.sparkles.length > cap) this.sparkles.splice(0, this.sparkles.length - cap);
  }

  /** Number of sparkles on screen. */
  get count(): number {
    return this.sparkles.length;
  }

  /** `true` while the pointer is being followed. */
  get isRunning(): boolean {
    return this.listening;
  }

  /** Colours currently used (resolved theme roles included). */
  get colors(): string[] {
    return [...this.resolvePalette(performance.now())];
  }

  /** Follow the pointer. */
  start(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onMove, { passive: true });
    window.addEventListener('blur', this.onLeave);
    document.addEventListener('pointerleave', this.onLeave);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('resize', this.onResize, { passive: true });
  }

  /** Stop following; sparkles already born finish their life. */
  stop(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onMove);
    window.removeEventListener('blur', this.onLeave);
    document.removeEventListener('pointerleave', this.onLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onResize);
    this.last = null;
    this.carry = 0;
  }

  /** Remove every sparkle now. */
  clear(): void {
    this.sparkles.length = 0;
    this.cancelFrame();
    if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Stop, clear and remove the overlay canvas. */
  destroy(): void {
    this.stop();
    this.clear();
    if (this.fullscreen) this.canvas?.remove();
    if (this.fullscreen) this.canvas = null;
    this.ctx = null;
  }

  /**
   * Sparkles along a segment (viewport coordinates), as the pointer would
   * leave them. Returns how many were born.
   */
  emitAlong(x0: number, y0: number, x1: number, y1: number): number {
    if (!this.allowed()) return 0;
    const distance = Math.hypot(x1 - x0, y1 - y0);
    this.carry += distance * SparkleMouseSpecs.maxPerPx * intensityFactor(this.config.intensity);
    const n = Math.min(Math.floor(this.carry), SparkleMouseSpecs.maxPerMove);
    this.carry -= Math.floor(this.carry);
    if (n <= 0) return 0;
    /* Pointer speed feeds a little momentum into the sparkles. */
    const push = Math.min(1, distance / 60);
    const dx = distance ? (x1 - x0) / distance : 0;
    const dy = distance ? (y1 - y0) / distance : 0;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : i / (n - 1);
      this.spawn(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, dx * push * 40, dy * push * 40);
    }
    this.ensureFrame();
    return n;
  }

  /** `count` sparkles around a point (viewport coordinates) — clicks, celebrations. */
  burst(x: number, y: number, count = 24): number {
    if (!this.allowed(true)) return 0;
    const n = Math.max(0, Math.min(Math.floor(count), 400));
    for (let i = 0; i < n; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(20, 140);
      this.spawn(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, true);
    }
    if (n) this.ensureFrame();
    return n;
  }

  /** Advance the simulation by `dt` ms and draw (the loop calls this; tests can too). */
  step(dt: number): void {
    const seconds = Math.min(Math.max(dt, 0), MAX_FRAME_MS) / 1000;
    const { gravity } = this.config;
    let alive = 0;
    for (const s of this.sparkles) {
      s.age += seconds * 1000;
      if (s.age >= s.life) continue;
      s.vy += gravity * seconds;
      /* Light air drag keeps the scatter soft. */
      s.vx *= 1 - 0.9 * seconds;
      s.vy *= 1 - 0.35 * seconds;
      s.x += s.vx * seconds;
      s.y += s.vy * seconds;
      s.rotation += s.spin * seconds;
      this.sparkles[alive++] = s;
    }
    this.sparkles.length = alive;
    this.draw();
  }

  /* ── internals ─────────────────────────────────────────────────────── */

  private allowed(ignoreIntensity = false): boolean {
    if (typeof document === 'undefined') return false;
    if (!ignoreIntensity && intensityFactor(this.config.intensity) === 0) return false;
    if (this.config.disableForReducedMotion && prefersReducedMotion()) return false;
    return this.canEmit();
  }

  private resolvePalette(now: number): string[] {
    if (now - this.paletteAt > PALETTE_TTL_MS || !this.palette.length) {
      this.palette = resolveSparkleColors(this.config.colors, this.themeSource ?? document.documentElement);
      this.paletteAt = now;
    }
    return this.palette;
  }

  private spawn(px: number, py: number, vx: number, vy: number, forced = false): void {
    const cap = forced ? Math.max(maxParticles(this.config.intensity), 400) : maxParticles(this.config.intensity);
    if (this.sparkles.length >= cap) this.sparkles.shift();
    const palette = this.resolvePalette(performance.now());
    const { size, duration, spread } = this.config;
    /* Denser near the path, sparse at the rim. */
    const radius = spread * Math.random() ** 1.6;
    const angle = Math.random() * Math.PI * 2;
    const origin = this.toCanvas(px, py);
    this.sparkles.push({
      x: origin.x + Math.cos(angle) * radius,
      y: origin.y + Math.sin(angle) * radius,
      vx: vx + rand(-18, 18),
      vy: vy + rand(-22, 10),
      size: rand(size[0], size[1]),
      rotation: Math.random() * Math.PI,
      spin: rand(-1.2, 1.2),
      age: 0,
      life: duration * rand(0.65, 1.35),
      color: palette[Math.floor(Math.random() * palette.length)]!,
      alpha: rand(0.45, 1),
      phase: Math.random() * Math.PI * 2,
    });
  }

  /** Viewport point → canvas CSS-pixel space. */
  private toCanvas(x: number, y: number): { x: number; y: number } {
    if (this.fullscreen || !this.canvas) return { x, y };
    const rect = this.canvas.getBoundingClientRect();
    return { x: x - rect.left, y: y - rect.top };
  }

  private inside(x: number, y: number): boolean {
    if (this.fullscreen || !this.canvas) return true;
    const r = this.canvas.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  private onMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' && !this.config.touch) return;
    const { clientX: x, clientY: y } = event;
    if (!this.inside(x, y)) {
      this.last = null;
      return;
    }
    const from = this.last ?? { x, y };
    this.last = { x, y };
    this.emitAlong(from.x, from.y, x, y);
  };

  private onLeave = (): void => {
    this.last = null;
    this.carry = 0;
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.onLeave();
      this.cancelFrame();
    } else if (this.sparkles.length) this.ensureFrame();
  };

  private onResize = (): void => {
    this.width = 0;
  };

  private ensureCanvas(): CanvasRenderingContext2D | null {
    if (!this.canvas) {
      this.canvas = createOverlay(this.config.zIndex);
      this.ctx = null;
    }
    if (this.fullscreen && !this.canvas.isConnected) document.body.append(this.canvas);
    this.ctx ??= this.canvas.getContext('2d');
    if (this.ctx && !this.width) this.syncSize();
    return this.ctx;
  }

  private syncSize(): void {
    const canvas = this.canvas!;
    const rect = this.fullscreen ? null : canvas.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(rect?.width ?? window.innerWidth));
    this.height = Math.max(1, Math.floor(rect?.height ?? window.innerHeight));
    this.dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.round(this.width * this.dpr);
    const h = Math.round(this.height * this.dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }

  private draw(): void {
    const ctx = this.ensureCanvas();
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const inset = SparkleMouseSpecs.starInset;
    for (const s of this.sparkles) {
      const t = s.age / s.life;
      /* Pop in fast, fade out slowly, shimmer on the way. */
      const envelope = t < 0.18 ? t / 0.18 : 1 - (t - 0.18) / 0.82;
      const twinkle = 0.72 + 0.28 * Math.sin(s.phase + s.age * 0.012);
      const alpha = Math.max(0, envelope) * twinkle * s.alpha;
      if (alpha <= 0.01) continue;
      const outer = (s.size / 2) * (0.55 + 0.45 * Math.max(0, envelope));
      const inner = outer * inset;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = s.rotation + (i * Math.PI) / 4;
        const x = s.x + Math.cos(a) * r;
        const y = s.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private ensureFrame(): void {
    if (this.raf || typeof requestAnimationFrame !== 'function') return;
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private cancelFrame(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private frame = (now: number): void => {
    this.raf = 0;
    this.step(now - this.lastFrame);
    this.lastFrame = now;
    if (this.sparkles.length) this.raf = requestAnimationFrame(this.frame);
    else if (this.fullscreen) {
      /* Idle: leave no fullscreen layer behind. */
      this.canvas?.remove();
      this.width = 0;
    }
  };
}
