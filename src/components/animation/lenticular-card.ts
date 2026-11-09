import { html, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion, i18n } from 'k3ui';
import { hostReset } from '../_shared.js';
import { lenticularCardStyles } from './lenticular-card.styles.js';
import { CardSpring, clamp, pointerRatio, watchDeviceTilt } from './card-motion.js';

export const LenticularCardSpecs = {
  /** Maximum tilt in degrees. */
  maxRotate: 12,
  /** Width of a switch between two views, in views (0 = sharp … 1 = very gradual). */
  transition: 0.5,
  /** Delay before going back to the rest view once the pointer leaves (ms). */
  resetDelayMs: 400,
  /** Device tilt (degrees) from the rest view to the last one. */
  motionRange: 20,
  /** The first and last views are reached before the edges (share of the width). */
  edge: 0.1,
  follow: { stiffness: 250, damping: 32 },
  settle: { stiffness: 120, damping: 22 },
} as const;

export type LenticularAxis = 'x' | 'y';

type LenticularState = 'view' | 'rotateX' | 'rotateY' | 'pointerX' | 'pointerY' | 'glow';

function smoothstep(start: number, end: number, value: number): number {
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function frameLabel(frame: Element): string {
  return (
    frame.getAttribute('alt') ||
    frame.getAttribute('aria-label') ||
    frame.querySelector('img[alt]')?.getAttribute('alt') ||
    ''
  );
}

/**
 * Lenticular card — like a 3D postcard: tilting the card (mouse, touch, keys
 * or the device itself) switches between its views, which interleave in thin
 * stripes during the switch, under ridged plastic.
 *
 * ```html
 * <k3-lenticular-card>
 *   <img src="day.jpg" alt="The city by day" />
 *   <img src="night.jpg" alt="The city by night" />
 * </k3-lenticular-card>
 * ```
 *
 * Each child becomes a view (its `slot` attribute is set to `frame-N`).
 *
 * @slot - Views, first to last (`<img>`, `<picture>`, `<svg>` …)
 * @fires k3-change — `{ index, label }` when the most visible view changes
 * @csspart card — tilted card
 * @csspart frame — wrapper of each view
 * @csspart lens — plastic ridges
 * @cssprop --k3-lenticular-card-radius — corner radius
 * @cssprop --k3-lenticular-card-pitch — lens width, i.e. stripe size (4px)
 * @cssprop --k3-lenticular-card-ridges — ridge visibility (0 … 1)
 * @cssprop --k3-lenticular-card-sheen — sheen strength (0 … 1)
 * @cssprop --k3-lenticular-card-touch-action — `pan-y` by default (`pan-x` for axis y)
 */
export class K3LenticularCard extends K3Element {
  static override styles = [hostReset, lenticularCardStyles];

  /** `x`: views change left → right · `y`: top → bottom. */
  @property({ reflect: true }) axis: LenticularAxis = 'x';
  /** View shown at rest (0 = first). */
  @property({ type: Number, attribute: 'rest-frame' }) restFrame = 0;
  /** Maximum tilt (degrees); 0 keeps the card flat. */
  @property({ type: Number, attribute: 'max-rotate' }) maxRotate: number = LenticularCardSpecs.maxRotate;
  /** Switch width between two views (0 = sharp … 1 = gradual). */
  @property({ type: Number }) transition: number = LenticularCardSpecs.transition;
  /** Delay before going back to rest (ms). */
  @property({ type: Number, attribute: 'reset-delay' }) resetDelay: number = LenticularCardSpecs.resetDelayMs;
  /** Device tilt (degrees) from rest to the last view, once `enableMotion()` ran. */
  @property({ type: Number, attribute: 'motion-range' }) motionRange: number = LenticularCardSpecs.motionRange;
  /** Arrow / Home / End keys switch views (`keyboard="false"` to turn off). */
  @property({ attribute: 'keyboard', converter: { fromAttribute: (value: string | null) => value !== 'false' } })
  keyboard = true;

  @state() private count = 0;
  @state() private announcement = '';

  private frames: Element[] = [];
  private current = -1;
  private resetTimer = 0;
  private touchId: number | null = null;
  private motion: AbortController | null = null;
  private baseline: { side: number; front: number } | null = null;
  private readonly spring = new CardSpring<LenticularState>(
    { view: 0, rotateX: 0, rotateY: 0, pointerX: 50, pointerY: 50, glow: 0 },
    LenticularCardSpecs.follow,
    () => this.paint(),
  );

  /** Index of the most visible view. */
  get index(): number {
    return this.current;
  }

  /** true while device tilt drives the card. */
  get motionActive(): boolean {
    return this.motion !== null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'group');
    this.addEventListener('pointerdown', this.onDown);
    this.addEventListener('pointermove', this.onMove);
    this.addEventListener('pointerleave', this.onRelease);
    this.addEventListener('pointerup', this.onRelease);
    this.addEventListener('pointercancel', this.onRelease);
    this.addEventListener('keydown', this.onKey);
    this.syncFrames();
    this.spring.to({ view: this.restIndex() }, true);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('pointerdown', this.onDown);
    this.removeEventListener('pointermove', this.onMove);
    this.removeEventListener('pointerleave', this.onRelease);
    this.removeEventListener('pointerup', this.onRelease);
    this.removeEventListener('pointercancel', this.onRelease);
    this.removeEventListener('keydown', this.onKey);
    this.disableMotion();
    window.clearTimeout(this.resetTimer);
    this.spring.stop();
    super.disconnectedCallback();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.setAttribute('aria-roledescription', i18n.t('lenticularCard.roleDescription', 'lenticular image'));
    if (this.keyboard && !this.hasAttribute('tabindex')) this.tabIndex = 0;
    if (!this.keyboard && this.getAttribute('tabindex') === '0') this.removeAttribute('tabindex');
    if (changed.has('restFrame') && !this.matches(':hover')) this.settle();
    /* Also after a locale change: the view names (alt) may have been translated */
    this.paint(true);
  }

  /** Go to a view (animated) and stay there. */
  show(index: number): void {
    const last = Math.max(0, this.frames.length - 1);
    const target = clamp(Math.round(index), 0, last);
    window.clearTimeout(this.resetTimer);
    /* Slight tilt toward the side of the chosen view, as if turning the card */
    const side = last > 0 ? target / last - 0.5 : 0;
    const tilt = prefersReducedMotion() ? 0 : Math.max(0, this.maxRotate);
    this.spring.config = LenticularCardSpecs.follow;
    this.spring.to(
      {
        view: target,
        rotateX: this.axis === 'y' ? -side * tilt : 0,
        rotateY: this.axis === 'x' ? side * tilt : 0,
        pointerX: this.axis === 'x' ? 50 + side * 80 : 50,
        pointerY: this.axis === 'y' ? 50 + side * 80 : 50,
        glow: 0.6,
      },
      prefersReducedMotion(),
    );
    const label = frameLabel(this.frames[target] ?? this);
    const vars = { index: target + 1, total: this.frames.length, label };
    this.announcement = label
      ? i18n.t('lenticularCard.announceLabel', 'View {index} of {total}: {label}', vars)
      : i18n.t('lenticularCard.announce', 'View {index} of {total}', vars);
  }

  /**
   * Follow the device tilt. Call from a click / tap — iOS asks for permission.
   * Resolves `true` once the sensor answers, `false` otherwise.
   */
  async enableMotion(): Promise<boolean> {
    if (this.motion) return true;
    const controller = new AbortController();
    this.motion = controller;
    this.baseline = null;
    const ok = await watchDeviceTilt((tilt) => this.onTilt(tilt), controller.signal);
    if (!ok && this.motion === controller) {
      controller.abort();
      this.motion = null;
    }
    return ok;
  }

  /** Back to pointer / touch / keys only. */
  disableMotion(): void {
    if (!this.motion) return;
    this.motion.abort();
    this.motion = null;
    this.settle();
  }

  /* ── Views ────────────────────────────────────────────────────────── */

  private restIndex(): number {
    return clamp(Math.round(this.restFrame), 0, Math.max(0, this.frames.length - 1));
  }

  /** Every child is a view, routed to its own slot. */
  private syncFrames(): void {
    const frames = Array.from(this.children).filter(
      (el) => !(el instanceof HTMLTemplateElement || el instanceof HTMLScriptElement || el instanceof HTMLStyleElement),
    );
    frames.forEach((el, i) => {
      const name = `frame-${i}`;
      if (el.getAttribute('slot') !== name) el.setAttribute('slot', name);
      if (el instanceof HTMLImageElement) el.draggable = false;
    });
    this.frames = frames;
    this.count = frames.length;
  }

  private readonly onIntake = (): void => {
    this.syncFrames();
    this.paint(true);
  };

  /* ── Input ────────────────────────────────────────────────────────── */

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return;
    this.touchId = event.pointerId;
    this.setPointerCapture?.(event.pointerId);
    this.onMove(event);
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' && event.pointerId !== this.touchId) return;
    const point = pointerRatio(this, event);
    if (point) this.aim(point.x, point.y);
  };

  private readonly onRelease = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      if (event.type !== 'pointerleave') return; /* a click is not a release */
    } else {
      if (event.pointerId !== this.touchId) return;
      this.touchId = null;
    }
    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => this.settle(), Math.max(0, this.resetDelay));
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (!this.keyboard || event.altKey || event.ctrlKey || event.metaKey) return;
    const last = this.frames.length - 1;
    const rtl = getComputedStyle(this).direction === 'rtl' && this.axis === 'x';
    const step: Record<string, number> = {
      ArrowRight: rtl ? -1 : 1,
      ArrowLeft: rtl ? 1 : -1,
      ArrowDown: 1,
      ArrowUp: -1,
    };
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    else if (event.key in step) next = this.current + step[event.key]!;
    else return;
    event.preventDefault();
    this.show(clamp(next, 0, last));
  };

  /** Aim at (x, y), each 0 … 1 over the card. */
  private aim(x: number, y: number): void {
    window.clearTimeout(this.resetTimer);
    const last = Math.max(0, this.frames.length - 1);
    const edge = LenticularCardSpecs.edge;
    const along = this.axis === 'x' ? x : y;
    const t = clamp((along - edge) / (1 - 2 * edge), 0, 1);
    const still = prefersReducedMotion();
    const tilt = still ? 0 : Math.max(0, this.maxRotate);
    this.spring.config = LenticularCardSpecs.follow;
    this.spring.to(
      {
        view: t * last,
        /* Mostly around the switching axis, a little around the other one */
        rotateY: (x - 0.5) * 2 * tilt * (this.axis === 'x' ? 1 : 0.35),
        rotateX: -(y - 0.5) * 2 * tilt * (this.axis === 'y' ? 1 : 0.35),
        pointerX: x * 100,
        pointerY: y * 100,
        glow: 1,
      },
      still,
    );
  }

  private onTilt(tilt: { side: number; front: number }): void {
    if (this.touchId !== null) return; /* the finger keeps control while it touches */
    if (!this.baseline) this.baseline = tilt;
    const value = this.axis === 'x' ? tilt.side - this.baseline.side : tilt.front - this.baseline.front;
    const t = clamp(value / Math.max(1, this.motionRange), -1, 1);
    const last = Math.max(0, this.frames.length - 1);
    this.spring.config = LenticularCardSpecs.follow;
    this.spring.to(
      {
        view: clamp(this.restIndex() + t * last, 0, last),
        /* The device already tilts: the card stays flat, only the sheen slides */
        rotateX: 0,
        rotateY: 0,
        pointerX: this.axis === 'x' ? 50 + t * 50 : 50,
        pointerY: this.axis === 'y' ? 50 + t * 50 : 50,
        glow: 0.4 + Math.abs(t) * 0.6,
      },
      prefersReducedMotion(),
    );
  }

  private settle(): void {
    if (this.motion) return;
    this.spring.config = LenticularCardSpecs.settle;
    this.spring.to(
      { view: this.restIndex(), rotateX: 0, rotateY: 0, pointerX: 50, pointerY: 50, glow: 0 },
      prefersReducedMotion(),
    );
  }

  /* ── Paint ────────────────────────────────────────────────────────── */

  private paint(force = false): void {
    const { view, rotateX, rotateY, pointerX, pointerY, glow } = this.spring.value;
    const last = Math.max(0, this.frames.length - 1);
    const position = clamp(view, 0, last);
    const style = this.style;
    style.setProperty('--k3-lenticular-rotate-x', `${rotateX.toFixed(2)}deg`);
    style.setProperty('--k3-lenticular-rotate-y', `${rotateY.toFixed(2)}deg`);
    style.setProperty('--k3-lenticular-x', `${pointerX.toFixed(1)}%`);
    style.setProperty('--k3-lenticular-y', `${pointerY.toFixed(1)}%`);
    style.setProperty('--k3-lenticular-glow', clamp(glow, 0, 1).toFixed(3));
    style.setProperty('--k3-lenticular-view', position.toFixed(3));

    /* Each view appears in wider and wider stripes as its zone is crossed */
    const width = clamp(this.transition, 0.02, 1);
    const wrappers = this.renderRoot?.querySelectorAll<HTMLElement>('.frame') ?? [];
    wrappers.forEach((wrapper, i) => {
      if (i === 0) return;
      const start = i - 0.5 - width / 2;
      wrapper.style.setProperty('--k3-lenticular-reveal', smoothstep(start, start + width, position).toFixed(3));
    });

    const index = Math.round(position);
    if (this.frames.length && (index !== this.current || force)) {
      const previous = this.current;
      this.current = index;
      const label = frameLabel(this.frames[index]!);
      if (label) this.setAttribute('aria-label', label);
      /* No event for the initial view */
      if (previous !== -1 && previous !== index) this.emit('k3-change', { index, label });
    }
  }

  override render() {
    return html`
      <div class="card" part="card">
        ${Array.from(
          { length: this.count },
          (_, i) => html`<div class="frame" part="frame"><slot name=${`frame-${i}`}></slot></div>`,
        )}
        <div class="lens" part="lens" aria-hidden="true"></div>
      </div>
      <slot class="intake" @slotchange=${this.onIntake}></slot>
      <span class="status" aria-live="polite">${this.announcement}</span>
    `;
  }
}

export default K3LenticularCard;

if (!customElements.get('k3-lenticular-card')) {
  customElements.define('k3-lenticular-card', K3LenticularCard);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-lenticular-card': K3LenticularCard;
  }
}
