import { html, nothing, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { K3Element } from 'k3ui';
import { hostReset } from '../_shared.js';
import { i18n } from 'k3ui';
import {
  encodeQr,
  QrCapacityError,
  type QrEcc,
  type QrMatrix,
  type QrMode,
} from './qr-code.encoder.js';
import {
  renderQr,
  type QrDotStyle,
  type QrEyeBallStyle,
  type QrEyeFrameStyle,
  type QrFrameFont,
  type QrFrameStyle,
  type QrGradient,
  type QrLogoIcon,
  type QrRenderOptions,
} from './qr-code.render.js';
import {
  QrCodeSpecs,
  clampExportSize,
  qrFilename,
  type QrCodeSize,
  type QrExportFormat,
} from './qr-code.specs.js';
import { qrCodeStyles } from './qr-code.styles.js';

export { QrCodeSpecs, type QrCodeSize, type QrExportFormat } from './qr-code.specs.js';
export {
  encodeQr,
  QrCapacityError,
  qrDetectMode,
  qrByteCapacity,
  type QrEcc,
  type QrMatrix,
  type QrMode,
  type QrEncodeOptions,
} from './qr-code.encoder.js';
export {
  renderQr,
  renderQrSvg,
  contrastRatio,
  QR_DOT_STYLES,
  QR_EYE_FRAME_STYLES,
  QR_EYE_BALL_STYLES,
  QR_FRAME_STYLES,
  QR_FRAME_FONTS,
  QR_LOGO_ICONS,
  type QrDotStyle,
  type QrEyeFrameStyle,
  type QrEyeBallStyle,
  type QrGradient,
  type QrFrameStyle,
  type QrFrameFont,
  type QrLogoIcon,
  type QrRenderOptions,
} from './qr-code.render.js';
export {
  QR_IO_PATTERNS,
  QR_IO_MARKERS,
  QR_IO_MARKER_IN,
  type QrIoPattern,
  type QrIoMarker,
  type QrIoMarkerIn,
} from './qr-code.qrio-shapes.js';

/** Detail of `k3-render`. */
export interface QrRenderDetail {
  version: number;
  /** Modules per side. */
  modules: number;
  ecc: QrEcc;
  mask: number;
  mode: QrMode;
  /** Encoded length (bytes in byte mode). */
  length: number;
}

/** Detail of the cancelable `k3-download` event. */
export interface QrDownloadDetail {
  format: QrExportFormat;
  filename: string;
  blob: Blob;
  /** Exported width in px (SVG keeps its viewBox, this is the declared width). */
  width: number;
}

export interface QrExportOptions {
  /** Output width in px (height follows the frame ratio). */
  size?: number;
  filename?: string;
}

let uid = 0;

/**
 * Styled QR code — dots / eyes / gradient / logo / call-to-action frame.
 * Zero-dependency encoder (ISO/IEC 18004, v1–40, ECC L–H) and SVG renderer;
 * one SVG feeds the preview and every export.
 *
 * @fires k3-render — `{ version, modules, ecc, mask, mode, length }` after each new code
 * @fires k3-error — `{ reason: 'overflow', message }` when the payload does not fit
 * @fires k3-download — cancelable · `{ format, filename, blob, width }` — `preventDefault()` to save it yourself
 * @fires k3-copy — `{ format, ok }` after `copy()`
 *
 * @csspart code — wrapper of the rendered SVG
 * @csspart state — empty / error placeholder
 * @cssprop --k3-qr-code-size — display width (overrides `size`)
 */
export class K3QrCode extends K3Element {
  static override styles = [hostReset, qrCodeStyles];

  /** Text to encode (use `buildQrPayload()` for Wi-Fi, vCard, events…). */
  @property() value = '';
  /** Error-correction level — L 7 % · M 15 % · Q 25 % · H 30 %. */
  @property({ reflect: true }) ecc: QrEcc = QrCodeSpecs.defaultEcc;
  /** Display size (convention A). Ignored with `fluid`. */
  @property({ reflect: true }) size: QrCodeSize = QrCodeSpecs.defaultSize;
  /** Fill the container width. */
  @property({ type: Boolean, reflect: true }) fluid = false;
  /** Quiet zone, in modules. */
  @property({ type: Number }) margin = QrCodeSpecs.defaultMargin;

  @property({ attribute: 'dot-style', reflect: true }) dotStyle: QrDotStyle = 'default';
  @property({ attribute: 'eye-frame-style' }) eyeFrameStyle: QrEyeFrameStyle = 'default';
  @property({ attribute: 'eye-ball-style' }) eyeBallStyle: QrEyeBallStyle = 'default';

  /** Dots colour (gradient start). */
  @property() color: string = QrCodeSpecs.defaultColor;
  @property() gradient: QrGradient = 'none';
  /** Gradient end colour. */
  @property({ attribute: 'gradient-color' }) gradientColor = '';
  @property({ type: Number, attribute: 'gradient-rotation' }) gradientRotation = 45;
  /** Finder frame colour (empty → dots paint). */
  @property({ attribute: 'eye-frame-color' }) eyeFrameColor = '';
  /** Finder centre colour (empty → dots paint). */
  @property({ attribute: 'eye-ball-color' }) eyeBallColor = '';
  /** Background colour or `transparent`. */
  @property() background: string = QrCodeSpecs.defaultBackground;
  /** Background corner radius in modules (no frame). */
  @property({ type: Number }) radius = 0;

  /** Logo image URL (data:, https:, blob:, relative). */
  @property() logo = '';
  /** Preset vector logo (`link`, `wifi`, `mail`…). */
  @property({ attribute: 'logo-icon' }) logoIcon: QrLogoIcon | '' = '';
  /** Logo width as a fraction of the code (clamped to the ECC budget). */
  @property({ type: Number, attribute: 'logo-size' }) logoSize = 0.22;
  /** Clear space around the logo, in modules. */
  @property({ type: Number, attribute: 'logo-margin' }) logoMargin = 1;
  /** Keep the dots under the logo (default clears them). */
  @property({ type: Boolean, attribute: 'logo-keep-dots' }) logoKeepDots = false;

  /** Call-to-action frame. */
  @property({ reflect: true }) frame: QrFrameStyle = 'none';
  /** Frame phrase (empty → localized “Scan me”). */
  @property({ attribute: 'frame-text' }) frameText = '';
  @property({ attribute: 'frame-color' }) frameColor = '';
  @property({ attribute: 'frame-text-color' }) frameTextColor = '';
  @property({ attribute: 'frame-font' }) frameFont: QrFrameFont = 'sans';

  /** Smallest QR version allowed (1–40). */
  @property({ type: Number, attribute: 'min-version' }) minVersion = 1;
  /** Mask 0–7, or -1 for automatic selection. */
  @property({ type: Number }) mask = -1;
  /** Default export width in px. */
  @property({ type: Number, attribute: 'export-size' }) exportSize: number = QrCodeSpecs.defaultExportSize;
  /** Default download filename (extension added per format). */
  @property() filename: string = QrCodeSpecs.defaultFilename;
  /** Accessible name (defaults to “QR code”). */
  @property() label = '';

  @state() private svg = '';
  @state() private status: 'empty' | 'ready' | 'overflow' = 'empty';

  private matrix: QrMatrix | null = null;
  private aspect = 1;
  private readonly idPrefix = `k3qr${++uid}`;
  private renderedKey = '';
  private announcedKey = '';
  private wasReady = false;
  private enter = false;

  /** Encoding facts for the current code (`null` when empty or overflowing). */
  get info(): QrRenderDetail | null {
    const m = this.matrix;
    if (!m || this.status !== 'ready') return null;
    return { version: m.version, modules: m.size, ecc: m.ecc, mask: m.mask, mode: m.mode, length: m.length };
  }

  /** The underlying module matrix (read-only use). */
  get qrMatrix(): QrMatrix | null {
    return this.status === 'ready' ? this.matrix : null;
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.compute();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    const key = `${this.status}|${this.value}|${this.ecc}|${this.minVersion}|${this.mask}`;
    if (key === this.announcedKey) return;
    this.announcedKey = key;
    if (this.status === 'ready' && this.info) {
      this.emit<QrRenderDetail>('k3-render', this.info);
    } else if (this.status === 'overflow') {
      this.emit('k3-error', { reason: 'overflow', message: i18n.t('qrCode.overflow', 'Too much content for one QR code') });
    }
  }

  /** Render options handed to the SVG builder. */
  protected svgOptions(): Partial<QrRenderOptions> {
    return {
      margin: this.margin,
      dotStyle: this.dotStyle,
      eyeFrameStyle: this.eyeFrameStyle,
      eyeBallStyle: this.eyeBallStyle,
      color: this.color,
      gradient: this.gradient,
      gradientColor: this.gradientColor || this.color,
      gradientRotation: this.gradientRotation,
      eyeFrameColor: this.eyeFrameColor,
      eyeBallColor: this.eyeBallColor,
      background: this.background,
      radius: this.radius,
      logo: this.logo,
      logoIcon: this.logoIcon,
      logoSize: this.logoSize,
      logoMargin: this.logoMargin,
      logoKeepDots: this.logoKeepDots,
      frame: this.frame,
      frameText: this.frameText.trim() || i18n.t('qrCode.frameText', 'Scan me'),
      frameColor: this.frameColor,
      frameTextColor: this.frameTextColor,
      frameFont: this.frameFont,
      title: this.accessibleName(),
      idPrefix: this.idPrefix,
    };
  }

  private accessibleName(): string {
    return this.label.trim() || i18n.t('qrCode.ariaLabel', QrCodeSpecs.accessibility.ariaLabel);
  }

  private compute(): void {
    const opts = this.svgOptions();
    const key = JSON.stringify([this.value, this.ecc, this.minVersion, this.mask, opts, i18n.locale]);
    if (key === this.renderedKey) return;
    this.renderedKey = key;

    if (!this.value) {
      this.matrix = null;
      this.svg = '';
      this.status = 'empty';
      this.wasReady = false;
      return;
    }
    try {
      this.matrix = encodeQr(this.value, {
        ecc: this.ecc,
        minVersion: this.minVersion,
        mask: this.mask,
      });
      const result = renderQr(this.matrix, opts);
      this.svg = result.svg;
      this.aspect = result.height / result.width;
      this.enter = !this.wasReady;
      this.wasReady = true;
      this.status = 'ready';
    } catch (err) {
      if (!(err instanceof QrCapacityError)) throw err;
      this.matrix = null;
      this.svg = '';
      this.status = 'overflow';
      this.wasReady = false;
    }
  }

  /* ── Export API ─────────────────────────────────────────────────────── */

  /** Standalone SVG markup (optionally sized in px). */
  toSvg(size?: number): string {
    this.compute();
    if (!this.matrix || this.status !== 'ready') return '';
    const width = size ? clampExportSize(size) : undefined;
    return renderQr(this.matrix, this.svgOptions(), width).svg;
  }

  /** Encode the current code as a file blob. */
  async toBlob(format: QrExportFormat = 'png', size?: number): Promise<Blob> {
    const width = clampExportSize(size ?? this.exportSize);
    const svg = this.toSvg(width);
    if (!svg) throw new Error('k3-qr-code: nothing to export');
    if (format === 'svg') {
      return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], {
        type: QrCodeSpecs.mimeTypes.svg,
      });
    }
    const height = Math.round(width * this.aspect);
    return rasterize(svg, width, height, format, this.flatBackground(format));
  }

  /** Data URL of the current code. */
  async toDataUrl(format: QrExportFormat = 'png', size?: number): Promise<string> {
    const blob = await this.toBlob(format, size);
    return blobToDataUrl(blob);
  }

  /**
   * Download the code. Fires a cancelable `k3-download` first — call
   * `preventDefault()` to route the blob elsewhere (share sheet, sandboxed hosts…).
   * Resolves `true` when a file was produced.
   */
  async download(format: QrExportFormat = 'png', options: QrExportOptions = {}): Promise<boolean> {
    if (this.status !== 'ready') return false;
    const width = clampExportSize(options.size ?? this.exportSize);
    const blob = await this.toBlob(format, width);
    const filename = qrFilename(options.filename ?? this.filename, format);
    const proceed = this.emit<QrDownloadDetail>('k3-download', { format, filename, blob, width }, true);
    if (proceed) saveBlob(blob, filename);
    return true;
  }

  /** Copy the code to the clipboard (PNG image, or SVG markup as text). */
  async copy(format: 'png' | 'svg' = 'png'): Promise<boolean> {
    let ok = false;
    try {
      if (this.status !== 'ready' || typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('clipboard unavailable');
      }
      if (format === 'svg') {
        await navigator.clipboard.writeText(this.toSvg());
      } else {
        if (typeof ClipboardItem === 'undefined') throw new Error('ClipboardItem unavailable');
        // Pass the promise directly — Safari requires it inside the user gesture
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': this.toBlob('png', Math.min(this.exportSize, 1024)) }),
        ]);
      }
      ok = true;
    } catch {
      ok = false;
    }
    this.emit('k3-copy', { format, ok });
    return ok;
  }

  private flatBackground(format: QrExportFormat): string | undefined {
    if (format !== 'jpeg') return undefined;
    const bg = this.background.trim().toLowerCase();
    return !bg || bg === 'transparent' ? '#ffffff' : this.background;
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  override render() {
    if (this.status === 'ready') {
      const enter = this.enter;
      this.enter = false;
      return html`<div class="code ${enter ? 'code--enter' : ''}" part="code">${unsafeHTML(this.svg)}</div>`;
    }
    const overflow = this.status === 'overflow';
    const text = overflow
      ? i18n.t('qrCode.overflow', 'Too much content for one QR code')
      : i18n.t('qrCode.empty', 'Add content to generate the code');
    return html`
      <div
        class="state ${overflow ? 'state--error' : 'state--empty'}"
        part="state"
        role=${overflow ? 'alert' : 'img'}
        aria-label=${overflow ? nothing : text}
      >
        <span
          class="state-icon notranslate"
          translate="no"
          lang="zxx"
          data-k3-icon=${overflow ? 'error' : 'qr_code_2'}
          aria-hidden="true"
        ></span>
        <span class="state-text" aria-hidden=${overflow ? 'false' : 'true'}>${text}</span>
      </div>
    `;
  }
}

/* ── Helpers (DOM) ─────────────────────────────────────────────────────── */

async function rasterize(
  svg: string,
  width: number,
  height: number,
  format: Exclude<QrExportFormat, 'svg'>,
  flatBackground?: string,
): Promise<Blob> {
  const img = new Image();
  img.decoding = 'async';
  // data: URL (not blob:) — works under strict CSPs that only allow data images
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('k3-qr-code: SVG rasterization failed'));
  });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('k3-qr-code: 2D canvas unavailable');
  if (flatBackground) {
    ctx.fillStyle = flatBackground;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  const type = QrCodeSpecs.mimeTypes[format];
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('k3-qr-code: canvas export failed'))),
      type,
      QrCodeSpecs.quality,
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default K3QrCode;

if (!customElements.get('k3-qr-code')) {
  customElements.define('k3-qr-code', K3QrCode);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-qr-code': K3QrCode;
  }
}
