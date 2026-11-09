import { html, nothing, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion, i18n } from 'k3ui';
import { hostReset } from '../_shared.js';
import { scratchCardStyles } from './scratch-card.styles.js';
import {
  defaultBrush,
  isMetal,
  loadImage,
  measureCleared,
  paintImage,
  paintMetal,
  scratchAt,
  type ScratchType,
} from './scratch-card.engine.js';

export { type ScratchType, type ScratchMetal } from './scratch-card.engine.js';

export const ScratchCardSpecs = {
  /** Line width · circle radius · spray diameter (CSS px). */
  radius: 30,
  sprayPoints: 30,
  sprayDotSize: 4,
  /** Scratched share (%) above which releasing reveals everything. */
  revealAt: 50,
  /** Final fade (ms) — 0 clears at once, like scratchcard-js. */
  revealDurationMs: 0,
  /** One erase step every 16 ms at most, whatever the display refresh rate. */
  stepIntervalMs: 16,
  measureIntervalMs: 100,
  maxPixelRatio: 2,
} as const;

/**
 * Scratch card — a silver, gold or image layer covers the content; scratch it
 * with the mouse, a finger or a pen. Four erase styles (`line`, `circle`,
 * `spray`, `brush`); past `reveal-at` %, releasing reveals the rest.
 *
 * ```html
 * <k3-scratch-card cover="gold" type="spray">
 *   <img src="prize.png" alt="You won a rare card" />
 * </k3-scratch-card>
 * ```
 *
 * The content stays hidden from assistive tech until revealed; a "Reveal all"
 * button appears on keyboard focus.
 *
 * @slot - Content to reveal
 * @fires k3-scratch — `{ percent }` while scratching (and on reset)
 * @fires k3-reveal — `{ percent: 100 }` once everything is revealed
 * @csspart content — revealed content
 * @csspart cover — scratch layer (canvas)
 * @csspart reveal — keyboard "Reveal all" button
 * @cssprop --k3-scratch-card-radius — corner radius
 * @cssprop --k3-scratch-card-cursor — cursor over the layer (gold coin)
 */
export class K3ScratchCard extends K3Element {
  static override styles = [hostReset, scratchCardStyles];

  /** Erase style. */
  @property({ reflect: true }) type: ScratchType = 'line';
  /** Line width · circle radius · spray diameter (CSS px). */
  @property({ type: Number }) radius: number = ScratchCardSpecs.radius;
  /** Spray: dots per step. */
  @property({ type: Number, attribute: 'spray-points' }) sprayPoints: number = ScratchCardSpecs.sprayPoints;
  /** Spray: dot diameter (CSS px). */
  @property({ type: Number, attribute: 'spray-dot-size' }) sprayDotSize: number = ScratchCardSpecs.sprayDotSize;
  /** Brush image URL, drawn at its own size (empty = built-in brush). */
  @property() brush = '';
  /** `silver` · `gold` · image URL. */
  @property({ reflect: true }) cover = 'silver';
  /** Text engraved on silver / gold covers — unset = localized "Scratch here", `""` = none. */
  @property() label: string | null = null;
  /** Scratched share (%) above which releasing the pointer reveals everything. */
  @property({ type: Number, attribute: 'reveal-at' }) revealAt: number = ScratchCardSpecs.revealAt;
  /** Final fade in ms (0 = at once). */
  @property({ type: Number, attribute: 'reveal-duration' }) revealDuration: number = ScratchCardSpecs.revealDurationMs;
  /** Everything revealed. Set to reveal; clear to scratch again. */
  @property({ type: Boolean, reflect: true }) revealed = false;

  @query('canvas') private canvas?: HTMLCanvasElement;

  private ctx: CanvasRenderingContext2D | null = null;
  private coverImage: HTMLImageElement | null = null;
  private brushImage: CanvasImageSource | null = null;
  private ro?: ResizeObserver;
  private width = 0;
  private height = 0;
  private ratio = 1;
  private value = 0;
  private painted = false;
  private paintedLabel = '';
  private pointerId: number | null = null;
  private target: { x: number; y: number } | null = null;
  private frame = 0;
  private lastStep = -Infinity;
  private lastMeasure = -Infinity;
  private path: Path2D | null = null;
  private clearTimer = 0;
  private loads = 0;

  /** Scratched share, 0 … 100. */
  get percent(): number {
    return this.value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this);
    }
    /* Repaint an untouched cover once web fonts arrive (engraved label) */
    void document.fonts?.ready.then(() => {
      if (this.value === 0) this.repaint();
    });
  }

  override disconnectedCallback(): void {
    this.ro?.disconnect();
    this.ro = undefined;
    this.stopScratching();
    window.clearTimeout(this.clearTimer);
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    this.ctx = this.canvas?.getContext('2d', { willReadFrequently: true }) ?? null;
    void this.load(true, true);
  }

  override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const coverChanged = changed.has('cover') && changed.get('cover') !== undefined;
    const brushChanged = changed.has('brush') && changed.get('brush') !== undefined;
    if (coverChanged || brushChanged) void this.load(coverChanged, brushChanged);
    else if (changed.has('label') && changed.get('label') !== undefined) this.reset();
    else if (this.painted && this.resolvedLabel() !== this.paintedLabel) this.repaint(); /* locale change */
    if (changed.has('revealed') && changed.get('revealed') !== undefined) {
      if (this.revealed && this.value < 100) this.reveal();
      else if (!this.revealed && this.value === 100) this.reset();
    }
  }

  /** Reveal everything at once. */
  reveal(): void {
    if (this.value === 100 && this.revealed) return;
    this.stopScratching();
    this.value = 100;
    const duration = prefersReducedMotion() ? 0 : Math.max(0, this.revealDuration);
    this.style.setProperty('--k3-scratch-card-reveal-duration', `${duration}ms`);
    this.revealed = true;
    window.clearTimeout(this.clearTimer);
    const clear = () => {
      if (!this.ctx || !this.canvas || this.value !== 100) return;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    };
    if (duration > 0) this.clearTimer = window.setTimeout(clear, duration);
    else clear();
    this.emit('k3-scratch', { percent: 100 });
    this.emit('k3-reveal', { percent: 100 });
  }

  /** Put an intact cover back. */
  reset(): void {
    this.stopScratching();
    window.clearTimeout(this.clearTimer);
    this.value = 0;
    this.style.setProperty('--k3-scratch-card-reveal-duration', '0ms');
    this.revealed = false;
    if (this.width && this.height) this.paintCover();
    this.emit('k3-scratch', { percent: 0 });
  }

  /* ── Cover ────────────────────────────────────────────────────────── */

  private resolvedLabel(): string {
    return this.label ?? i18n.t('scratchCard.label', 'Scratch here');
  }

  private async load(cover: boolean, brush: boolean): Promise<void> {
    const ticket = ++this.loads;
    if (cover) {
      this.coverImage = null;
      if (this.cover && !isMetal(this.cover)) {
        try {
          this.coverImage = await loadImage(this.cover);
        } catch (error) {
          this.emit('k3-error', { reason: 'cover', error });
        }
      }
    }
    if (brush) {
      this.brushImage = null;
      if (this.brush) {
        try {
          this.brushImage = await loadImage(this.brush);
        } catch (error) {
          this.emit('k3-error', { reason: 'brush', error });
        }
      }
      this.brushImage ??= defaultBrush();
    }
    if (ticket !== this.loads) return; /* a newer load won */
    if (cover && this.painted) this.reset();
    else this.resize();
  }

  private resize(): void {
    const canvas = this.canvas;
    if (!canvas || !this.ctx) return;
    const width = this.clientWidth;
    const height = this.clientHeight;
    const ratio = Math.min(Math.max(1, window.devicePixelRatio || 1), ScratchCardSpecs.maxPixelRatio);
    if (!width || !height) return;
    if (width === this.width && height === this.height && ratio === this.ratio && this.painted) return;
    const previous = this.snapshot();
    this.width = width;
    this.height = height;
    this.ratio = ratio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    if (this.value === 100) return; /* revealed: stays clear */
    this.paintCover();
    this.restore(previous);
    if (!this.painted) {
      this.painted = true;
      this.toggleAttribute('data-ready', true);
    }
  }

  /** Repaint the cover (new text or font) without losing what was scratched. */
  private repaint(): void {
    if (!this.painted || this.value === 100) return;
    const previous = this.snapshot();
    this.paintCover();
    this.restore(previous);
  }

  private snapshot(): HTMLCanvasElement | null {
    const canvas = this.canvas;
    if (!canvas || !this.painted || this.value <= 0 || this.value >= 100) return null;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext('2d')?.drawImage(canvas, 0, 0);
    return copy;
  }

  private restore(previous: HTMLCanvasElement | null): void {
    if (!previous || !this.ctx || !this.canvas) return;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.drawImage(previous, 0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  private paintCover(): void {
    const { ctx, width, height, ratio } = this;
    if (!ctx) return;
    const label = this.resolvedLabel();
    ctx.save();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    if (this.coverImage) paintImage(ctx, this.coverImage, width, height);
    else {
      const font = getComputedStyle(this).fontFamily || 'system-ui, sans-serif';
      paintMetal(ctx, width, height, ratio, this.cover === 'gold' ? 'gold' : 'silver', label, font);
    }
    ctx.restore();
    this.paintedLabel = label;
  }

  /* ── Scratching ───────────────────────────────────────────────────── */

  private toLocal(event: PointerEvent): { x: number; y: number } {
    const rect = this.canvas!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * this.width) / (rect.width || 1),
      y: ((event.clientY - rect.top) * this.height) / (rect.height || 1),
    };
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (this.revealed || !this.painted || this.pointerId !== null) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.canvas?.setPointerCapture?.(event.pointerId);
    const { x, y } = this.toLocal(event);
    if (this.type === 'line') {
      this.path = new Path2D();
      this.path.moveTo(x, y);
    }
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.target = this.toLocal(event);
    if (!this.frame) this.frame = requestAnimationFrame(this.tick);
  };

  private readonly tick = (time: number): void => {
    this.frame = 0;
    if (!this.target || this.revealed) return;
    if (time - this.lastStep < ScratchCardSpecs.stepIntervalMs - 1) {
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    this.lastStep = time;
    const { x, y } = this.target;
    this.target = null;
    this.erase(x, y);
    if (time - this.lastMeasure >= ScratchCardSpecs.measureIntervalMs) {
      this.lastMeasure = time;
      this.measure();
    }
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    if (this.target && !this.revealed) this.erase(this.target.x, this.target.y);
    this.stopScratching();
    if (this.revealed) return;
    this.measure();
    if (this.value > this.revealAt) this.reveal();
  };

  private erase(x: number, y: number): void {
    if (!this.ctx) return;
    if (this.type === 'line' && !this.path) {
      this.path = new Path2D();
      this.path.moveTo(x, y);
    }
    scratchAt(
      this.ctx,
      {
        type: this.type,
        radius: this.radius,
        sprayPoints: this.sprayPoints,
        sprayDotSize: this.sprayDotSize,
        ratio: this.ratio,
      },
      x,
      y,
      this.path,
      this.brushImage,
    );
  }

  private measure(): void {
    if (!this.ctx || !this.canvas) return;
    const percent = measureCleared(this.ctx, this.canvas.width, this.canvas.height);
    if (percent === null || percent === this.value) return;
    this.value = percent;
    this.emit('k3-scratch', { percent });
  }

  private stopScratching(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.target = null;
    this.path = null;
    if (this.pointerId !== null && this.canvas?.hasPointerCapture?.(this.pointerId)) {
      this.canvas.releasePointerCapture(this.pointerId);
    }
    this.pointerId = null;
  }

  override render() {
    return html`
      <div class="content" part="content" aria-hidden=${this.revealed ? nothing : 'true'}><slot></slot></div>
      <canvas
        class="cover"
        part="cover"
        aria-hidden="true"
        @pointerdown=${this.onDown}
        @pointermove=${this.onMove}
        @pointerup=${this.onUp}
        @pointercancel=${this.onUp}
        @contextmenu=${(event: Event) => event.preventDefault()}
      ></canvas>
      <button class="reveal" part="reveal" type="button" ?hidden=${this.revealed} @click=${() => this.reveal()}>
        ${i18n.t('scratchCard.revealAll', 'Reveal all')}
      </button>
    `;
  }
}

export default K3ScratchCard;

if (!customElements.get('k3-scratch-card')) {
  customElements.define('k3-scratch-card', K3ScratchCard);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-scratch-card': K3ScratchCard;
  }
}
