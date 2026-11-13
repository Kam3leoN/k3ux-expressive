import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { K3Element } from 'k3ui';
import { getSoundFx, type SoundFxOptions } from '../../core/sound-fx.js';
import { hostReset } from '../_shared.js';
import { i18n } from 'k3ui';
import { SoundFxSpecs } from './sound-fx.specs.js';
import { soundFxStyles } from './sound-fx.styles.js';

export { SoundFxSpecs };
export {
  getSoundFx,
  SoundFxController,
  resetSoundFxForTests,
  type SoundFxEvent,
  type SoundFxOptions,
} from '../../core/sound-fx.js';

/**
 * Interaction sound FX host — wires `data-k3-sound-click|hover|enter|leave`
 * under the document (or a scoped root) and exposes a mute toggle for SFX
 * (independent of `k3-audio-player` music mute).
 *
 * ```html
 * <k3-sound-fx sounds-path="/assets/sounds/"></k3-sound-fx>
 * <k3-button data-k3-sound-click="click" data-k3-sound-hover="hover">OK</k3-button>
 * ```
 *
 * @fires k3-change — `{ muted }` when the user toggles SFX mute
 */
export class K3SoundFx extends K3Element {
  static override styles = [hostReset, soundFxStyles];

  /** Base path for sound files (folder, trailing slash optional). */
  @property({ attribute: 'sounds-path' }) soundsPath = './assets/sounds/';
  @property({ type: Number }) volume = SoundFxSpecs.defaultVolume;
  /** Hide the built-in mute control (imperative mute still works). */
  @property({ type: Boolean, attribute: 'hide-mute' }) hideMute = false;
  /** Reflect muted state. */
  @property({ type: Boolean, reflect: true }) muted = false;

  @state() private mutedState = false;

  private fx = getSoundFx();

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', SoundFxSpecs.accessibility.role);
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute(
        'aria-label',
        i18n.t('soundFx.ariaLabel', 'Interaction sounds'),
      );
    }
    this.applyOptions();
    this.mutedState = this.fx.isMuted();
    this.muted = this.mutedState;
    this.fx.attach(document);
    this.fx.scan(document);
  }

  override disconnectedCallback(): void {
    /* Keep singleton attached for other hosts; only stop if this was the sole UI. */
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (
      changed.has('soundsPath') ||
      changed.has('volume') ||
      changed.has('muted')
    ) {
      this.applyOptions();
    }
  }

  /** Imperative mute for interaction SFX. */
  setMuted(muted: boolean): void {
    this.fx.setMuted(muted);
    this.mutedState = muted;
    this.muted = muted;
    this.emit('k3-change', { muted });
  }

  /** Play a named stem (e.g. `click`). */
  play(name: string): void {
    this.fx.play(name, 'custom');
  }

  private applyOptions(): void {
    const opts: Partial<SoundFxOptions> = {
      soundsPath: this.soundsPath,
      volume: this.volume,
    };
    this.fx.updateOptions(opts);
    this.fx.setSoundsPath(this.soundsPath);
    this.fx.setVolume(this.volume);
    if (this.hasAttribute('muted') || this.muted) {
      this.fx.setMuted(true);
      this.mutedState = true;
    }
  }

  private onToggleMute(): void {
    this.setMuted(!this.mutedState);
  }

  override render() {
    if (this.hideMute) return html`<slot></slot>`;
    const icon = this.mutedState ? 'volume_off' : 'volume_up';
    const label = this.mutedState
      ? i18n.t('soundFx.unmute', 'Unmute interaction sounds')
      : i18n.t('soundFx.mute', 'Mute interaction sounds');
    return html`
      <button
        type="button"
        class="mute"
        part="mute"
        aria-pressed=${this.mutedState ? 'true' : 'false'}
        aria-label=${label}
        title=${label}
        @click=${() => this.onToggleMute()}
      >
        <span
          class="ms notranslate"
          translate="no"
          lang="zxx"
          data-k3-icon=${icon}
          aria-hidden="true"
        ></span>
      </button>
      <span class="label" part="label">
        <slot
          >${this.mutedState
            ? i18n.t('soundFx.statusMuted', 'SFX off')
            : i18n.t('soundFx.statusOn', 'SFX on')}</slot
        >
      </span>
    `;
  }
}

export default K3SoundFx;

if (!customElements.get('k3-sound-fx')) {
  customElements.define('k3-sound-fx', K3SoundFx);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-sound-fx': K3SoundFx;
  }
}
