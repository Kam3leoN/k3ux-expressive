import { html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { K3Element, haptic } from 'k3ui';
import { hostReset } from '../_shared.js';
import { i18n } from 'k3ui';
import {
  SignaturePad,
  type PointGroup,
  type SignaturePadOptions,
} from './signature-pad.js';
import { SignatureSpecs } from './signature.specs.js';
import { signatureStyles } from './signature.styles.js';

export type { PointGroup, SignaturePadOptions };
export { SignaturePad, SignatureSpecs };

/**
 * Signature capture — canvas pad (v1 SignaturePad engine).
 *
 * @fires k3-begin-stroke - stroke started
 * @fires k3-end-stroke - stroke finished
 * @fires k3-clear - pad cleared
 * @fires k3-initials - `{ initials }` after stamping initials
 * @fires k3-change - after stroke end, clear, or initials (`{ empty, dataUrl? }`)
 *
 * @see ./signature.specs.ts
 */
export class K3Signature extends K3Element {
  static override styles = [hostReset, signatureStyles];

  @property({ attribute: 'pen-color' }) penColor = SignatureSpecs.defaultPenColor;
  @property({ attribute: 'background-color' })
  backgroundColor = SignatureSpecs.defaultBackgroundColor;
  @property({ type: Number, attribute: 'min-width' })
  minWidth = SignatureSpecs.defaultMinWidth;
  @property({ type: Number, attribute: 'max-width' })
  maxWidth = SignatureSpecs.defaultMaxWidth;
  @property({ type: Number, attribute: 'dot-size' })
  dotSize = SignatureSpecs.defaultDotSize;
  @property({ type: Number, attribute: 'min-distance' })
  minDistance = SignatureSpecs.defaultMinDistance;
  @property({ type: Number }) throttle = SignatureSpecs.defaultThrottle;
  @property({ type: Number, attribute: 'velocity-filter-weight' })
  velocityFilterWeight = SignatureSpecs.defaultVelocityFilterWeight;
  @property({ attribute: 'composite-operation' })
  compositeOperation: GlobalCompositeOperation =
    SignatureSpecs.defaultCompositeOperation;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ type: Boolean, attribute: 'show-clear', reflect: true })
  showClear = SignatureSpecs.behaviors.showClear;
  @property({ type: Boolean, attribute: 'show-hint', reflect: true })
  showHint = SignatureSpecs.behaviors.showHint;
  @property({ type: Boolean, attribute: 'show-initials', reflect: true })
  showInitials = SignatureSpecs.behaviors.showInitials;
  @property() hint = '';
  @property({ attribute: 'clear-label' }) clearLabel = '';
  /** Controlled initials field (uppercase, max 4). */
  @property() initials = '';

  @state() private empty = true;
  @state() private initialsDraft = '';

  @query('canvas') private canvasEl?: HTMLCanvasElement;

  private pad: SignaturePad | null = null;
  private resizeObs: ResizeObserver | null = null;
  /** Last stamped initials (survives resize; cleared on clear / freehand). */
  private stampText = '';

  private onBegin = (): void => {
    if (!this.readonly && !this.disabled) haptic.light();
    this.stampText = '';
    this.empty = false;
    this.emit('k3-begin-stroke');
  };
  private onEnd = (): void => {
    this.empty = this.pad?.isEmpty() ?? true;
    this.emit('k3-end-stroke');
    this.emitChange();
  };
  private onClearEvt = (): void => {
    this.stampText = '';
    this.empty = true;
    this.emit('k3-clear');
    this.emitChange();
  };

  /** Whether the pad has no strokes / stamp. */
  isEmpty(): boolean {
    return this.pad?.isEmpty() ?? this.empty;
  }

  /** Stroke groups (SignaturePad data model). */
  toData(): PointGroup[] {
    return this.pad?.toData() ?? [];
  }

  /** Restore stroke groups. */
  fromData(groups: PointGroup[], opts?: { clear?: boolean }): void {
    this.ensurePad()?.fromData(groups, opts);
    this.empty = this.pad?.isEmpty() ?? true;
  }

  /** PNG (or other) data URL of the canvas. */
  toDataURL(type = 'image/png', quality?: number): string {
    return this.pad?.toDataURL(type, quality) ?? '';
  }

  fromDataURL(
    dataUrl: string,
    options?: {
      ratio?: number;
      width?: number;
      height?: number;
      xOffset?: number;
      yOffset?: number;
    },
  ): Promise<void> {
    const pad = this.ensurePad();
    if (!pad) return Promise.resolve();
    return pad.fromDataURL(dataUrl, options).then(() => {
      this.empty = pad.isEmpty();
    });
  }

  /** SVG markup of current strokes. */
  toSVG(): string {
    return this.pad?.toSVG() ?? '';
  }

  /** Clear strokes and emit `k3-clear` / `k3-change`. */
  clear(): void {
    if (!this.pad) {
      this.stampText = '';
      this.empty = true;
      return;
    }
    haptic.selection();
    this.stampText = '';
    this.pad.clear();
  }

  /** Stamp initials onto the pad (replaces current ink). */
  applyInitials(raw?: string): void {
    if (this.disabled || this.readonly) return;
    const text = this.normalizeInitials(raw ?? (this.initialsDraft || this.initials));
    if (!text) return;
    const pad = this.ensurePad();
    if (!pad) return;
    // Wipe strokes without treating it as a user clear (stamp follows).
    pad.removeEventListener('clear', this.onClearEvt);
    pad.clear();
    pad.addEventListener('clear', this.onClearEvt);
    this.stampText = text;
    this.initialsDraft = text;
    this.initials = text;
    this.paintInitials(text, true);
  }

  /** Re-measure canvas for DPR / layout changes. */
  resize(): void {
    this.relayoutPad();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', SignatureSpecs.accessibility.role);
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute(
        'aria-label',
        i18n.t('signature.ariaLabel', SignatureSpecs.accessibility.ariaLabel),
      );
    }
  }

  override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.initialsDraft = this.normalizeInitials(this.initials);
    this.ensurePad();
    this.bindResize();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.pad) return;
    this.syncPadOptions();
    if (changed.has('initials')) {
      this.initialsDraft = this.normalizeInitials(this.initials);
    }
    if (changed.has('disabled') || changed.has('readonly')) {
      if (this.disabled || this.readonly) this.pad.off();
      else this.pad.on();
    }
  }

  override disconnectedCallback(): void {
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    if (this.pad) {
      this.pad.removeEventListener('beginStroke', this.onBegin);
      this.pad.removeEventListener('endStroke', this.onEnd);
      this.pad.removeEventListener('clear', this.onClearEvt);
      this.pad.destroy();
      this.pad = null;
    }
    super.disconnectedCallback();
  }

  private normalizeInitials(raw: string): string {
    return raw
      .replace(/[^a-zA-ZÀ-ÿ]/g, '')
      .slice(0, SignatureSpecs.initialsMaxLength)
      .toUpperCase();
  }

  private emitChange(): void {
    const empty = this.isEmpty();
    this.emit('k3-change', {
      empty,
      dataUrl: empty ? undefined : this.toDataURL(),
    });
  }

  private resolvedPenColor(): string {
    if (this.penColor.trim()) return this.penColor.trim();
    const token = getComputedStyle(this)
      .getPropertyValue('--k3-sys-color-on-surface')
      .trim();
    return token || SignatureSpecs.fallbackPenColor;
  }

  private syncPadOptions(): void {
    if (!this.pad) return;
    const o = this.pad.options;
    o.penColor = this.resolvedPenColor();
    o.backgroundColor = this.backgroundColor;
    o.minWidth = this.minWidth;
    o.maxWidth = this.maxWidth;
    o.dotSize = this.dotSize;
    o.minDistance = this.minDistance;
    o.throttle = this.throttle;
    o.velocityFilterWeight = this.velocityFilterWeight;
    o.compositeOperation = this.compositeOperation;
  }

  private ensurePad(): SignaturePad | null {
    const canvas = this.canvasEl;
    if (!canvas) return null;
    if (this.pad) return this.pad;

    this.pad = new SignaturePad(canvas, {
      penColor: this.resolvedPenColor(),
      backgroundColor: this.backgroundColor,
      minWidth: this.minWidth,
      maxWidth: this.maxWidth,
      dotSize: this.dotSize,
      minDistance: this.minDistance,
      throttle: this.throttle,
      velocityFilterWeight: this.velocityFilterWeight,
      compositeOperation: this.compositeOperation,
    });
    this.pad.addEventListener('beginStroke', this.onBegin);
    this.pad.addEventListener('endStroke', this.onEnd);
    this.pad.addEventListener('clear', this.onClearEvt);
    this.empty = this.pad.isEmpty();
    if (this.disabled || this.readonly) this.pad.off();
    requestAnimationFrame(() => this.relayoutPad());
    return this.pad;
  }

  private bindResize(): void {
    const surface = this.renderRoot.querySelector('.surface');
    if (!surface || typeof ResizeObserver === 'undefined') return;
    this.resizeObs?.disconnect();
    this.resizeObs = new ResizeObserver(() => {
      this.relayoutPad();
    });
    this.resizeObs.observe(surface);
  }

  private relayoutPad(): void {
    if (!this.pad) return;
    const data = this.pad.toData();
    this.pad.resize();
    if (this.stampText) {
      this.paintInitials(this.stampText, false);
      if (data.length) this.pad.fromData(data, { clear: false });
    }
    this.empty = this.pad.isEmpty();
  }

  /**
   * Paint centered initials. When `emit` is true, fires initials + change.
   * Resets the 2d transform so freehand strokes keep working after stamp.
   */
  private paintInitials(text: string, emit: boolean): void {
    const canvas = this.canvasEl;
    const pad = this.pad;
    if (!canvas || !pad) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(canvas.width / dpr, 1);
    const cssH = Math.max(canvas.height / dpr, 1);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pad.options.backgroundColor || 'rgba(0,0,0,0)';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = this.resolvedPenColor();
    const size = Math.min(cssH * 0.48, cssW * 0.28, 56);
    ctx.font = `italic 600 ${size}px "Segoe Script", "Apple Chancery", "Comic Sans MS", cursive, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cssW / 2, cssH / 2);
    ctx.restore();

    // Match SignaturePad._setupCanvas scale for subsequent strokes.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    pad.markDrawn();
    this.empty = false;

    if (emit) {
      haptic.selection();
      this.emit('k3-initials', { initials: text });
      this.emitChange();
    }
  }

  private hintText(): string {
    if (this.hint.trim()) return this.hint.trim();
    return i18n.t('signature.hint', 'Sign here');
  }

  private clearText(): string {
    if (this.clearLabel.trim()) return this.clearLabel.trim();
    return i18n.t('signature.clear', SignatureSpecs.accessibility.clearLabel);
  }

  private initialsLabel(): string {
    return i18n.t(
      'signature.initials',
      SignatureSpecs.accessibility.initialsLabel,
    );
  }

  private initialsApplyLabel(): string {
    return i18n.t(
      'signature.initialsApply',
      SignatureSpecs.accessibility.initialsApplyLabel,
    );
  }

  private onClearClick = (e: Event): void => {
    e.preventDefault();
    if (this.disabled || this.readonly) return;
    this.clear();
  };

  private onInitialsInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    const next = this.normalizeInitials(input.value);
    this.initialsDraft = next;
    this.initials = next;
    if (input.value !== next) input.value = next;
  };

  private onInitialsKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.applyInitials();
    }
  };

  private onInitialsApplyClick = (e: Event): void => {
    e.preventDefault();
    this.applyInitials();
  };

  override render() {
    const showHint = this.showHint && this.empty;
    const showActions =
      !this.readonly && (this.showClear || this.showInitials);
    const canApply =
      !this.disabled && this.normalizeInitials(this.initialsDraft).length > 0;

    return html`
      <div class="root">
        <div class="surface">
          <canvas part="canvas" aria-hidden="true"></canvas>
          ${showHint
            ? html`<p class="hint" part="hint">${this.hintText()}</p>`
            : nothing}
        </div>
        ${showActions
          ? html`
              <div class="actions" part="actions">
                ${this.showInitials
                  ? html`
                      <div class="initials" part="initials">
                        <input
                          class="initials-input"
                          type="text"
                          maxlength=${SignatureSpecs.initialsMaxLength}
                          .value=${this.initialsDraft}
                          placeholder=${this.initialsLabel()}
                          aria-label=${this.initialsLabel()}
                          ?disabled=${this.disabled}
                          autocomplete="off"
                          spellcheck="false"
                          @input=${this.onInitialsInput}
                          @keydown=${this.onInitialsKeydown}
                        />
                        <button
                          type="button"
                          class="btn-initials"
                          part="initials-apply"
                          ?disabled=${!canApply}
                          aria-label=${this.initialsApplyLabel()}
                          title=${this.initialsApplyLabel()}
                          @click=${this.onInitialsApplyClick}
                        >
                          <span
                            class="ms notranslate"
                            translate="no"
                            lang="zxx"
                            data-k3-icon="check"
                            aria-hidden="true"
                          ></span>
                        </button>
                      </div>
                    `
                  : nothing}
                ${this.showClear
                  ? html`
                      <button
                        type="button"
                        class="btn-clear"
                        part="clear"
                        ?disabled=${this.disabled || this.empty}
                        aria-label=${this.clearText()}
                        @click=${this.onClearClick}
                      >
                        <span
                          class="ms notranslate"
                          translate="no"
                          lang="zxx"
                          data-k3-icon="clear"
                          aria-hidden="true"
                        ></span>
                        <span>${this.clearText()}</span>
                      </button>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}

export default K3Signature;

if (!customElements.get('k3-signature')) {
  customElements.define('k3-signature', K3Signature);
}
