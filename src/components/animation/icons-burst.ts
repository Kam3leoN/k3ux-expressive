import { html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion, easings } from 'k3ui';
import { hostReset } from '../_shared.js';
import { iconsBurstStyles } from './icons-burst.styles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const IconsBurstSpecs = {
  count: 10,
  durationMin: 900,
  durationMax: 1600,
  riseMin: 48,
  riseMax: 110,
  /** Shorter flight when `clip` — stay inside the text box without hard CSS cut. */
  riseMinClipped: 20,
  riseMaxClipped: 40,
  drift: 36,
  driftClipped: 12,
  jitter: 10,
  scaleMin: 0.55,
  scaleMax: 1.2,
  pulseMs: 220,
  moveThreshold: 10,
  moveCount: 2,
  /** Extra top pad on the particle layer so unclipped rain can rise. */
  layerPadTop: 120,
  /** Half particle size — keep glyphs fully inside when clip (no mid-cut). */
  particleInset: 12,
} as const;

/** Material-style 24×24 paths. */
const ICON_PATHS = {
  heart:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  like: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
} as const;

export type IconsBurstTrigger = 'hover' | 'click' | 'both';
export type IconsBurstIcon = keyof typeof ICON_PATHS;

/**
 * Pointer-following particles over any slotted surface (button, card, text…).
 * Hit-testing is only on the slotted target’s border box. Use `clip` to keep
 * particle motion inside the target. Without `clip`, particles may rise above.
 */
export class K3IconsBurst extends K3Element {
  static override styles = [hostReset, iconsBurstStyles];

  @property({ reflect: true }) trigger: IconsBurstTrigger = 'hover';
  @property({ type: Number }) count: number = IconsBurstSpecs.count;
  @property({ type: Boolean, attribute: 'continuous' }) continuous = true;
  /** Block layout for cards / full-width targets. */
  @property({ type: Boolean, reflect: true }) block = false;
  /** Keep particle flight inside the target (soft fade, no hard mid-glyph cut). */
  @property({ type: Boolean, reflect: true }) clip = false;
  /** Particle glyph. */
  @property({ reflect: true }) icon: IconsBurstIcon = 'heart';
  @property() color = '';

  @query('.layer') private layer?: HTMLElement;

  private pulseTimer: number | null = null;
  private hovering = false;
  private pointerX = 0;
  private pointerY = 0;
  private hasPointer = false;
  private lastMoveX = 0;
  private lastMoveY = 0;
  private layerW = 0;
  /** Y origin of the target inside the (possibly padded) layer. */
  private layerOriginY = 0;
  private targetH = 0;
  private resizeObs?: ResizeObserver;
  private boundTarget: HTMLElement | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.resizeObs = new ResizeObserver(() => this.layoutLayer());
    this.resizeObs.observe(this);
  }

  override firstUpdated(): void {
    this.bindTarget();
    this.layoutLayer();
  }

  override disconnectedCallback(): void {
    this.stopPulse();
    this.unbindTarget();
    this.resizeObs?.disconnect();
    this.resizeObs = undefined;
    super.disconnectedCallback();
  }

  burst(count?: number): void {
    if (prefersReducedMotion()) return;
    const layer = this.layer;
    if (!layer) return;
    this.layoutLayer();
    this.ensurePointerFallback();
    const n = Math.max(1, Math.floor(count ?? this.count));
    for (let i = 0; i < n; i++) {
      this.spawnParticle(layer, i / n);
    }
  }

  private firstSlotted(): HTMLElement | null {
    const slot = this.renderRoot?.querySelector('slot') as HTMLSlotElement | null;
    const nodes = slot?.assignedElements({ flatten: true }) ?? [];
    for (const n of nodes) {
      if (n instanceof HTMLElement) return n;
    }
    return null;
  }

  /** True only when the pointer is inside the target’s border box. */
  private isInsideTarget(e: PointerEvent, target: HTMLElement = this.boundTarget!): boolean {
    if (!target) return false;
    const r = target.getBoundingClientRect();
    return (
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom
    );
  }

  private unbindTarget(): void {
    if (!this.boundTarget) return;
    this.boundTarget.removeEventListener('pointerenter', this.onEnter);
    this.boundTarget.removeEventListener('pointerleave', this.onLeave);
    this.boundTarget.removeEventListener('pointermove', this.onMove);
    this.boundTarget.removeEventListener('pointerdown', this.onDown);
    this.boundTarget = null;
  }

  private bindTarget(): void {
    const target = this.firstSlotted();
    if (target === this.boundTarget) return;
    this.unbindTarget();
    if (!target) return;
    this.boundTarget = target;
    target.addEventListener('pointerenter', this.onEnter);
    target.addEventListener('pointerleave', this.onLeave);
    target.addEventListener('pointermove', this.onMove);
    target.addEventListener('pointerdown', this.onDown);
    try {
      this.resizeObs?.observe(target);
    } catch {
      /* already observed */
    }
  }

  /**
   * Pin the particle layer to the slotted target’s box.
   * Unclipped: pad above so rain can rise past the target.
   * Clipped: layer = target box only; motion stays inset so glyphs aren’t cut.
   */
  private layoutLayer(): void {
    const layer = this.layer;
    if (!layer) return;

    const target = this.firstSlotted();
    const hostRect = this.getBoundingClientRect();
    if (!target || hostRect.width <= 0) {
      const pad = this.clip ? 0 : IconsBurstSpecs.layerPadTop;
      layer.style.left = '0';
      layer.style.top = `${-pad}px`;
      layer.style.width = '100%';
      layer.style.height = `calc(100% + ${pad}px)`;
      this.layerW = this.clientWidth || 40;
      this.layerOriginY = pad;
      this.targetH = this.clientHeight || 40;
      return;
    }

    const t = target.getBoundingClientRect();
    const left = t.left - hostRect.left + this.scrollLeft;
    const top = t.top - hostRect.top + this.scrollTop;
    const pad = this.clip ? 0 : IconsBurstSpecs.layerPadTop;

    layer.style.left = `${left}px`;
    layer.style.top = `${top - pad}px`;
    layer.style.width = `${Math.max(1, t.width)}px`;
    layer.style.height = `${Math.max(1, t.height + pad)}px`;
    this.layerW = t.width;
    this.layerOriginY = pad;
    this.targetH = t.height;
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
  }

  /** Pointer in layer coords, relative to the target box (not the padded rain area). */
  private syncPointer(e: PointerEvent): void {
    const layer = this.layer;
    if (!layer) return;
    this.layoutLayer();
    const rect = layer.getBoundingClientRect();
    const inset = this.clip ? IconsBurstSpecs.particleInset : 0;
    const xMin = inset;
    const xMax = Math.max(xMin, this.layerW - inset);
    const yMin = this.layerOriginY + inset;
    const yMax = Math.max(yMin, this.layerOriginY + this.targetH - inset);
    this.pointerX = this.clamp(e.clientX - rect.left, xMin, xMax);
    this.pointerY = this.clamp(e.clientY - rect.top, yMin, yMax);
    this.hasPointer = true;
  }

  private ensurePointerFallback(): void {
    if (this.hasPointer) return;
    const inset = this.clip ? IconsBurstSpecs.particleInset : 0;
    this.pointerX = this.layerW / 2;
    this.pointerY =
      this.layerOriginY +
      Math.max(inset, Math.min(this.targetH / 2, this.targetH - inset));
    this.hasPointer = true;
  }

  private readonly onEnter = (e: PointerEvent): void => {
    if (this.trigger !== 'hover' && this.trigger !== 'both') return;
    if (!this.isInsideTarget(e)) return;
    this.hovering = true;
    this.syncPointer(e);
    this.lastMoveX = this.pointerX;
    this.lastMoveY = this.pointerY;
    this.burst();
    if (this.continuous) this.startPulse();
  };

  private readonly onLeave = (e?: PointerEvent): void => {
    /* Ignore leave if the pointer is still inside the border box (child → parent). */
    if (e && this.boundTarget && this.isInsideTarget(e)) return;
    this.hovering = false;
    this.hasPointer = false;
    this.stopPulse();
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (this.trigger !== 'hover' && this.trigger !== 'both') return;
    /* Border = hard limit — leaving the box stops the effect */
    if (!this.isInsideTarget(e)) {
      if (this.hovering) this.onLeave();
      return;
    }
    if (!this.hovering) {
      this.onEnter(e);
      return;
    }
    this.syncPointer(e);
    const dx = this.pointerX - this.lastMoveX;
    const dy = this.pointerY - this.lastMoveY;
    if (dx * dx + dy * dy < IconsBurstSpecs.moveThreshold ** 2) return;
    this.lastMoveX = this.pointerX;
    this.lastMoveY = this.pointerY;
    this.burst(IconsBurstSpecs.moveCount);
  };

  private readonly onDown = (e: PointerEvent): void => {
    if (this.trigger !== 'click' && this.trigger !== 'both') return;
    if (!this.isInsideTarget(e)) return;
    this.syncPointer(e);
    this.burst();
  };

  private startPulse(): void {
    this.stopPulse();
    this.pulseTimer = window.setInterval(() => {
      if (!this.hovering) {
        this.stopPulse();
        return;
      }
      this.burst(Math.max(1, Math.ceil(this.count / 4)));
    }, IconsBurstSpecs.pulseMs);
  }

  private stopPulse(): void {
    if (this.pulseTimer != null) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }

  private spawnParticle(layer: HTMLElement, seed: number): void {
    const path = (Object.hasOwn(ICON_PATHS, this.icon) ? ICON_PATHS[this.icon] : undefined) ?? ICON_PATHS.heart;
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.setAttribute('aria-hidden', 'true');
    if (this.color) particle.style.color = this.color;
    /* DOM API, not innerHTML — no Trusted Types sink, works under a strict CSP. */
    const svgEl = document.createElementNS(SVG_NS, 'svg');
    svgEl.setAttribute('viewBox', '0 0 24 24');
    svgEl.setAttribute('focusable', 'false');
    const pathEl = document.createElementNS(SVG_NS, 'path');
    pathEl.setAttribute('d', path);
    svgEl.append(pathEl);
    particle.append(svgEl);

    const j = IconsBurstSpecs.jitter;
    const inset = this.clip ? IconsBurstSpecs.particleInset : 0;
    const xMin = inset;
    const xMax = Math.max(xMin, this.layerW - inset);
    const yMin = this.layerOriginY + inset;
    const yMax = Math.max(yMin, this.layerOriginY + this.targetH - inset);

    let startX = this.pointerX + (Math.random() - 0.5) * 2 * j;
    let startY = this.pointerY + (Math.random() - 0.5) * 2 * j;
    startX = this.clamp(startX, xMin, xMax);
    startY = this.clamp(startY, yMin, yMax);

    const riseMin = this.clip ? IconsBurstSpecs.riseMinClipped : IconsBurstSpecs.riseMin;
    const riseMax = this.clip ? IconsBurstSpecs.riseMaxClipped : IconsBurstSpecs.riseMax;
    const driftMax = this.clip ? IconsBurstSpecs.driftClipped : IconsBurstSpecs.drift;
    let rise = riseMin + Math.random() * (riseMax - riseMin);
    let drift = (Math.random() - 0.5) * 2 * driftMax;

    if (this.clip) {
      const endX = this.clamp(startX + drift, xMin, xMax);
      const endY = this.clamp(startY - rise, yMin, yMax);
      drift = endX - startX;
      rise = startY - endY;
      if (rise < 8) rise = Math.min(riseMax, Math.max(8, startY - yMin));
    }

    const scale =
      IconsBurstSpecs.scaleMin +
      Math.random() * (IconsBurstSpecs.scaleMax - IconsBurstSpecs.scaleMin);
    const duration =
      IconsBurstSpecs.durationMin +
      Math.random() * (IconsBurstSpecs.durationMax - IconsBurstSpecs.durationMin);

    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    /* Size comes from --k3-icons-burst-particle-size; scale only varies slightly */
    particle.style.transform = 'translate(-50%, -50%)';
    layer.appendChild(particle);

    if (typeof particle.animate !== 'function') {
      particle.remove();
      return;
    }

    try {
      const anim = particle.animate(
        [
          {
            transform: `translate(-50%, -50%) scale(${0.45 * scale}) rotate(${(seed - 0.5) * 20}deg)`,
            opacity: 0,
            offset: 0,
          },
          {
            transform: `translate(calc(-50% + ${drift * 0.35}px), calc(-50% - ${rise * 0.35}px)) scale(${scale}) rotate(${(seed - 0.5) * 10}deg)`,
            opacity: 1,
            offset: 0.18,
            easing: easings.outCubic,
          },
          {
            transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${rise}px)) scale(${scale * 0.85}) rotate(${(Math.random() - 0.5) * 40}deg)`,
            opacity: 0,
            offset: 1,
            easing: easings.outCubic,
          },
        ],
        { duration, fill: 'forwards', easing: 'linear' },
      );

      const cleanup = () => {
        particle.remove();
      };
      anim.finished.then(cleanup).catch(cleanup);
    } catch {
      particle.remove();
    }
  }

  override render() {
    return html`<div class="wrap">
      <slot @slotchange=${this.onSlotChange}></slot>
      <div class="layer" aria-hidden="true"></div>
    </div>`;
  }

  private readonly onSlotChange = (): void => {
    this.bindTarget();
    this.layoutLayer();
  };
}

export default K3IconsBurst;

if (!customElements.get('k3-icons-burst')) {
  customElements.define('k3-icons-burst', K3IconsBurst);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-icons-burst': K3IconsBurst;
  }
}
