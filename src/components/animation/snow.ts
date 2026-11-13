import { html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { K3Element, i18n } from 'k3ui';
import { hostReset } from '../_shared.js';
import {
  SnowEngine,
  type NumberPair,
  type SnowEngineOptions,
  type SnowflakeConfig,
} from './snow/snow-engine.js';
import { SnowSpecs } from './snow/snow.specs.js';
import { snowStyles } from './snow/snow.styles.js';

export type { NumberPair, SnowEngineOptions, SnowflakeConfig };
export { SnowEngine, SnowSpecs };
export {
  resolveSnowColor,
  SNOW_COLOR_FALLBACK,
} from './snow/snow.utils.js';

/**
 * Continuous snowfall — independent canvas port of react-snowfall options.
 *
 * Imperative: `el.start()`, `el.stop()`, `el.reset()`.
 * Same knobs as https://cahilfoley.github.io/react-snowfall/ —
 * `snowflakeCount`, `color`, `speed`, `wind`, `radius`, `images`, …
 *
 * @fires k3-snow-start — when snowfall begins
 * @fires k3-snow-stop — when snowfall stops
 *
 * @see ./snow/NOTICE.md
 */
export class K3Snow extends K3Element {
  static override styles = [hostReset, snowStyles];

  /** Start snowfall when connected. */
  @property({ type: Boolean, attribute: 'auto-start' }) autoStart = false;
  /** Honor `prefers-reduced-motion` (default true). */
  @property({ type: Boolean, attribute: 'disable-for-reduced-motion' })
  disableForReducedMotion: boolean = SnowSpecs.behaviors.disableForReducedMotion;

  /** Number of snowflakes (react-snowfall default 150). */
  @property({ type: Number, attribute: 'snowflake-count' })
  snowflakeCount: number = SnowSpecs.snowflakeCount;

  /**
   * Circle fill when not using images.
   * Empty (default) → `--k3-sys-color-on-surface` so flakes stay visible on theme.
   */
  @property() color: string = SnowSpecs.color;

  /** Vertical speed range [min, max] px / frame @60fps. */
  @property({ attribute: false }) speed: NumberPair = [...SnowSpecs.speed];
  /** Horizontal wind range [min, max] px / frame. */
  @property({ attribute: false }) wind: NumberPair = [...SnowSpecs.wind];
  /** Radius range [min, max] px. */
  @property({ attribute: false }) radius: NumberPair = [...SnowSpecs.radius];
  /** Image rotation speed range (degrees / frame). */
  @property({ attribute: false }) rotationSpeed: NumberPair = [
    ...SnowSpecs.rotationSpeed,
  ];
  /** Image opacity range. */
  @property({ attribute: false }) opacity: NumberPair = [...SnowSpecs.opacity];

  /** Frames between wind/speed retargets. */
  @property({ type: Number, attribute: 'change-frequency' })
  changeFrequency: number = SnowSpecs.changeFrequency;

  /** 3D tumble (circles + images). */
  @property({ type: Boolean, attribute: 'enable-3d-rotation' })
  enable3DRotation: boolean = SnowSpecs.enable3DRotation;

  /** Custom flake images (square recommended). */
  @property({ attribute: false }) images?: CanvasImageSource[];

  /** HTML helpers for speed/wind/radius when not set via JS arrays. */
  @property({ type: Number, attribute: 'speed-min' }) speedMin?: number;
  @property({ type: Number, attribute: 'speed-max' }) speedMax?: number;
  @property({ type: Number, attribute: 'wind-min' }) windMin?: number;
  @property({ type: Number, attribute: 'wind-max' }) windMax?: number;
  @property({ type: Number, attribute: 'radius-min' }) radiusMin?: number;
  @property({ type: Number, attribute: 'radius-max' }) radiusMax?: number;

  /** Use an in-host canvas instead of the fullscreen body overlay. */
  @property({ type: Boolean, attribute: 'use-host-canvas', reflect: true })
  useHostCanvas = false;

  @query('canvas') private hostCanvas?: HTMLCanvasElement;

  private engine: SnowEngine | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', SnowSpecs.accessibility.role);
    this.setAttribute('aria-hidden', 'true');
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', i18n.t('snow.ariaLabel', 'Snow'));
    }
    void this.updateComplete.then(() => {
      if (!this.isConnected) return;
      /* Hidden doc pages still upgrade CEs — never auto-start a buried demo. */
      if (this.closest('[hidden]')) return;
      if (this.autoStart) this.start();
    });
  }

  override disconnectedCallback(): void {
    this.engine?.destroy();
    this.engine = null;
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (this.engine && this.configKeysChanged(changed)) {
      this.engine.configure(this.toOptions());
    }
  }

  private configKeysChanged(changed: Map<string, unknown>): boolean {
    const keys = [
      'snowflakeCount',
      'color',
      'speed',
      'wind',
      'radius',
      'rotationSpeed',
      'opacity',
      'changeFrequency',
      'enable3DRotation',
      'images',
      'disableForReducedMotion',
      'speedMin',
      'speedMax',
      'windMin',
      'windMax',
      'radiusMin',
      'radiusMax',
    ];
    return keys.some((k) => changed.has(k));
  }

  private resolveSpeed(): NumberPair {
    return [
      this.speedMin ?? this.speed[0],
      this.speedMax ?? this.speed[1],
    ];
  }

  private resolveWind(): NumberPair {
    return [this.windMin ?? this.wind[0], this.windMax ?? this.wind[1]];
  }

  private resolveRadius(): NumberPair {
    return [
      this.radiusMin ?? this.radius[0],
      this.radiusMax ?? this.radius[1],
    ];
  }

  private toOptions(): SnowEngineOptions {
    return {
      snowflakeCount: this.snowflakeCount,
      color: this.color,
      speed: this.resolveSpeed(),
      wind: this.resolveWind(),
      radius: this.resolveRadius(),
      rotationSpeed: this.rotationSpeed,
      opacity: this.opacity,
      changeFrequency: this.changeFrequency,
      enable3DRotation: this.enable3DRotation,
      images: this.images,
      disableForReducedMotion: this.disableForReducedMotion,
      zIndex: SnowSpecs.zIndex,
    };
  }

  /** Shared engine instance (fullscreen or host canvas). */
  getEngine(): SnowEngine {
    return this.ensureEngine();
  }

  /** Begin continuous snowfall. */
  start(): void {
    /*
     * Demo hosts live inside hidden `.comp-page` articles. Starting them would
     * still mount a fullscreen body canvas — refuse while buried.
     * Shell `#shell-snow` is never under [hidden], so settings snow still works.
     */
    if (this.closest('[hidden]')) return;
    const engine = this.ensureEngine();
    engine.configure(this.toOptions());
    this.emit('k3-snow-start');
    engine.start();
  }

  /** Pause the animation loop (flakes remain). */
  stop(): void {
    this.engine?.stop();
    this.emit('k3-snow-stop');
  }

  /** Stop and clear the canvas. */
  reset(): void {
    this.engine?.reset();
    this.emit('k3-snow-stop');
  }

  /** Stop, clear, and remove the fullscreen lib canvas from the DOM. */
  teardown(): void {
    this.engine?.destroy();
    this.engine = null;
    this.emit('k3-snow-stop');
  }

  get isRunning(): boolean {
    return this.engine?.isRunning ?? false;
  }

  private ensureEngine(): SnowEngine {
    if (this.engine) return this.engine;
    const host = this.useHostCanvas ? this.hostCanvas ?? null : null;
    this.engine = new SnowEngine(host, {
      ...this.toOptions(),
      resize: true,
    });
    return this.engine;
  }

  override render() {
    return this.useHostCanvas
      ? html`<canvas class="ring" part="canvas" aria-hidden="true"></canvas>`
      : nothing;
  }
}

export default K3Snow;

if (!customElements.get('k3-snow')) {
  customElements.define('k3-snow', K3Snow);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-snow': K3Snow;
  }
}
