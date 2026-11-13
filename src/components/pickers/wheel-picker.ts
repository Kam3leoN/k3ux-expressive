import { html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../_shared.js';
import { i18n } from 'k3ui';
import { WheelPickerSpecs, type WheelPickerDirection } from './wheel-picker.specs.js';
import { wheelPickerStyles } from './wheel-picker.styles.js';

export { WheelPickerSpecs } from './wheel-picker.specs.js';

type ColumnAnim = {
  outgoing: string;
  incoming: string;
  direction: WheelPickerDirection;
};

/**
 * Rotating character columns (arcade-style initials picker).
 *
 * @fires k3-change — `{ value }`
 * @fires k3-submit — `{ value }`
 */
export class K3WheelPicker extends K3Element {
  static override styles = [hostReset, wheelPickerStyles];

  @property({ type: Number }) length = WheelPickerSpecs.defaultLength;
  @property({ attribute: 'allowed-chars' }) allowedChars = WheelPickerSpecs.defaultAllowedChars;
  @property() value = WheelPickerSpecs.defaultValue;
  @property({ type: Boolean, attribute: 'show-preview' }) showPreview = WheelPickerSpecs.showPreview;
  @property({ type: Boolean, attribute: 'show-submit-button' })
  showSubmitButton = WheelPickerSpecs.showSubmitButton;
  @property({ attribute: 'submit-text' }) submitText = WheelPickerSpecs.submitText;
  @property({ attribute: 'submitted-text' }) submittedText = WheelPickerSpecs.submittedText;

  @state() private values: string[] = [];
  @state() private saved = false;
  @state() private mounted: boolean[] = [];
  @state() private columnAnim: Record<number, ColumnAnim | undefined> = {};

  private mountTimers: number[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('aria-live', 'polite');
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', WheelPickerSpecs.accessibility.label);
    }
    this.normalizeValues(this.value);
    this.scheduleColumnMount();
  }

  override disconnectedCallback(): void {
    this.mountTimers.forEach((id) => clearTimeout(id));
    this.mountTimers = [];
    super.disconnectedCallback();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('length') || changed.has('allowedChars')) {
      this.normalizeValues(this.getValue());
    }
    if (changed.has('value')) {
      this.normalizeValues(this.value);
      this.removeAttribute('saved');
    }
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    /* A new value is never "saved" — reset before render (no extra cycle) */
    if (changed.has('value')) this.saved = false;
  }

  getValue(): string {
    return this.values.join('');
  }

  setValue(next: string | string[]): void {
    this.normalizeValues(next);
    this.saved = false;
    this.removeAttribute('saved');
    this.emit('k3-change', { value: this.getValue() });
  }

  resetSaved(): void {
    this.saved = false;
    this.removeAttribute('saved');
  }

  private allowedList(): string[] {
    const raw = (this.allowedChars || WheelPickerSpecs.defaultAllowedChars).split('');
    const unique: string[] = [];
    raw.forEach((c) => {
      if (c && !unique.includes(c)) unique.push(c);
    });
    return unique.length ? unique : WheelPickerSpecs.defaultAllowedChars.split('');
  }

  private defaultChar(): string {
    return this.allowedList()[0] ?? 'A';
  }

  private normalizeChar(char: string): string {
    const chars = this.allowedList();
    if (!chars.length) return '';
    const upper = (char || chars[0]).toUpperCase();
    const idx = chars.findIndex((c) => c.toUpperCase() === upper);
    return idx >= 0 ? chars[idx]! : chars[0]!;
  }

  private normalizeValues(source: string | string[]): void {
    const len = Math.max(1, this.length);
    let parts: string[];
    if (Array.isArray(source)) parts = source;
    else parts = String(source ?? '').split('');

    const next: string[] = [];
    for (let i = 0; i < len; i++) {
      next.push(this.normalizeChar(parts[i] ?? this.defaultChar()));
    }
    this.values = next;
    this.mounted = next.map((_, i) => this.mounted[i] ?? false);
  }

  private scheduleColumnMount(): void {
    this.mountTimers.forEach((id) => clearTimeout(id));
    this.mountTimers = [];
    const reduced = prefersReducedMotion();
    this.values.forEach((_, index) => {
      if (reduced) {
        this.mounted = this.values.map(() => true);
        return;
      }
      const delay = 120 + index * 90;
      const id = window.setTimeout(() => {
        this.mounted = this.mounted.map((m, i) => (i === index ? true : m));
      }, delay);
      this.mountTimers.push(id);
    });
  }

  private adjacentChar(current: string, direction: WheelPickerDirection): string {
    const chars = this.allowedList();
    const idx = chars.indexOf(current);
    const base = idx >= 0 ? idx : 0;
    const next = (base + direction + chars.length) % chars.length;
    return chars[next]!;
  }

  private cycle(index: number, direction: WheelPickerDirection): void {
    const chars = this.allowedList();
    if (chars.length <= 1) return;

    const current = this.values[index]!;
    const incoming = this.adjacentChar(current, direction);

    if (prefersReducedMotion()) {
      this.values = this.values.map((v, i) => (i === index ? incoming : v));
      this.saved = false;
      this.removeAttribute('saved');
      this.emit('k3-change', { value: this.getValue() });
      return;
    }

    this.columnAnim = {
      ...this.columnAnim,
      [index]: { outgoing: current, incoming, direction },
    };

    const finish = (): void => {
      this.values = this.values.map((v, i) => (i === index ? incoming : v));
      const nextAnim = { ...this.columnAnim };
      delete nextAnim[index];
      this.columnAnim = nextAnim;
      this.saved = false;
      this.removeAttribute('saved');
      this.emit('k3-change', { value: this.getValue() });
    };

    window.setTimeout(finish, WheelPickerSpecs.cycleAnimationMs + 32);
  }

  private onSubmit(): void {
    if (this.saved) return;
    this.saved = true;
    this.setAttribute('saved', '');
    this.emit('k3-submit', { value: this.getValue() });
  }

  private renderColumn(index: number) {
    const value = this.values[index] ?? this.defaultChar();
    const anim = this.columnAnim[index];
    const mounted = this.mounted[index];

    return html`
      <div class="column ${mounted ? 'column--mounted' : ''}" data-column=${index}>
        <button
          type="button"
          class="btn btn--up"
          aria-label=${i18n.t('wheelPicker.prev', WheelPickerSpecs.accessibility.prevLabel)}
          @click=${() => this.cycle(index, -1)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7.4 15.4 6 14l6-6 6 6-1.4 1.4L12 10.8z" fill="currentColor" />
          </svg>
        </button>
        <div class="display ${anim ? 'display--animating' : ''}" aria-hidden="true">
          <span class="letter letter--current ${anim ? 'letter--hidden' : ''}">${value}</span>
          ${anim
            ? html`
                <span
                  class="letter ${anim.direction === -1 ? 'letter--slide-out-down' : 'letter--slide-out-up'}"
                  >${anim.outgoing}</span
                >
                <span
                  class="letter ${anim.direction === -1 ? 'letter--slide-in-up' : 'letter--slide-in-down'}"
                  >${anim.incoming}</span
                >
              `
            : nothing}
        </div>
        <button
          type="button"
          class="btn btn--down"
          aria-label=${i18n.t('wheelPicker.next', WheelPickerSpecs.accessibility.nextLabel)}
          @click=${() => this.cycle(index, 1)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z" fill="currentColor" />
          </svg>
        </button>
      </div>
    `;
  }

  override render() {
    return html`
      ${this.showPreview
        ? html`
            <div class="preview" part="preview">
              ${this.values.map(
                (char) => html`<span class="preview-char" part="preview-char">${char}</span>`,
              )}
            </div>
          `
        : nothing}
      <div class="wheels" part="wheels" aria-label=${i18n.t('wheelPicker.columns', WheelPickerSpecs.accessibility.wheelsLabel)}>
        ${this.values.map((_, i) => this.renderColumn(i))}
      </div>
      ${this.showSubmitButton
        ? html`
            <button
              type="button"
              class="submit ${this.saved ? 'submit--saved' : ''}"
              part="submit"
              @click=${() => this.onSubmit()}
            >
              ${this.saved ? this.submittedText : this.submitText}
            </button>
          `
        : nothing}
    `;
  }
}

export default K3WheelPicker;

if (!customElements.get('k3-wheel-picker')) {
  customElements.define('k3-wheel-picker', K3WheelPicker);
}
