/**
 * Continuous snowfall canvas engine — independent port of react-snowfall
 * SnowfallCanvas + fullscreen/host split (same model as confetti).
 *
 * @see https://cahilfoley.github.io/react-snowfall/
 * @see https://github.com/cahilfoley/react-snowfall
 * @see ./NOTICE.md
 */

import { prefersReducedMotion } from 'k3ui';
import { SnowSpecs } from './snow.specs.js';
import { Snowflake, type SnowflakeConfig } from './snowflake.js';
import {
  resolveSnowColor,
  targetFrameTime,
  type NumberPair,
} from './snow.utils.js';

export interface SnowEngineOptions extends SnowflakeConfig {
  /** Honor prefers-reduced-motion (default true). */
  disableForReducedMotion?: boolean;
  /** Number of snowflakes (default 150). */
  snowflakeCount?: number;
  /** Fullscreen canvas z-index. */
  zIndex?: number;
  resize?: boolean;
}

function getLibCanvas(zIndex: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('data-k3-snow', 'lib');
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

/** Size buffer to CSS box (react-snowfall style — no DPR upscale). */
function syncCanvasSize(canvas: HTMLCanvasElement, fullscreen: boolean): void {
  let w: number;
  let h: number;
  if (fullscreen) {
    w = window.innerWidth;
    h = window.innerHeight;
  } else {
    const parent = canvas.parentElement;
    const rect = parent?.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect?.width ?? canvas.clientWidth ?? 1));
    h = Math.max(1, Math.floor(rect?.height ?? canvas.clientHeight ?? 1));
  }
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}

/**
 * Imperative snow field (fullscreen lib canvas, or custom HTMLCanvasElement).
 */
export class SnowEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private readonly isLibCanvas: boolean;
  private readonly allowResize: boolean;
  private disableForReducedMotion: boolean;
  private readonly zIndex: number;
  private config: Required<
    Pick<
      SnowEngineOptions,
      | 'color'
      | 'radius'
      | 'speed'
      | 'wind'
      | 'changeFrequency'
      | 'rotationSpeed'
      | 'opacity'
      | 'enable3DRotation'
      | 'snowflakeCount'
    >
  > & { images?: CanvasImageSource[] };
  private snowflakes: Snowflake[] = [];
  private running = false;
  private raf = 0;
  private lastUpdate = 0;
  private hasResizeEventRegistered = false;
  private readonly onResize = (): void => {
    this.ensureSized();
  };

  constructor(
    host: HTMLElement | HTMLCanvasElement | null = null,
    options: SnowEngineOptions = {},
  ) {
    this.isLibCanvas = !(host instanceof HTMLCanvasElement);
    if (!this.isLibCanvas) this.canvas = host as HTMLCanvasElement;
    this.allowResize = options.resize !== false;
    this.disableForReducedMotion =
      options.disableForReducedMotion ??
      SnowSpecs.behaviors.disableForReducedMotion;
    this.zIndex = options.zIndex ?? SnowSpecs.zIndex;
    this.config = this.mergeConfig(options);
  }

  private mergeConfig(partial: SnowEngineOptions): typeof this.config {
    return {
      color: partial.color ?? SnowSpecs.color,
      radius: (partial.radius ?? [...SnowSpecs.radius]) as NumberPair,
      speed: (partial.speed ?? [...SnowSpecs.speed]) as NumberPair,
      wind: (partial.wind ?? [...SnowSpecs.wind]) as NumberPair,
      changeFrequency: partial.changeFrequency ?? SnowSpecs.changeFrequency,
      rotationSpeed: (partial.rotationSpeed ??
        [...SnowSpecs.rotationSpeed]) as NumberPair,
      opacity: (partial.opacity ?? [...SnowSpecs.opacity]) as NumberPair,
      enable3DRotation:
        partial.enable3DRotation ?? SnowSpecs.enable3DRotation,
      snowflakeCount: partial.snowflakeCount ?? SnowSpecs.snowflakeCount,
      images: partial.images,
    };
  }

  /** Configure runtime knobs (safe while running). */
  configure(partial: SnowEngineOptions): void {
    if (partial.disableForReducedMotion != null) {
      this.disableForReducedMotion = partial.disableForReducedMotion;
    }
    this.config = this.mergeConfig({ ...this.config, ...partial });
    this.syncSnowflakeCount();
    for (const flake of this.snowflakes) flake.updateConfig(this.config);
  }

  get isRunning(): boolean {
    return this.running;
  }

  warm(): void {
    if (typeof document === 'undefined') return;
    if (this.disableForReducedMotion && prefersReducedMotion()) return;
    this.ensureCanvas();
    this.ensureSized();
    this.ensureResizeListener();
    if (this.snowflakes.length === 0 && this.canvas) {
      this.snowflakes = Snowflake.createSnowflakes(
        this.canvas,
        this.config.snowflakeCount,
        this.config,
      );
    }
  }

  start(): void {
    if (typeof document === 'undefined') return;
    if (this.disableForReducedMotion && prefersReducedMotion()) return;
    this.warm();
    if (!this.ctx || !this.canvas) return;
    if (this.running) return;
    this.running = true;
    this.lastUpdate = Date.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  reset(): void {
    this.stop();
    this.snowflakes = [];
    if (this.ctx && this.canvas) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  destroy(): void {
    this.reset();
    if (this.hasResizeEventRegistered && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize, false);
      this.hasResizeEventRegistered = false;
    }
    if (this.isLibCanvas && this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
  }

  private ensureCanvas(): boolean {
    if (this.isLibCanvas && !this.canvas) {
      this.canvas = getLibCanvas(this.zIndex);
      document.body.appendChild(this.canvas);
    }
    if (!this.canvas) return false;
    if (!this.ctx) {
      try {
        this.ctx = this.canvas.getContext('2d', { alpha: true });
      } catch {
        this.ctx = null;
      }
      if (!this.ctx) {
        try {
          this.ctx = this.canvas.getContext('2d');
        } catch {
          this.ctx = null;
        }
      }
    }
    return !!this.ctx;
  }

  private ensureSized(): void {
    if (!this.canvas) return;
    syncCanvasSize(this.canvas, this.isLibCanvas);
  }

  private ensureResizeListener(): void {
    if (!this.allowResize || this.hasResizeEventRegistered) return;
    if (typeof window === 'undefined') return;
    this.hasResizeEventRegistered = true;
    window.addEventListener('resize', this.onResize, false);
  }

  private syncSnowflakeCount(): void {
    if (!this.canvas) return;
    const n = Math.max(0, Math.round(this.config.snowflakeCount));
    const diff = n - this.snowflakes.length;
    if (diff > 0) {
      this.snowflakes = [
        ...this.snowflakes,
        ...Snowflake.createSnowflakes(this.canvas, diff, this.config),
      ];
    } else if (diff < 0) {
      this.snowflakes = this.snowflakes.slice(0, n);
    }
  }

  private readonly loop = (): void => {
    if (!this.running) return;
    const now = Date.now();
    const msPassed = now - this.lastUpdate;
    this.lastUpdate = now;
    const framesPassed = msPassed / targetFrameTime;
    this.render(framesPassed);
    this.raf = requestAnimationFrame(this.loop);
  };

  private render(framesPassed: number): void {
    const { ctx, canvas, snowflakes } = this;
    if (!ctx || !canvas) return;

    this.ensureSized();
    const offsetWidth = canvas.offsetWidth || canvas.width;
    const offsetHeight = canvas.offsetHeight || canvas.height;

    for (const flake of snowflakes) {
      flake.update(offsetWidth, offsetHeight, framesPassed);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, offsetWidth, offsetHeight);

    if (this.config.images && this.config.images.length > 0) {
      for (const flake of snowflakes) flake.drawImage(ctx);
      return;
    }

    const paint = resolveSnowColor(this.config.color);

    if (this.config.enable3DRotation) {
      for (const flake of snowflakes) {
        flake.drawCircle3D(ctx, paint);
      }
      return;
    }

    ctx.beginPath();
    for (const flake of snowflakes) flake.drawCircle(ctx);
    ctx.fillStyle = paint;
    ctx.fill();
  }
}

export type { SnowflakeConfig, NumberPair };
