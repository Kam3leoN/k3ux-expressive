import { nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { K3Element, i18n, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../_shared.js';
import {
  FireworksEngine,
  type FireworksConfig,
  type FireworksOptions,
  type Quality,
  type SequenceOptions,
  type SequenceSalvo,
  type ShellTypeName,
  type SkyLighting,
  type SoundMode,
} from './firework/firework-engine.js';
import {
  FireworkSpecs,
  resolveFireworkZIndex,
  type FireworkLayer,
} from './firework/firework.specs.js';
import { fireworkStyles } from './firework/firework.styles.js';

export type {
  FireworksConfig,
  FireworksOptions,
  FireworkLayer,
  Quality,
  SequenceOptions,
  SequenceSalvo,
  ShellTypeName,
  SkyLighting,
  SoundMode,
};
export { FireworksEngine, FireworkSpecs, resolveFireworkZIndex };
export {
  FIREWORK_SOUND_FILES,
  FIREWORK_SOUND_LOCAL_BASE_URL,
  FIREWORK_SOUND_REMOTE_BASE_URL,
  FIREWORK_SOUND_SOURCES_BASE64,
  getFireworkSoundSources,
  getFireworkSoundSourcesWithFallback,
  type FireworkSoundSourceMap,
} from './firework/firework-audio.js';

/**
 * Fullscreen fireworks — vendored canvas engine from K3ui v1 / Caleb Miller.
 *
 * Imperative: `start()`, `pause()`, `launch()`, `launchBurst()`, `celebrate()`, …
 * Overlay is `pointer-events: none` (clicks pass through).
 *
 * @fires k3-firework-start — engine started / resumed
 * @fires k3-firework-stop — engine paused
 * @fires k3-firework-launch — after a manual launch / burst / sequence start
 *
 * @see ./firework/NOTICE.md
 * @see https://github.com/Kam3leoN/K3ui_OLD_v1
 */
export class K3Firework extends K3Element {
  static override styles = [hostReset, fireworkStyles];

  @property({ type: Boolean, attribute: 'auto-start' }) autoStart: boolean =
    FireworkSpecs.behaviors.autoStart;
  @property({ type: Boolean, attribute: 'disable-for-reduced-motion' })
  disableForReducedMotion: boolean =
    FireworkSpecs.behaviors.disableForReducedMotion;

  @property({ type: Number }) quality: Quality = FireworkSpecs.behaviors.quality;
  @property({ reflect: true }) shell: ShellTypeName =
    FireworkSpecs.behaviors.shell;
  @property({ type: Number }) size: number = FireworkSpecs.behaviors.size;
  @property({ type: Boolean, attribute: 'auto-launch' }) autoLaunch: boolean =
    FireworkSpecs.behaviors.autoLaunch;
  @property({ type: Boolean }) finale: boolean = FireworkSpecs.behaviors.finale;
  @property({ type: Number, attribute: 'sky-lighting' }) skyLighting: SkyLighting =
    FireworkSpecs.behaviors.skyLighting;
  @property({ type: Boolean, attribute: 'long-exposure' }) longExposure: boolean =
    FireworkSpecs.behaviors.longExposure;
  @property({ type: Boolean }) trails: boolean = FireworkSpecs.behaviors.trails;
  @property({ type: Boolean }) imprints: boolean = FireworkSpecs.behaviors.imprints;
  @property({ type: Number, attribute: 'scale-factor' }) scaleFactor: number =
    FireworkSpecs.behaviors.scaleFactor;
  @property({ type: Boolean, attribute: 'sound' }) soundEnabled: boolean =
    FireworkSpecs.behaviors.soundEnabled;
  @property({ attribute: 'sound-mode' }) soundMode: SoundMode =
    FireworkSpecs.behaviors.soundMode;
  @property({ reflect: true }) layer: FireworkLayer =
    FireworkSpecs.behaviors.layer;
  @property({ type: Number, attribute: 'z-index' }) zIndex?: number;
  @property({ type: Boolean, attribute: 'high-dpi' }) highDPI: boolean =
    FireworkSpecs.behaviors.highDPI;

  private engine: FireworksEngine | null = null;
  private soundGestureBound = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', FireworkSpecs.accessibility.role);
    this.setAttribute('aria-hidden', 'true');
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute(
        'aria-label',
        i18n.t('firework.ariaLabel', 'Firework'),
      );
    }
    void this.updateComplete.then(() => {
      if (this.disableForReducedMotion && prefersReducedMotion()) return;
      this.ensureEngine();
      if (this.autoStart) this.start();
    });
  }

  override disconnectedCallback(): void {
    this.engine?.destroy();
    this.engine = null;
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (!this.engine) return;
    if (
      changed.has('quality') ||
      changed.has('shell') ||
      changed.has('size') ||
      changed.has('autoLaunch') ||
      changed.has('finale') ||
      changed.has('skyLighting') ||
      changed.has('longExposure') ||
      changed.has('trails') ||
      changed.has('imprints') ||
      changed.has('scaleFactor') ||
      changed.has('soundEnabled')
    ) {
      this.engine.setConfig(this.toConfigPatch());
    }
    if (changed.has('layer') || changed.has('zIndex')) {
      const z = resolveFireworkZIndex(
        this.layer,
        this.zIndex,
        this.zIndex != null,
      );
      const root = document.querySelector('.firework-root') as HTMLElement | null;
      if (root) root.style.zIndex = String(z);
    }
  }

  private toConfigPatch(): Partial<FireworksConfig> {
    return {
      quality: this.quality,
      shell: this.shell,
      size: this.size,
      autoLaunch: this.autoLaunch,
      finale: this.finale,
      skyLighting: this.skyLighting,
      longExposure: this.longExposure,
      trails: this.trails,
      imprints: this.imprints,
      scaleFactor: this.scaleFactor,
      soundEnabled: this.soundEnabled,
    };
  }

  private toEngineOptions(): FireworksOptions {
    const z = resolveFireworkZIndex(
      this.layer,
      this.zIndex,
      this.zIndex != null,
    );
    const useExactSamples = this.soundMode !== 'synth';
    return {
      ...this.toConfigPatch(),
      zIndex: z,
      autoStart: false,
      highDPI: this.highDPI,
      transparentBackground: true,
      soundMode: this.soundMode,
      soundBaseUrl: FireworkSpecs.sound.localBaseUrl,
      /* Exact v1 / CodePen mp3s (embedded base64 + remote + local fallbacks). */
      soundSources: useExactSamples
        ? FireworkSpecs.sound.defaultSources()
        : undefined,
      container: document.body,
    };
  }

  getEngine(): FireworksEngine {
    return this.ensureEngine();
  }

  get isRunning(): boolean {
    return !!this.engine && !this.engine.paused;
  }

  get isActive(): boolean {
    return this.engine?.isActive ?? false;
  }

  /** Start / resume the animation loop. */
  start(): void {
    if (this.disableForReducedMotion && prefersReducedMotion()) return;
    const engine = this.ensureEngine();
    engine.setConfig(this.toConfigPatch());
    engine.start();
    this.bindSoundGesture();
    this.emit('k3-firework-start');
  }

  /** Pause the animation loop. */
  pause(): void {
    this.engine?.pause();
    this.engine?.stopSequence();
    this.emit('k3-firework-stop');
  }

  /** Alias of pause. */
  stop(): void {
    this.pause();
  }

  /** Stop sequences, clear idle canvas, keep engine mounted. */
  reset(): void {
    if (!this.engine) return;
    this.engine.stopSequence();
    this.engine.pause();
    this.engine.clearIdleDisplay();
    this.emit('k3-firework-stop');
  }

  launch(opts?: {
    shell?: ShellTypeName;
    size?: number;
    x?: number;
    y?: number;
  }): void {
    this.ensureEngine().launch(opts);
    this.emit('k3-firework-launch', { type: 'launch', opts });
  }

  launchBurst(
    count: number,
    opts?: { shell?: ShellTypeName; size?: number },
  ): void {
    this.ensureEngine().launchBurst(count, opts);
    this.emit('k3-firework-launch', { type: 'burst', count, opts });
  }

  playSequence(salvos: SequenceSalvo[], options?: SequenceOptions): void {
    this.ensureEngine().playSequence(salvos, options);
    this.emit('k3-firework-launch', { type: 'sequence', salvos });
  }

  stopSequence(): void {
    this.engine?.stopSequence();
  }

  /** Preset 2 › 3 › 2 › finale. */
  celebrate(options?: SequenceOptions): void {
    this.playSequence([...FireworkSpecs.sequences.celebrate], options);
  }

  enableSound(): void {
    this.soundEnabled = true;
    this.engine?.enableSound();
  }

  disableSound(): void {
    this.soundEnabled = false;
    this.engine?.disableSound();
  }

  private ensureEngine(): FireworksEngine {
    if (this.engine) return this.engine;
    this.engine = new FireworksEngine(this.toEngineOptions());
    return this.engine;
  }

  private bindSoundGesture(): void {
    if (this.soundGestureBound || !this.soundEnabled) return;
    this.soundGestureBound = true;
    const enable = (): void => {
      this.engine?.enableSound();
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
    };
    window.addEventListener('pointerdown', enable, { once: true });
    window.addEventListener('keydown', enable, { once: true });
  }

  override render() {
    return nothing;
  }
}

export default K3Firework;

if (!customElements.get('k3-firework')) {
  customElements.define('k3-firework', K3Firework);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-firework': K3Firework;
  }
}
