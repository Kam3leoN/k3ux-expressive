import { html, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { K3Element, i18n } from 'k3ui';
import { hostReset } from '../_shared.js';
import {
  ConfettiCannon,
  shapeFromPath,
  shapeFromText,
  type ConfettiFireOptions,
} from './confetti/confetti-engine.js';
import {
  ConfettiPresets,
  firePreset,
  fireRain,
  rain,
  type ConfettiPresetTarget,
  type ConfettiRainOptions,
} from './confetti/confetti.presets.js';
import {
  ConfettiSpecs,
  type ConfettiPresetId,
} from './confetti/confetti.specs.js';
import { confettiStyles } from './confetti/confetti.styles.js';

export type { ConfettiFireOptions, ConfettiPresetId, ConfettiRainOptions };
export {
  ConfettiCannon,
  ConfettiPresets,
  ConfettiSpecs,
  firePreset,
  fireRain,
  rain,
  shapeFromPath,
  shapeFromText,
};

/**
 * Confetti effect — vendored canvas-confetti engine (no npm dep).
 *
 * Imperative: `el.fire()`, `el.presetFire('basic')`, `el.rain()`, or `ConfettiPresets.fireBasic()`.
 * Attribute `preset` + `auto-fire` fires on connect.
 *
 * @fires k3-confetti-start — before a burst
 * @fires k3-confetti-end — when the burst animation settles
 *
 * @see ./confetti/NOTICE.md
 * @see https://www.kirilv.com/canvas-confetti/
 */
export class K3Confetti extends K3Element {
  static override styles = [hostReset, confettiStyles];

  /** Named demo preset (canvas-confetti gallery). */
  @property({ reflect: true }) preset: ConfettiPresetId | '' = '';
  /** Fire `preset` (or default basic) when connected. */
  @property({ type: Boolean, attribute: 'auto-fire' }) autoFire = false;
  /** Honor `prefers-reduced-motion` (default true). */
  @property({ type: Boolean, attribute: 'disable-for-reduced-motion' })
  disableForReducedMotion = ConfettiSpecs.behaviors.disableForReducedMotion;
  /** Particle count for `fire()` without options. */
  @property({ type: Number, attribute: 'particle-count' }) particleCount =
    ConfettiSpecs.behaviors.particleCount;
  @property({ type: Number }) spread = ConfettiSpecs.behaviors.spread;
  @property({ type: Number }) angle = ConfettiSpecs.behaviors.angle;
  /** Use an in-host canvas instead of the fullscreen body overlay. */
  @property({ type: Boolean, attribute: 'use-host-canvas', reflect: true })
  useHostCanvas = false;

  @query('canvas') private hostCanvas?: HTMLCanvasElement;

  private cannon: ConfettiCannon | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', ConfettiSpecs.accessibility.role);
    this.setAttribute('aria-hidden', 'true');
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute(
        'aria-label',
        i18n.t('confetti.ariaLabel', 'Confetti'),
      );
    }
    void this.updateComplete.then(() => {
      // Warm the fullscreen canvas after first paint so the first burst
      // does not hitch on GPU buffer allocation.
      const warm = () => this.ensureCannon().warm();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(warm));
      } else {
        warm();
      }
      if (this.autoFire) {
        if (this.preset) this.presetFire(this.preset);
        else void this.fire();
      }
    });
  }

  override disconnectedCallback(): void {
    this.cannon?.destroy();
    this.cannon = null;
    super.disconnectedCallback();
  }

  /** Shared cannon instance (fullscreen or host canvas). */
  getCannon(): ConfettiCannon {
    return this.ensureCannon();
  }

  /**
   * Fire a burst. Merges element props with `options`.
   */
  fire(options: ConfettiFireOptions = {}): Promise<void> {
    const cannon = this.ensureCannon();
    this.emit('k3-confetti-start', { options });
    const merged: ConfettiFireOptions = {
      particleCount: this.particleCount,
      spread: this.spread,
      angle: this.angle,
      disableForReducedMotion: this.disableForReducedMotion,
      ...options,
    };
    return cannon.fire(merged).then(() => {
      this.emit('k3-confetti-end', { options: merged });
    });
  }

  /** Run a named preset against this element’s cannon. */
  presetFire(id: ConfettiPresetId): void {
    this.emit('k3-confetti-start', { preset: id });
    firePreset(id, this.ensureCannon() as ConfettiPresetTarget);
  }

  /**
   * Confetti rain from the top of the viewport.
   * @example el.rain({ count: 250, gravity: 0.9, duration: 3 })
   */
  rain(options: ConfettiRainOptions = {}): void {
    this.emit('k3-confetti-start', { preset: 'rain', options });
    fireRain(this.ensureCannon() as ConfettiPresetTarget, options);
  }

  /** Stop / clear the current animation. */
  reset(): void {
    this.cannon?.reset();
  }

  private ensureCannon(): ConfettiCannon {
    if (this.cannon) return this.cannon;
    const host = this.useHostCanvas ? this.hostCanvas ?? null : null;
    this.cannon = new ConfettiCannon(host, {
      resize: true,
      disableForReducedMotion: this.disableForReducedMotion,
    });
    return this.cannon;
  }

  override render() {
    return this.useHostCanvas
      ? html`<canvas class="ring" part="canvas" aria-hidden="true"></canvas>`
      : nothing;
  }
}

export default K3Confetti;

if (!customElements.get('k3-confetti')) {
  customElements.define('k3-confetti', K3Confetti);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-confetti': K3Confetti;
  }
}
