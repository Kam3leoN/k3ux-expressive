import { html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  K3Element,
  attachInternals,
  setFormValue,
  haptic,
} from 'k3ui';
import { hostReset } from '../_shared.js';
import {
  RatingSpecs,
  resolveRatingColor,
  resolveRatingSize,
  type RatingColor,
  type RatingSize,
} from './rating.specs.js';
import { ratingStyles } from './rating.styles.js';

export type { RatingColor, RatingSize } from './rating.specs.js';
export {
  RatingSpecs,
  RatingIconDp,
  RatingTargetDp,
  resolveRatingColor,
  resolveRatingSize,
} from './rating.specs.js';

/**
 * Star (or custom icon) rating — Sober `s-rate` model + color customization.
 *
 * Track (inactive) + clipped indicator (active) + transparent `input[type=range]`.
 * Theme role via `color`, or any CSS color via `active-color` / `inactive-color`
 * / `--k3-rating-active` / `--k3-rating-inactive`.
 *
 * @fires k3-input - `{ value }` while dragging / changing
 * @fires k3-change - `{ value }` on commit (change / click)
 *
 * @slot unchecked - Custom empty icon (one node; copies via drop-shadow)
 * @slot checked - Custom filled icon (one node; copies via drop-shadow)
 *
 * @see ./rating.specs.ts
 */
export class K3Rating extends K3Element {
  static formAssociated = true;
  static override styles = [hostReset, ratingStyles];

  private internals = attachInternals(this as unknown as HTMLElement);

  @property({ type: Number }) value: number = RatingSpecs.defaultValue;
  @property({ type: Number }) min: number = RatingSpecs.defaultMin;
  @property({ type: Number }) max: number = RatingSpecs.defaultMax;
  @property({ type: Number }) step: number = RatingSpecs.defaultStep;
  @property({ type: Boolean, reflect: true }) readonly = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ reflect: true }) size: RatingSize = RatingSpecs.defaultSize;
  @property({ reflect: true }) color: RatingColor = RatingSpecs.defaultColor;
  /** Material Symbol ligature for default glyphs (default `star`). */
  @property() icon: string = RatingSpecs.defaultIcon;
  /** Optional filled ligature; defaults to {@link icon}. */
  @property({ attribute: 'icon-active' }) iconActive: string | undefined;
  /** Any CSS color — overrides theme role for the active (filled) layer. */
  @property({ attribute: 'active-color' }) activeColor: string | undefined;
  /** Any CSS color — overrides theme role for the inactive (empty) layer. */
  @property({ attribute: 'inactive-color' }) inactiveColor: string | undefined;
  @property() name: string | undefined;
  @property() label: string | undefined;

  @state() private previewPct: number | null = null;

  private hapticTickAt = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncFormValue();
  }

  override willUpdate(changed: PropertyValues): void {
    if (
      changed.has('size') ||
      changed.has('color') ||
      changed.has('value') ||
      changed.has('min') ||
      changed.has('max') ||
      changed.has('step')
    ) {
      this.size = resolveRatingSize(this.size);
      this.color = resolveRatingColor(this.color);
      this.value = this.clamp(this.value);
    }
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('value') ||
      changed.has('name') ||
      changed.has('disabled') ||
      changed.has('readonly')
    ) {
      this.syncFormValue();
    }
  }

  /** Current numeric value. */
  getValue(): number {
    return this.value;
  }

  /**
   * Set the value (clamped / snapped). Emits `k3-change` when it differs.
   * Works even when `disabled` / `readonly` (programmatic).
   */
  setValue(next: number): void {
    const v = this.clamp(next);
    if (v === this.value) {
      this.requestUpdate();
      return;
    }
    this.value = v;
    this.emit('k3-change', { value: this.value });
  }

  private resolvedMax(): number {
    const m = Number(this.max);
    return Number.isFinite(m) && m > 0 ? Math.floor(m) : RatingSpecs.defaultMax;
  }

  private resolvedMin(): number {
    const n = Number(this.min);
    return Number.isFinite(n) ? n : RatingSpecs.defaultMin;
  }

  private resolvedStep(): number {
    const s = Number(this.step);
    return Number.isFinite(s) && s > 0 ? s : RatingSpecs.defaultStep;
  }

  private clamp(raw: number): number {
    const min = this.resolvedMin();
    const max = this.resolvedMax();
    const step = this.resolvedStep();
    let v = Number(raw);
    if (!Number.isFinite(v)) v = min;
    v = Math.min(max, Math.max(min, v));
    if (step > 0) {
      const steps = Math.round((v - min) / step);
      v = min + steps * step;
      /* Avoid 1.0000000002 */
      const decimals = String(step).includes('.')
        ? (String(step).split('.')[1]?.length ?? 0)
        : 0;
      if (decimals > 0) {
        const f = 10 ** decimals;
        v = Math.round(v * f) / f;
      }
    }
    return Math.min(max, Math.max(min, v));
  }

  private fillRatio(value: number): number {
    const min = this.resolvedMin();
    const max = this.resolvedMax();
    const span = max - min;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, (value - min) / span));
  }

  private copiesFilter(): string {
    const n = this.resolvedMax();
    if (n <= 1) return 'none';
    const parts: string[] = [];
    for (let i = 1; i < n; i++) {
      parts.push(`drop-shadow(${i}em 0 0)`);
    }
    return parts.join(' ');
  }

  private syncFormValue(): void {
    const name = this.name;
    if (!name) {
      setFormValue(this.internals, null);
      return;
    }
    if (this.disabled) {
      setFormValue(this.internals, null);
      return;
    }
    setFormValue(this.internals, String(this.value));
  }

  private hostColorStyles(): Record<string, string> {
    const styles: Record<string, string> = {
      '--k3-rating-max': String(this.resolvedMax()),
      '--k3-rating-copies': this.copiesFilter(),
      '--k3-rating-fill': `${this.fillRatio(this.value) * 100}%`,
    };
    if (this.previewPct !== null) {
      styles['--k3-rating-preview'] = `${this.previewPct}%`;
    }
    if (this.activeColor) styles['--k3-rating-active'] = this.activeColor;
    if (this.inactiveColor) styles['--k3-rating-inactive'] = this.inactiveColor;
    return styles;
  }

  private renderIcon(which: 'unchecked' | 'checked') {
    const hasCustom = this.hasSlot(which);
    if (hasCustom) {
      return html`<div class="icon"><slot name=${which}></slot></div>`;
    }
    const name =
      which === 'checked'
        ? (this.iconActive?.trim() || this.icon || RatingSpecs.defaultIcon)
        : this.icon || RatingSpecs.defaultIcon;
    return html`
      <div class="icon">
        <span
          class="glyph notranslate"
          translate="no"
          lang="zxx"
          data-k3-icon=${name}
          aria-hidden="true"
        ></span>
      </div>
    `;
  }

  private onInput = (e: Event): void => {
    if (this.disabled || this.readonly) return;
    const input = e.target as HTMLInputElement;
    const next = this.clamp(Number(input.value));
    if (next === this.value) return;
    this.value = next;
    const now = performance.now();
    if (now - this.hapticTickAt > 48) {
      haptic.selection();
      this.hapticTickAt = now;
    }
    this.emit('k3-input', { value: this.value });
  };

  private onChange = (e: Event): void => {
    if (this.disabled || this.readonly) return;
    const input = e.target as HTMLInputElement;
    const next = this.clamp(Number(input.value));
    this.value = next;
    haptic.selection();
    this.emit('k3-change', { value: this.value });
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.disabled || this.readonly) return;
    if (e.pointerType === 'touch') return;
    const wrap = e.currentTarget as HTMLElement;
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    let ratio = (e.clientX - rect.left) / rect.width;
    if (rtl) ratio = 1 - ratio;
    ratio = Math.min(1, Math.max(0, ratio));
    const min = this.resolvedMin();
    const max = this.resolvedMax();
    const raw = min + ratio * (max - min);
    const snapped = this.clamp(raw);
    this.previewPct = this.fillRatio(snapped) * 100;
    wrap.toggleAttribute('data-preview', true);
  };

  private onPointerLeave = (e: PointerEvent): void => {
    const wrap = e.currentTarget as HTMLElement;
    this.previewPct = null;
    wrap.removeAttribute('data-preview');
  };

  override render() {
    const min = this.resolvedMin();
    const max = this.resolvedMax();
    const step = this.resolvedStep();
    const label = this.label?.trim() || 'Rating';

    return html`
      <div
        class="wrap"
        style=${styleMap(this.hostColorStyles())}
        @pointermove=${this.onPointerMove}
        @pointerleave=${this.onPointerLeave}
      >
        <div class="track" aria-hidden="true">${this.renderIcon('unchecked')}</div>
        <div class="indicator" aria-hidden="true">${this.renderIcon('checked')}</div>
        <input
          class="native"
          type="range"
          min=${min}
          max=${max}
          step=${step}
          .value=${String(this.value)}
          ?disabled=${this.disabled || this.readonly}
          aria-label=${label}
          aria-valuemin=${min}
          aria-valuemax=${max}
          aria-valuenow=${this.value}
          aria-readonly=${this.readonly ? 'true' : nothing}
          @input=${this.onInput}
          @change=${this.onChange}
        />
      </div>
    `;
  }
}

export default K3Rating;

if (!customElements.get('k3-rating')) {
  customElements.define('k3-rating', K3Rating);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-rating': K3Rating;
  }
}
