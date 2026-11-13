import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../../_shared.js';
import { holoCardStyles } from './holo-card.styles.js';
import { CardSpring, clamp, pointerRatio, watchDeviceTilt } from './card-motion.js';

export const HoloCardSpecs = {
  /** Maximum tilt in degrees. */
  maxRotate: 15,
  /** Delay before the card settles back once the pointer leaves (ms). */
  resetDelayMs: 250,
  /** Spring while following the pointer. */
  follow: { stiffness: 220, damping: 24 },
  /** Spring back to rest — softer, with a little bounce. */
  settle: { stiffness: 90, damping: 11 },
  /** Device tilt (degrees) that reaches the edge of the card. */
  motionRange: 20,
} as const;

/**
 * `prism` (built in) · `none` · the 13 foils of the optional `k3ux/holo-effects.css`
 * add-on (GPL-3.0) · any other name for your own `::part()` stylesheet.
 */
export type HoloCardEffect =
  | 'prism'
  | 'none'
  | 'holo'
  | 'reverse'
  | 'cosmos'
  | 'rainbow'
  | 'rainbow-alt'
  | 'secret'
  | 'v'
  | 'vmax'
  | 'vstar'
  | 'full-art'
  | 'shiny'
  | 'radiant'
  | 'full-art-wave'
  | (string & {});

type HoloState = 'rotateX' | 'rotateY' | 'pointerX' | 'pointerY' | 'backgroundX' | 'backgroundY' | 'opacity';

const REST: Record<HoloState, number> = {
  rotateX: 0,
  rotateY: 0,
  pointerX: 50,
  pointerY: 50,
  backgroundX: 50,
  backgroundY: 50,
  opacity: 0,
};

/**
 * Holographic card — tilts in 3D toward the pointer (mouse, touch or device
 * tilt) while a rainbow foil and a glare follow the light.
 *
 * ```html
 * <k3-holo-card>
 *   <img src="card.png" alt="Aurora crystal" />
 * </k3-holo-card>
 * ```
 *
 * Built-in effect: `prism`. Thirteen more foils (`holo`, `reverse`, `cosmos`,
 * `rainbow`, `rainbow-alt`, `secret`, `v`, `vmax`, `vstar`, `full-art`, `shiny`,
 * `radiant`, `full-art-wave`) ship in the optional `k3ux/holo-effects.css`
 * add-on — GPL-3.0, kept outside the MIT bundle:
 *
 * ```js
 * import 'k3ux/holo-effects.css';
 * ```
 *
 * Any other `effect` value paints no foil, so your own stylesheet can style
 * `::part(card|shine|glare)` (and their `::before` / `::after`) from the host
 * variables `--k3-holo-pointer-x|y`, `--k3-holo-pointer-from-center|left|top`,
 * `--k3-holo-background-x|y`, `--k3-holo-opacity`, `--k3-holo-seed-x|y`.
 *
 * @slot - Card artwork (`<img>`, `<picture>`, `<svg>` …)
 * @csspart card — tilted card, clips the light layers
 * @csspart shine — foil layer
 * @csspart glare — light reflection
 * @cssprop --k3-holo-card-radius — corner radius
 * @cssprop --k3-holo-card-intensity — light strength (0 … 1.5)
 * @cssprop --k3-holo-card-hover-scale — scale while active (1 = none)
 * @cssprop --k3-holo-card-touch-action — `pan-y` (default) · `none` to tilt in every direction with a finger
 */
export class K3HoloCard extends K3Element {
  static override styles = [hostReset, holoCardStyles];

  /** Light effect. */
  @property({ reflect: true }) effect: HoloCardEffect = 'prism';
  /** Maximum tilt (degrees); 0 keeps the card flat. */
  @property({ type: Number, attribute: 'max-rotate' }) maxRotate: number = HoloCardSpecs.maxRotate;
  /** Delay before settling back (ms). */
  @property({ type: Number, attribute: 'reset-delay' }) resetDelay: number = HoloCardSpecs.resetDelayMs;
  /** Device tilt (degrees) that reaches the card edge, once `enableMotion()` ran. */
  @property({ type: Number, attribute: 'motion-range' }) motionRange: number = HoloCardSpecs.motionRange;

  private readonly spring = new CardSpring<HoloState>({ ...REST }, HoloCardSpecs.follow, () => this.paint());
  private resetTimer = 0;
  private touchId: number | null = null;
  private motion: AbortController | null = null;
  private baseline: { side: number; front: number } | null = null;

  /** true while device tilt drives the card. */
  get motionActive(): boolean {
    return this.motion !== null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    /* Per-card random seed — offsets textures of external effects */
    for (const axis of ['x', 'y']) {
      if (!this.style.getPropertyValue(`--k3-holo-seed-${axis}`)) {
        this.style.setProperty(`--k3-holo-seed-${axis}`, Math.random().toFixed(3));
      }
    }
    this.addEventListener('pointerdown', this.onDown);
    this.addEventListener('pointermove', this.onMove);
    this.addEventListener('pointerleave', this.onRelease);
    this.addEventListener('pointerup', this.onRelease);
    this.addEventListener('pointercancel', this.onRelease);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('pointerdown', this.onDown);
    this.removeEventListener('pointermove', this.onMove);
    this.removeEventListener('pointerleave', this.onRelease);
    this.removeEventListener('pointerup', this.onRelease);
    this.removeEventListener('pointercancel', this.onRelease);
    this.disableMotion();
    window.clearTimeout(this.resetTimer);
    this.spring.stop();
    super.disconnectedCallback();
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

  /** Back to pointer / touch only. */
  disableMotion(): void {
    if (!this.motion) return;
    this.motion.abort();
    this.motion = null;
    this.settle();
  }

  /* ── Input ────────────────────────────────────────────────────────── */

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') return;
    this.touchId = event.pointerId;
    this.onMove(event);
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' && event.pointerId !== this.touchId) return;
    const point = pointerRatio(this, event);
    if (point) this.aim(point.x * 2 - 1, point.y * 2 - 1, true);
  };

  private readonly onRelease = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse') {
      /* A click is not a release — only leaving the card is */
      if (event.type !== 'pointerleave') return;
    } else {
      if (event.pointerId !== this.touchId) return;
      this.touchId = null;
    }
    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => this.settle(), Math.max(0, this.resetDelay));
  };

  private onTilt(tilt: { side: number; front: number }): void {
    if (this.touchId !== null) return; /* the finger keeps control while it touches */
    if (!this.baseline) this.baseline = tilt;
    const range = Math.max(1, this.motionRange);
    this.aim(
      clamp((tilt.side - this.baseline.side) / range, -1, 1),
      clamp((tilt.front - this.baseline.front) / range, -1, 1),
      false,
    );
  }

  /** Look at the card from (dx, dy), each −1 … 1 from the centre. */
  private aim(dx: number, dy: number, tilt: boolean): void {
    window.clearTimeout(this.resetTimer);
    const still = prefersReducedMotion();
    /* The device already tilts with motion input: keep the card flat */
    const max = still || !tilt ? 0 : Math.max(0, this.maxRotate);
    this.toggleAttribute('data-active', true);
    this.spring.config = HoloCardSpecs.follow;
    this.spring.to(
      {
        /* The hovered side lifts toward the viewer */
        rotateX: dy * max,
        rotateY: -dx * max,
        pointerX: 50 + dx * 50,
        pointerY: 50 + dy * 50,
        /* 37 % … 63 %: each effect amplifies it its own way */
        backgroundX: 50 + dx * 13,
        backgroundY: 50 + dy * 13,
        opacity: 1,
      },
      still,
    );
  }

  private settle(): void {
    if (this.motion) return;
    this.toggleAttribute('data-active', false);
    this.spring.config = HoloCardSpecs.settle;
    this.spring.to({ ...REST }, prefersReducedMotion());
  }

  /** Spring state → host custom properties (read by the shadow and by ::part styles). */
  private paint(): void {
    const { rotateX, rotateY, pointerX, pointerY, backgroundX, backgroundY, opacity } = this.spring.value;
    const fromCenter = clamp(Math.hypot(pointerX - 50, pointerY - 50) / 50, 0, 1);
    const style = this.style;
    style.setProperty('--k3-holo-rotate-x', `${rotateX.toFixed(2)}deg`);
    style.setProperty('--k3-holo-rotate-y', `${rotateY.toFixed(2)}deg`);
    style.setProperty('--k3-holo-pointer-x', `${pointerX.toFixed(2)}%`);
    style.setProperty('--k3-holo-pointer-y', `${pointerY.toFixed(2)}%`);
    style.setProperty('--k3-holo-pointer-from-center', fromCenter.toFixed(3));
    style.setProperty('--k3-holo-pointer-from-left', (pointerX / 100).toFixed(3));
    style.setProperty('--k3-holo-pointer-from-top', (pointerY / 100).toFixed(3));
    style.setProperty('--k3-holo-background-x', `${backgroundX.toFixed(2)}%`);
    style.setProperty('--k3-holo-background-y', `${backgroundY.toFixed(2)}%`);
    style.setProperty('--k3-holo-opacity', clamp(opacity, 0, 1).toFixed(3));
  }

  override render() {
    return html`
      <div class="card" part="card">
        <slot></slot>
        <div class="shine" part="shine" aria-hidden="true"></div>
        <div class="glare" part="glare" aria-hidden="true"></div>
      </div>
    `;
  }
}

export default K3HoloCard;

if (!customElements.get('k3-holo-card')) {
  customElements.define('k3-holo-card', K3HoloCard);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-holo-card': K3HoloCard;
  }
}
