import { html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { K3Element, i18n } from 'k3ui';
import { hostReset } from '../_shared.js';
import { SparkleEngine, type SparkleEngineOptions } from './sparkle-mouse/sparkle-engine.js';
import { SparkleMouseSpecs } from './sparkle-mouse/sparkle-mouse.specs.js';
import { sparkleMouseStyles } from './sparkle-mouse/sparkle-mouse.styles.js';
import { parseSparkleColors, sameList } from './sparkle-mouse/sparkle-mouse.utils.js';

export type { SparkleEngineOptions };
export { SparkleEngine, SparkleMouseSpecs };
export {
  intensityFactor,
  parseSparkleColors,
  resolveSparkleColors,
} from './sparkle-mouse/sparkle-mouse.utils.js';

/**
 * Sparkles that follow the pointer — four-point stars scatter along its path,
 * twinkle, drift and fade.
 *
 * ```html
 * <k3-sparkle-mouse></k3-sparkle-mouse>
 * <k3-sparkle-mouse intensity="60" colors="#ffd54f, #ff8a65, #f06292, #ba68c8, #64b5f6"></k3-sparkle-mouse>
 * ```
 *
 * - `intensity` — 0–100 %, default 20 (a light trail); 100 is a dense shower.
 * - `colors` — as many as you like: theme roles (`primary`), CSS colours,
 *   `var(--brand)`. Each sparkle picks one at random.
 *
 * Imperative: `el.start()`, `el.stop()`, `el.clear()`, `el.burst(x, y, count)`.
 *
 * @fires k3-sparkle-mouse-start — the pointer is being followed
 * @fires k3-sparkle-mouse-stop — following stopped
 */
export class K3SparkleMouse extends K3Element {
  static override styles = [hostReset, sparkleMouseStyles];

  /** Amount of sparkles, 0–100 % (default 20). */
  @property({ type: Number }) intensity: number = SparkleMouseSpecs.intensity;

  /**
   * Palette — any number of entries. Attribute: comma list
   * (`colors="#f00, rgb(0 128 255), primary"`) or JSON array; property: `string[]`.
   * Empty → the default blue-violet palette (five colours).
   */
  @property({
    converter: {
      fromAttribute: (value: string | null) => parseSparkleColors(value),
      toAttribute: (value: readonly string[]) => value.join(', '),
    },
    hasChanged: (next: readonly string[], prev: readonly string[] | undefined) =>
      !prev || !sameList(parseSparkleColors(next), parseSparkleColors(prev)),
  })
  colors: string[] = [];

  /** Smallest / largest sparkle, tip to tip, CSS px. */
  @property({ type: Number, attribute: 'size-min' }) sizeMin: number = SparkleMouseSpecs.size[0];
  @property({ type: Number, attribute: 'size-max' }) sizeMax: number = SparkleMouseSpecs.size[1];

  /** Mean life of a sparkle, ms. */
  @property({ type: Number }) duration: number = SparkleMouseSpecs.duration;
  /** Scatter radius around the pointer path, CSS px. */
  @property({ type: Number }) spread: number = SparkleMouseSpecs.spread;
  /** Downward pull, px / s² — negative makes sparkles rise. */
  @property({ type: Number }) gravity: number = SparkleMouseSpecs.gravity;

  /** Also follow touch pointers (off by default: a finger hides its own trail). */
  @property({ type: Boolean }) touch: boolean = SparkleMouseSpecs.behaviors.touch;
  /** Pause emission without removing the element. */
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Honor `prefers-reduced-motion` (default true). */
  @property({ type: Boolean, attribute: 'disable-for-reduced-motion' })
  disableForReducedMotion: boolean = SparkleMouseSpecs.behaviors.disableForReducedMotion;

  /** Keep sparkles inside the host box instead of the whole viewport. */
  @property({ type: Boolean, attribute: 'use-host-canvas', reflect: true })
  useHostCanvas = false;

  @query('canvas') private hostCanvas?: HTMLCanvasElement;

  private engine: SparkleEngine | null = null;
  /** `stop()` was called — stay stopped across re-renders until `start()`. */
  private stopped = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', SparkleMouseSpecs.accessibility.role);
    this.setAttribute('aria-hidden', 'true');
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', i18n.t('sparkleMouse.ariaLabel', 'Pointer sparkles'));
    }
    void this.updateComplete.then(() => {
      if (this.isConnected && !this.stopped) this.start();
    });
  }

  override disconnectedCallback(): void {
    this.engine?.destroy();
    this.engine = null;
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('useHostCanvas') && this.engine) {
      /* Different canvas → new engine. */
      const running = this.engine.isRunning;
      this.engine.destroy();
      this.engine = null;
      if (running) this.start();
      return;
    }
    this.engine?.configure(this.toOptions());
  }

  private toOptions(): SparkleEngineOptions {
    return {
      intensity: this.intensity,
      colors: parseSparkleColors(this.colors),
      size: [this.sizeMin, this.sizeMax],
      duration: this.duration,
      spread: this.spread,
      gravity: this.gravity,
      touch: this.touch,
      disableForReducedMotion: this.disableForReducedMotion,
      zIndex: SparkleMouseSpecs.zIndex,
      themeSource: this,
      /* Hidden doc pages still upgrade their elements — a buried demo stays quiet. */
      canEmit: () => !this.disabled && !this.closest('[hidden]'),
    };
  }

  private ensureEngine(): SparkleEngine {
    this.engine ??= new SparkleEngine(this.useHostCanvas ? (this.hostCanvas ?? null) : null, this.toOptions());
    return this.engine;
  }

  /** Shared engine instance. */
  getEngine(): SparkleEngine {
    return this.ensureEngine();
  }

  /** Follow the pointer (automatic when the element connects). */
  start(): void {
    this.stopped = false;
    const engine = this.ensureEngine();
    if (engine.isRunning) return;
    engine.configure(this.toOptions());
    engine.start();
    this.emit('k3-sparkle-mouse-start');
  }

  /** Stop following; sparkles on screen finish their life. */
  stop(): void {
    this.stopped = true;
    if (!this.engine?.isRunning) return;
    this.engine.stop();
    this.emit('k3-sparkle-mouse-stop');
  }

  /** Remove every sparkle now. */
  clear(): void {
    this.engine?.clear();
  }

  /** `count` sparkles around a viewport point — e.g. on click. Returns how many were born. */
  burst(x: number, y: number, count?: number): number {
    return this.ensureEngine().burst(x, y, count);
  }

  get isRunning(): boolean {
    return this.engine?.isRunning ?? false;
  }

  override render() {
    return this.useHostCanvas
      ? html`<canvas class="stage" part="canvas" aria-hidden="true"></canvas>`
      : nothing;
  }
}

export default K3SparkleMouse;

if (!customElements.get('k3-sparkle-mouse')) {
  customElements.define('k3-sparkle-mouse', K3SparkleMouse);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-sparkle-mouse': K3SparkleMouse;
  }
}
