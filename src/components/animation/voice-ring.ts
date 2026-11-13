import { html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { K3Element, i18n, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../_shared.js';
import {
  VoiceRingEngine,
  type VoiceRingEngineOptions,
} from './voice-ring/voice-ring-engine.js';
import {
  VoiceRingSpecs,
  type VoiceRingEmotion,
  type VoiceRingState,
  type VoiceRingTheme,
} from './voice-ring/voice-ring.specs.js';
import { voiceRingStyles } from './voice-ring/voice-ring.styles.js';

export type { VoiceRingEmotion, VoiceRingEngineOptions, VoiceRingState, VoiceRingTheme };
export { VoiceRingEngine, VoiceRingSpecs };

/**
 * Color spectrum voice ring — canvas ribbons that react to mic / level.
 *
 * Inspired by the public Voice Ring concept (color ring only — no mono).
 * Independent k3ux engine: no `voice-ring` package import.
 *
 * ```html
 * <k3-voice-ring id="vr" size="240" state="listening"></k3-voice-ring>
 * <script>
 *   const el = document.getElementById('vr');
 *   const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
 *   await el.attachStream(stream);
 * </script>
 * ```
 *
 * @fires k3-voice-ring-start — render loop started
 * @fires k3-voice-ring-stop — render loop stopped
 * @see https://libraries.dev/voice-ring
 */
export class K3VoiceRing extends K3Element {
  static override styles = [hostReset, voiceRingStyles];

  @property({ type: Number }) size: number = VoiceRingSpecs.size;
  @property({ reflect: true }) state: VoiceRingState = VoiceRingSpecs.state;
  /** `positive` · `calm` · `negative` — empty keeps the plain spectrum. */
  @property({ reflect: true }) emotion: VoiceRingEmotion = VoiceRingSpecs.emotion;
  /** −1 left … 1 right — ring leans while level is high. */
  @property({ type: Number }) direction: number = VoiceRingSpecs.direction;
  @property({ type: Number }) sensitivity: number = VoiceRingSpecs.sensitivity;
  @property({ type: Number }) speed: number = VoiceRingSpecs.speed;
  @property({ type: Number }) threshold: number = VoiceRingSpecs.threshold;
  @property({ type: Number }) release: number = VoiceRingSpecs.release;
  @property({ type: Number }) rings: number = VoiceRingSpecs.rings;
  @property({ type: Number }) lean: number = VoiceRingSpecs.lean;
  @property({ type: Number, attribute: 'ring-gap' }) ringGap: number =
    VoiceRingSpecs.ringGap;
  @property({ type: Number }) deform: number = VoiceRingSpecs.deform;
  @property({ type: Number }) halo: number = VoiceRingSpecs.halo;
  @property({ type: Number }) radius: number = VoiceRingSpecs.radius;
  @property({ reflect: true }) theme: VoiceRingTheme = VoiceRingSpecs.theme;
  @property({ type: Boolean }) paused: boolean = VoiceRingSpecs.paused;
  @property({ type: Boolean, attribute: 'auto-start' }) autoStart = true;
  @property({ type: Boolean, attribute: 'disable-for-reduced-motion' })
  disableForReducedMotion = true;

  /**
   * External level 0…1 (or getter). Wins over mic when set.
   * Not reflected — pass via property / `setLevel()`.
   */
  @property({ attribute: false }) level?: number | (() => number);

  @query('canvas') private canvasEl?: HTMLCanvasElement;

  private engine: VoiceRingEngine | null = null;
  private stream: MediaStream | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', VoiceRingSpecs.accessibility.role);
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute(
        'aria-label',
        i18n.t('voiceRing.ariaLabel', 'Voice ring'),
      );
    }
    this.style.setProperty('--k3-voice-ring-size', `${this.size}px`);
    void this.updateComplete.then(() => {
      if (!this.isConnected) return;
      if (this.closest('[hidden]')) return;
      this.ensureEngine();
      if (this.autoStart && !this.paused) this.start();
    });
  }

  override disconnectedCallback(): void {
    this.teardown();
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('size')) {
      this.style.setProperty('--k3-voice-ring-size', `${this.size}px`);
    }
    if (!this.engine) return;
    if (
      changed.has('size') ||
      changed.has('state') ||
      changed.has('emotion') ||
      changed.has('direction') ||
      changed.has('sensitivity') ||
      changed.has('speed') ||
      changed.has('threshold') ||
      changed.has('release') ||
      changed.has('rings') ||
      changed.has('lean') ||
      changed.has('ringGap') ||
      changed.has('deform') ||
      changed.has('halo') ||
      changed.has('radius') ||
      changed.has('theme') ||
      changed.has('level')
    ) {
      this.engine.configure(this.toOptions());
    }
    if (changed.has('paused')) {
      if (this.paused) this.stop();
      else if (this.autoStart) this.start();
    }
  }

  private toOptions(): VoiceRingEngineOptions {
    return {
      size: this.size,
      state: this.state,
      emotion: this.emotion || null,
      direction: this.direction,
      sensitivity: this.sensitivity,
      speed: this.speed,
      threshold: this.threshold,
      release: this.release,
      rings: this.rings,
      lean: this.lean,
      ringGap: this.ringGap,
      deform: this.deform,
      halo: this.halo,
      radius: this.radius,
      theme: this.theme,
      level: this.level,
    };
  }

  private ensureEngine(): VoiceRingEngine {
    if (this.engine) return this.engine;
    const canvas = this.canvasEl;
    if (!canvas) {
      throw new Error('k3-voice-ring: canvas not ready');
    }
    this.engine = new VoiceRingEngine(canvas, this.toOptions());
    return this.engine;
  }

  getEngine(): VoiceRingEngine {
    return this.ensureEngine();
  }

  get isRunning(): boolean {
    return !!this.engine?.isRunning;
  }

  /** Current smoothed level 0…1. */
  get currentLevel(): number {
    return this.engine?.level ?? 0;
  }

  start(): void {
    if (this.disableForReducedMotion && prefersReducedMotion()) return;
    if (this.paused) return;
    const engine = this.ensureEngine();
    engine.configure(this.toOptions());
    engine.start();
    this.emit('k3-voice-ring-start');
  }

  stop(): void {
    this.engine?.stop();
    this.emit('k3-voice-ring-stop');
  }

  setLevel(level: number | (() => number) | undefined): void {
    this.level = level;
    this.engine?.setLevel(level);
  }

  /** Open mic (getUserMedia) and attach — returns the stream. */
  async listen(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    await this.attachStream(stream);
    if (this.state === 'idle') this.state = 'listening';
    this.start();
    return stream;
  }

  async attachStream(stream: MediaStream): Promise<void> {
    this.stream = stream;
    const engine = this.ensureEngine();
    await engine.attachStream(stream);
  }

  detachStream(): void {
    this.engine?.detachStream();
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
  }

  teardown(): void {
    this.detachStream();
    this.engine?.destroy();
    this.engine = null;
  }

  override render() {
    return html`<canvas part="canvas" aria-hidden="true"></canvas>`;
  }
}

export default K3VoiceRing;

if (!customElements.get('k3-voice-ring')) {
  customElements.define('k3-voice-ring', K3VoiceRing);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-voice-ring': K3VoiceRing;
  }
}
