import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../_shared.js';
import { i18n } from 'k3ui';
import {
  CountdownSpecs,
  formatCountdownTime,
  getSegmentValue,
  msToCountdownTime,
  padCountdownUnit,
  parseCountdownFormat,
  type CountdownTimeData,
} from './countdown.specs.js';
import { countdownStyles } from './countdown.styles.js';

export type { CountdownTimeData } from './countdown.specs.js';
export {
  CountdownSpecs,
  formatCountdownTime,
  msToCountdownTime,
  parseCountdownFormat,
} from './countdown.specs.js';

/**
 * Countdown timer — duration or absolute end date, optional segment display.
 *
 * @fires k3-change — `{ remaining }` (ms)
 * @fires k3-end — when the countdown reaches zero
 */
export class K3Countdown extends K3Element {
  static override styles = [hostReset, countdownStyles];

  /** Initial duration in ms (ignored when `end-date` is set). */
  @property({ type: Number }) time = CountdownSpecs.defaultTime;
  /** ISO end timestamp — takes priority over `time`. */
  @property({ attribute: 'end-date' }) endDate: string | null = null;
  @property() format = CountdownSpecs.defaultFormat;
  @property({ attribute: 'end-message' }) endMessage = '';
  /**
   * Start ticking on connect (default true).
   * Lit Boolean attributes normally treat absence as false — custom converter
   * keeps the default true unless `auto-start="false"` or the prop is set false.
   */
  @property({
    attribute: 'auto-start',
    reflect: true,
    converter: {
      fromAttribute: (value: string | null): boolean => {
        if (value === null) return true;
        if (value === 'false' || value === '0') return false;
        return true;
      },
      toAttribute: (value: boolean): string | null => (value ? '' : 'false'),
    },
  })
  autoStart = CountdownSpecs.defaultAutoStart;
  @property({ type: Boolean, attribute: 'short-labels' }) shortLabels = CountdownSpecs.defaultShortLabels;
  /** Render HH / mm / ss as separate cells (parsed from `format`). */
  @property({ type: Boolean, reflect: true }) segments = false;
  /** Show unit labels under each segment (requires `segments`). */
  @property({ type: Boolean, attribute: 'with-labels', reflect: true }) withLabels = false;

  @state() private remainingMs = 0;
  @state() private ended = false;
  @state() private running = false;

  private endTimestamp = 0;
  private useEndDate = false;
  private durationAnchor = 0;
  private tickHandle = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', CountdownSpecs.accessibility.role);
    this.setAttribute('aria-live', CountdownSpecs.accessibility.live);
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', i18n.t('countdown.ariaLabel', CountdownSpecs.accessibility.ariaLabel));
    }
    this.resolveEndMode();
    this.syncRemainingFromClock(false);
    if (this.autoStart) this.start();
  }

  override disconnectedCallback(): void {
    this.stopTick();
    super.disconnectedCallback();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('endDate') || changed.has('time')) {
      this.applyTargetChange(changed.has('endDate'));
    }
    if (changed.has('format') && this.segments) this.requestUpdate();
  }

  /**
   * Re-bind duration / end-date after a prop change.
   * Restarts when the clock was running or auto-start is on.
   */
  private applyTargetChange(endDateChanged: boolean): void {
    const shouldRun = this.running || this.autoStart;
    this.running = false;
    this.stopTick();
    this.ended = false;
    this.removeAttribute('ended');
    this.resolveEndMode();
    if (!this.useEndDate) {
      this.remainingMs = Math.max(0, this.time);
      this.durationAnchor = 0;
      this.endTimestamp = 0;
    } else {
      this.syncRemainingFromClock(false);
    }
    if (endDateChanged && this.useEndDate && this.remainingMs <= 0) {
      this.applyEndedState();
      this.emit('k3-change', { remaining: 0 });
      this.emit('k3-end');
      return;
    }
    this.emit('k3-change', { remaining: this.remainingMs });
    if (shouldRun && !this.ended) {
      /* Defer start — avoid Lit change-in-update when props flip mid-cycle. */
      queueMicrotask(() => {
        if (!this.ended) this.start();
      });
    } else {
      this.requestUpdate();
    }
  }

  /** Start or resume the countdown. */
  start(): void {
    if (this.ended) return;
    if (!this.useEndDate && !this.running) {
      this.durationAnchor = performance.now();
      this.endTimestamp = this.durationAnchor + (this.remainingMs || Math.max(0, this.time));
    } else if (this.useEndDate) {
      this.syncRemainingFromClock(false);
      if (this.ended) return;
    }
    this.running = true;
    this.scheduleTick();
  }

  /** Pause the countdown. */
  pause(): void {
    if (!this.running) return;
    this.syncRemainingFromClock(true);
    this.running = false;
    this.stopTick();
  }

  /** Reset to initial duration / end date without auto-start. */
  reset(): void {
    this.running = false;
    this.stopTick();
    this.ended = false;
    this.removeAttribute('ended');
    this.resolveEndMode();
    this.syncRemainingFromClock(false);
    this.requestUpdate();
  }

  /** Remaining time in milliseconds. */
  getRemainingTime(): number {
    return this.remainingMs;
  }

  private resolveEndMode(): void {
    if (this.endDate) {
      const ts = new Date(this.endDate).getTime();
      if (Number.isFinite(ts)) {
        this.useEndDate = true;
        this.endTimestamp = ts;
        return;
      }
    }
    this.useEndDate = false;
    this.endTimestamp = 0;
    this.durationAnchor = 0;
  }

  private syncRemainingFromClock(fromRunning: boolean): void {
    if (this.useEndDate) {
      this.remainingMs = Math.max(0, this.endTimestamp - Date.now());
    } else if (fromRunning && this.endTimestamp) {
      this.remainingMs = Math.max(0, this.endTimestamp - performance.now());
    } else {
      this.remainingMs = Math.max(0, this.time);
    }
    this.applyEndedState();
    if (!this.ended) {
      this.emit('k3-change', { remaining: this.remainingMs });
    }
  }

  private scheduleTick(): void {
    this.stopTick();
    const tick = (): void => {
      if (!this.running) return;
      if (this.useEndDate) {
        this.remainingMs = Math.max(0, this.endTimestamp - Date.now());
      } else {
        this.remainingMs = Math.max(0, this.endTimestamp - performance.now());
      }

      if (this.remainingMs <= 0) {
        this.remainingMs = 0;
        this.running = false;
        this.applyEndedState();
        this.emit('k3-change', { remaining: 0 });
        this.emit('k3-end');
        return;
      }

      this.ended = false;
      this.removeAttribute('ended');
      this.emit('k3-change', { remaining: this.remainingMs });
      this.requestUpdate();

      if (prefersReducedMotion()) {
        this.tickHandle = window.setTimeout(tick, 1000) as unknown as number;
      } else {
        this.tickHandle = requestAnimationFrame(tick) as unknown as number;
      }
    };
    tick();
  }

  private stopTick(): void {
    if (!this.tickHandle) return;
    if (prefersReducedMotion()) clearTimeout(this.tickHandle);
    else cancelAnimationFrame(this.tickHandle);
    this.tickHandle = 0;
  }

  private applyEndedState(): void {
    const isEnd = this.remainingMs <= 0 && (this.useEndDate || this.time > 0);
    if (!isEnd) return;
    this.ended = true;
    this.setAttribute('ended', '');
    this.running = false;
    this.stopTick();
  }

  private segmentLabel(unit: string, value: number): string {
    const key = unit as keyof typeof CountdownSpecs.unitLabels;
    if (this.shortLabels) {
      const short = CountdownSpecs.unitLabelsShort[key as keyof typeof CountdownSpecs.unitLabelsShort];
      if (short) return i18n.t(`countdown.unit.${key}.short`, short);
    }
    const labels = CountdownSpecs.unitLabels[key];
    if (!labels) return unit;
    const form = value === 1 ? 'one' : 'other';
    return i18n.t(`countdown.unit.${key}.${form}`, labels[form]);
  }

  private renderSegments(timeData: CountdownTimeData) {
    const parts = parseCountdownFormat(this.format);
    return html`
      <span class="display display--segments" aria-hidden="true">
        ${parts.map((part) => {
          if (part.kind === 'sep') {
            return html`<span class="separator">${part.text}</span>`;
          }
          const val = getSegmentValue(part.unit, timeData);
          const text = padCountdownUnit(String(val), 2, '0');
          if (this.withLabels) {
            return html`
              <span class="segment-cell">
                <span class="segment" data-unit=${part.unit}>${text}</span>
                <span class="segment-label">${this.segmentLabel(part.unit, val)}</span>
              </span>
            `;
          }
          return html`<span class="segment" data-unit=${part.unit}>${text}</span>`;
        })}
      </span>
    `;
  }

  override render() {
    if (this.ended) {
      const message =
        this.endMessage.trim() || i18n.t('countdown.end', CountdownSpecs.defaultEndMessage);
      return html`<span class="message" part="message">${message}</span>`;
    }

    const timeData = msToCountdownTime(this.remainingMs);
    if (this.segments) {
      return this.renderSegments(timeData);
    }

    const text = formatCountdownTime(this.format, timeData);
    return html`<span class="display" part="display" aria-hidden="true">${text}</span>`;
  }
}

export default K3Countdown;

if (!customElements.get('k3-countdown')) {
  customElements.define('k3-countdown', K3Countdown);
}
