import { html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { K3Element } from 'k3ui';
import { hostReset } from '../_shared.js';
import { halftoneStyles } from './halftone.styles.js';
import {
  HALFTONE_DEFAULTS,
  HALFTONE_PRESETS,
  intrinsicSize,
  parseInks,
  renderHalftone,
  renderHalftoneLayers,
  type HalftoneInk,
  type HalftoneOptions,
  type HalftonePresetName,
  type HalftoneShape,
} from './halftone.engine.js';

export {
  HALFTONE_DEFAULTS,
  HALFTONE_PRESETS,
  renderHalftone,
  type HalftoneInk,
  type HalftoneOptions,
  type HalftonePresetName,
  type HalftoneShape,
} from './halftone.engine.js';

export const HalftoneSpecs = {
  size: 10,
  intensity: 0.55,
  durationMs: 12000,
  /** Highest device pixel ratio used for print plates (memory / speed cap). */
  maxPixelRatio: 2,
} as const;

export type HalftoneTone = 'dark' | 'light';
export type HalftoneMode = 'auto' | 'print' | 'overlay';

type PixelSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

/**
 * Halftone — real screen-print rendering of an image, or the original CSS dot
 * screen over any content.
 *
 * - **print** (auto for `<img>` / `<canvas>` / `<video>` / `src`): the image is
 *   separated into inks (CMYK, spot poster inks, riso, mono), each printed on its
 *   own rotated screen with tone-accurate dots, then overprinted on paper.
 * - **overlay** (auto for any other content): uniform CSS dot screen — the
 *   previous behaviour, unchanged.
 *
 * ```html
 * <k3-halftone preset="poster" size="9" shape="circle">
 *   <img src="photo.jpg" alt="Harbour at dusk" />
 * </k3-halftone>
 * ```
 *
 * @fires k3-render — `{ mode, width, height, dots, ms }` after each print render
 * @fires k3-error — `{ reason: 'load' | 'cross-origin' | 'canvas', error }` (falls back to overlay)
 * @csspart screen — overlay dot screen
 * @csspart print — print stack (paper + plates)
 * @cssprop --k3-halftone-radius — corner radius
 * @cssprop --k3-halftone-drift — animated misregistration amplitude (print)
 */
export class K3Halftone extends K3Element {
  static override styles = [hostReset, halftoneStyles];

  /** Dot cell size in CSS px (screen pitch). */
  @property({ type: Number }) size: number = HalftoneSpecs.size;
  /** Overlay screen opacity 0…1 (overlay mode). */
  @property({ type: Number }) intensity: number = HalftoneSpecs.intensity;
  /** Dot colour (overlay) · ink colour of the `mono` preset (print). */
  @property() color = '#0a0a0a';
  /** `dark` = inks on light paper · `light` = light ink on dark stock. */
  @property({ reflect: true }) tone: HalftoneTone = 'dark';
  /** Overlay: slow grid drift · print: plates drift off-register. */
  @property({ type: Boolean, reflect: true }) animated = false;
  /** Animation loop duration (ms). */
  @property({ type: Number, attribute: 'duration' }) duration: number = HalftoneSpecs.durationMs;

  /** `auto` (print for images, overlay otherwise) · `print` · `overlay`. */
  @property({ reflect: true }) mode: HalftoneMode = 'auto';
  /** Image URL (alternative to a slotted `<img>`). */
  @property() src = '';
  /** Accessible description of the printed image. */
  @property() alt = '';
  /** Ink set — `poster` · `cmyk` · `riso` · `mono`. */
  @property({ reflect: true }) preset: HalftonePresetName = 'poster';
  /** Custom inks as JSON (`[{"color":"#e8301f","angle":75,"channel":"m"}]`) — overrides `preset`. */
  @property() inks = '';
  /** Dot shape. */
  @property({ reflect: true }) shape: HalftoneShape = HALFTONE_DEFAULTS.shape;
  /** Paper colour (`transparent` allowed). Empty = cream, or near-black for `tone="light"`. */
  @property() paper = '';
  /** 1 = neutral; > 1 punchier solids. */
  @property({ type: Number }) contrast: number = HALFTONE_DEFAULTS.contrast;
  /** Grey-component replacement 0…1 (CMY shared darkness moved to black). */
  @property({ type: Number }) black: number = HALFTONE_DEFAULTS.blackStrength;
  /** Extra rotation of every screen (degrees). */
  @property({ type: Number }) angle: number = HALFTONE_DEFAULTS.angle;
  /** Registration offset multiplier (0 = perfect register). */
  @property({ type: Number }) misregistration: number = HALFTONE_DEFAULTS.misregistration;
  /** −0.5…0.5 midtone ink spread. */
  @property({ type: Number, attribute: 'dot-gain' }) dotGain: number = HALFTONE_DEFAULTS.dotGain;
  /** Paper grain 0…1. */
  @property({ type: Number }) grain: number = HALFTONE_DEFAULTS.grain;
  /** Dot edge irregularity 0…1. */
  @property({ type: Number }) roughness: number = HALFTONE_DEFAULTS.roughness;
  /** Ink opacity 0…1 (print). */
  @property({ type: Number, attribute: 'ink-opacity' }) inkOpacity = 1;

  @state() private effectiveMode: 'print' | 'overlay' = 'overlay';
  @state() private aspect = 0;
  @state() private plateCount = 0;

  @query('.paper') private paperCanvas?: HTMLCanvasElement;

  private source: PixelSource | null = null;
  private ownImage: HTMLImageElement | null = null;
  private ro?: ResizeObserver;
  private frame = 0;
  private renderedKey = '';
  private failed = false;

  /** Options handed to the engine (resolved from attributes). */
  get options(): HalftoneOptions {
    const light = this.tone === 'light';
    const custom = parseInks(this.inks);
    let inks: readonly HalftoneInk[] = custom ?? HALFTONE_PRESETS[this.preset] ?? HALFTONE_PRESETS.poster;
    if (!custom && this.preset === 'mono') {
      inks = [{ ...HALFTONE_PRESETS.mono[0]!, color: light && this.color === '#0a0a0a' ? '#f5f1e6' : this.color }];
    }
    if (this.inkOpacity !== 1) inks = inks.map((ink) => ({ ...ink, opacity: (ink.opacity ?? 1) * this.inkOpacity }));
    return {
      cellSize: Math.max(2, this.size),
      shape: this.shape,
      paper: this.paper || (light ? '#141414' : HALFTONE_DEFAULTS.paper),
      contrast: this.contrast,
      blackStrength: this.black,
      inks,
      angle: this.angle,
      misregistration: this.misregistration,
      dotGain: this.dotGain,
      blend: light ? 'screen' : 'multiply',
      grain: this.grain,
      roughness: this.roughness,
    };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.schedule());
      this.ro.observe(this);
    }
    this.resolveSource();
  }

  override disconnectedCallback(): void {
    this.ro?.disconnect();
    this.ro = undefined;
    cancelAnimationFrame(this.frame);
    super.disconnectedCallback();
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('src') || changed.has('mode')) this.resolveSource();
    if (this.effectiveMode === 'print') {
      const ink = parseInks(this.inks) ?? HALFTONE_PRESETS[this.preset] ?? HALFTONE_PRESETS.poster;
      this.plateCount = ink.length;
    }
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.effectiveMode === 'print') this.schedule();
  }

  /** Re-render now (e.g. after drawing into a slotted canvas). */
  refresh(): void {
    this.renderedKey = '';
    this.schedule();
  }

  /** Composited print as a Blob (PNG by default), at the current size or `width`. */
  async toBlob(type = 'image/png', width?: number): Promise<Blob> {
    const source = this.source;
    if (!source) throw new Error('k3-halftone: no image to print');
    const nat = intrinsicSize(source);
    const w = Math.round(width ?? (this.clientWidth || nat.width) * this.pixelRatio());
    const h = Math.round(w * (nat.height / Math.max(1, nat.width)));
    const canvas = document.createElement('canvas');
    renderHalftone(source, canvas, this.options, { width: w, height: h, scale: w / Math.max(1, this.clientWidth || w) });
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('k3-halftone: export failed'))), type, 0.92),
    );
  }

  /** Download the composited print. */
  async download(filename = 'halftone.png'): Promise<void> {
    const blob = await this.toBlob(filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename, rel: 'noopener' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /* ── Source discovery ─────────────────────────────────────────────── */

  private onSlotChange = (): void => this.resolveSource();

  private resolveSource(): void {
    let source: PixelSource | null = null;
    if (this.mode !== 'overlay' && !this.failed) {
      if (this.src) {
        if (!this.ownImage || this.ownImage.getAttribute('src') !== this.src) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.decoding = 'async';
          img.src = this.src;
          this.ownImage = img;
        }
        source = this.ownImage;
      } else {
        source =
          (Array.from(this.querySelectorAll('img, canvas, video')).find(
            (el) => !el.closest('[slot]'),
          ) as PixelSource | undefined) ?? null;
      }
    }
    this.source = source;
    const next = source ? 'print' : 'overlay';
    if (next !== this.effectiveMode) this.effectiveMode = next;
    if (source instanceof HTMLImageElement) {
      /* Clip-hidden slots defeat IntersectionObserver for loading="lazy" —
         demos collapse to 0 height and never paint (esp. the first frame). */
      if (source.loading === 'lazy') source.loading = 'eager';
      if (!(source.complete && source.naturalWidth)) {
        source.addEventListener('load', () => this.refresh(), { once: true });
        source.addEventListener('error', (error) => this.fail('load', error), { once: true });
        /* Kick the fetch if lazy already skipped it */
        const href = source.currentSrc || source.getAttribute('src') || '';
        if (href && !source.complete) source.src = href;
      }
    } else if (source instanceof HTMLVideoElement && source.readyState < 2) {
      source.addEventListener('loadeddata', () => this.refresh(), { once: true });
    }
    /* Reserve aspect from attrs before pixels arrive so the host isn't 0×0 */
    if (source && !this.aspect) {
      const nat = intrinsicSize(source);
      if (nat.width && nat.height) this.aspect = nat.width / nat.height;
    }
    this.renderedKey = '';
    this.schedule();
  }

  private fail(reason: 'load' | 'cross-origin' | 'canvas', error: unknown): void {
    this.failed = reason !== 'load';
    this.emit('k3-error', { reason, error });
    if (this.failed) this.resolveSource();
  }

  /* ── Print rendering ──────────────────────────────────────────────── */

  private pixelRatio(): number {
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    return Math.min(HalftoneSpecs.maxPixelRatio, Math.max(1, dpr));
  }

  private schedule(): void {
    if (this.effectiveMode !== 'print' || typeof requestAnimationFrame !== 'function') return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.paint());
  }

  private paint(): void {
    const source = this.source;
    if (!source || this.effectiveMode !== 'print') return;
    const nat = intrinsicSize(source);
    if (!nat.width || !nat.height) return;
    if (!this.aspect || Math.abs(this.aspect - nat.width / nat.height) > 1e-3) {
      this.aspect = nat.width / nat.height;
      return; /* layout first — updated() schedules the next paint */
    }
    /* Aspect may come from HTML attrs before decode — wait for real pixels */
    if (
      source instanceof HTMLImageElement &&
      !(source.complete && source.naturalWidth > 0)
    ) {
      return;
    }
    const cssWidth = this.clientWidth || nat.width;
    const ratio = this.pixelRatio();
    const width = Math.round(cssWidth * ratio);
    const height = Math.round((cssWidth / this.aspect) * ratio);
    const options = this.options;
    const key = JSON.stringify([width, height, options, (source as HTMLImageElement).currentSrc ?? '']);
    if (key === this.renderedKey) return;
    const paper = this.paperCanvas;
    const plates = Array.from(this.renderRoot.querySelectorAll<HTMLCanvasElement>('.plate'));
    if (!paper || plates.length !== (options.inks?.length ?? 0)) return;
    try {
      const result = renderHalftoneLayers(source, options, { width, height, scale: ratio }, { paper, plates });
      this.renderedKey = key;
      this.emit('k3-render', { mode: 'print', ...result });
    } catch (error) {
      this.fail(error instanceof DOMException && error.name === 'SecurityError' ? 'cross-origin' : 'canvas', error);
    }
  }

  override render() {
    if (this.effectiveMode === 'print') {
      const label = this.alt || (this.source as HTMLImageElement | null)?.alt || '';
      return html`
        <div
          class="print"
          part="print"
          role=${label ? 'img' : nothing}
          aria-label=${label || nothing}
          style=${styleMap({
            aspectRatio: this.aspect ? String(this.aspect) : 'auto',
            '--k3-halftone-duration': `${Math.max(1000, this.duration)}ms`,
          })}
        >
          <canvas class="paper" aria-hidden="true"></canvas>
          ${Array.from(
            { length: this.plateCount },
            (_, i) =>
              html`<canvas class="plate" aria-hidden="true" style=${styleMap({ '--k3-halftone-plate': String(i) })}></canvas>`,
          )}
        </div>
        <div class="source-hidden"><slot @slotchange=${this.onSlotChange}></slot></div>
      `;
    }
    const cell = `${Math.max(2, this.size)}px`;
    const opacity = Math.min(1, Math.max(0, this.intensity));
    return html`
      <div class="content"><slot @slotchange=${this.onSlotChange}></slot></div>
      <div
        class="screen"
        part="screen"
        aria-hidden="true"
        style=${styleMap({
          '--k3-halftone-cell': cell,
          '--k3-halftone-dot': this.color || '#0a0a0a',
          '--k3-halftone-opacity': String(opacity),
          '--k3-halftone-duration': `${Math.max(1000, this.duration)}ms`,
        })}
      ></div>
    `;
  }
}

export default K3Halftone;

if (!customElements.get('k3-halftone')) {
  customElements.define('k3-halftone', K3Halftone);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-halftone': K3Halftone;
  }
}
