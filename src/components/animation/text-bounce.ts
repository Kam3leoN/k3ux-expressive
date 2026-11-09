import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion, easings } from 'k3ui';
import { hostReset } from '../_shared.js';
import { textBounceStyles } from './text-bounce.styles.js';

export const TextBounceSpecs = {
  /** Peak lift (CSS length) — Anime.js demo `-2.75rem`. */
  lift: '-2.75rem',
  /** Rise (outExpo) ms. */
  riseMs: 500,
  /** Pause at apex before fall (ms). */
  apexDelayMs: 50,
  /** Fall + 2 bounces (ms) — snappier than Anime’s 800. */
  fallMs: 480,
  staggerMs: 50,
  /** Pause between infinite cycles (Anime.js `loopDelay`). */
  loopDelayMs: 1000,
} as const;

/** Active motion only (rise + apex + fall) — excludes loop pause. */
function activeDurationMs(): number {
  return TextBounceSpecs.riseMs + TextBounceSpecs.apexDelayMs + TextBounceSpecs.fallMs;
}

/**
 * WAAPI stand-in for Anime.js:
 * - rise: outExpo + spin `-1turn → 0` in the air
 * - fall: 2 bounces only, no rotation
 * - optional trailing hold = `loopDelay`
 */
function bounceFlipKeyframes(lift: string, loopPauseMs: number): Keyframe[] {
  const total = activeDurationMs() + Math.max(0, loopPauseMs);
  const t = (ms: number) => ms / total;

  const riseEnd = t(TextBounceSpecs.riseMs);
  const apexEnd = t(TextBounceSpecs.riseMs + TextBounceSpecs.apexDelayMs);
  const fall = TextBounceSpecs.fallMs;
  const fallAt = (p: number) => apexEnd + (p * fall) / total;

  const frames: Keyframe[] = [
    {
      transform: 'translate3d(0, 0, 0) rotate(-1turn)',
      offset: 0,
      easing: easings.outExpo,
    },
    {
      transform: `translate3d(0, ${lift}, 0) rotate(0turn)`,
      offset: riseEnd,
    },
    {
      transform: `translate3d(0, ${lift}, 0) rotate(0turn)`,
      offset: apexEnd,
      easing: 'linear',
    },
    /* Fast drop to ground */
    {
      transform: 'translate3d(0, 0, 0) rotate(0turn)',
      offset: fallAt(0.32),
    },
    /* Bounce 1 */
    {
      transform: 'translate3d(0, -0.7rem, 0) rotate(0turn)',
      offset: fallAt(0.48),
    },
    {
      transform: 'translate3d(0, 0, 0) rotate(0turn)',
      offset: fallAt(0.62),
    },
    /* Bounce 2 */
    {
      transform: 'translate3d(0, -0.28rem, 0) rotate(0turn)',
      offset: fallAt(0.76),
    },
    {
      transform: 'translate3d(0, 0, 0) rotate(0turn)',
      offset: fallAt(0.9),
    },
    {
      transform: 'translate3d(0, 0, 0) rotate(0turn)',
      offset: fallAt(1),
    },
  ];

  if (loopPauseMs > 0) {
    frames.push({
      transform: 'translate3d(0, 0, 0) rotate(0turn)',
      offset: 1,
    });
  }

  return frames;
}

/**
 * Letter bounce — staggered flip-in-air + 2-hop bounce-down (WAAPI, no animejs).
 *
 * ```html
 * <k3-text-bounce text="HELLO WORLD" loop loop-delay="1000"></k3-text-bounce>
 * ```
 */
export class K3TextBounce extends K3Element {
  static override styles = [hostReset, textBounceStyles];

  @property() text = 'HELLO WORLD';
  @property({ type: Boolean, reflect: true }) loop = false;
  @property({ type: Boolean }) autoplay = true;
  @property({ type: Number }) stagger = TextBounceSpecs.staggerMs;
  @property({ type: Number, attribute: 'loop-delay' }) loopDelay =
    TextBounceSpecs.loopDelayMs;

  private animations: Animation[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'text');
  }

  override disconnectedCallback(): void {
    this.stop();
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (
      changed.has('text') ||
      changed.has('loop') ||
      changed.has('stagger') ||
      changed.has('loopDelay')
    ) {
      void this.updateComplete.then(() => {
        if (this.autoplay) this.play();
      });
    }
  }

  play(): void {
    this.stop();
    if (prefersReducedMotion()) return;
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') {
      return;
    }
    const chars = this.renderRoot.querySelectorAll<HTMLElement>('.char:not(.char--space)');
    if (!chars.length) return;

    const pause = this.loop ? Math.max(0, this.loopDelay) : 0;
    const duration = activeDurationMs() + pause;
    const frames = bounceFlipKeyframes(TextBounceSpecs.lift, pause);

    chars.forEach((el, i) => {
      el.style.transformOrigin = 'center center';
      const anim = el.animate(frames, {
        duration,
        delay: i * this.stagger,
        iterations: this.loop ? Infinity : 1,
        easing: 'linear',
        fill: 'both',
      });
      this.animations.push(anim);
    });
  }

  stop(): void {
    for (const a of this.animations) {
      try {
        a.cancel();
      } catch {
        /* already finished */
      }
    }
    this.animations = [];
  }

  restart(): void {
    this.play();
  }

  private get chars(): string[] {
    return [...this.text];
  }

  override render() {
    /* Readable text for assistive tech; the animated letters are decorative.
       (aria-label is not allowed on a <p> without a role.) */
    return html`<p class="stage">
      <span class="sr-only">${this.text}</span>
      ${this.chars.map((ch) =>
        ch === ' '
          ? html`<span class="char char--space" aria-hidden="true">&nbsp;</span>`
          : html`<span class="char" aria-hidden="true">${ch}</span>`,
      )}
    </p>`;
  }
}

export default K3TextBounce;

if (!customElements.get('k3-text-bounce')) {
  customElements.define('k3-text-bounce', K3TextBounce);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-text-bounce': K3TextBounce;
  }
}
