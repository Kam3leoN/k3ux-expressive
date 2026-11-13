/**
 * QR Code → SVG renderer (pure string builder — DOM-free, SSR safe).
 *
 * One SVG drives both the on-screen preview and every export (SVG / PNG / JPEG
 * / WebP), so what users see is exactly what they download.
 *
 * Geometry is expressed in **module units** (1 module = 1 user unit) so paths
 * stay short and scale crisply. Frames scale with the code span.
 */
import { QR_ECC_RECOVERY, type QrMatrix } from './qr-code.encoder.js';
import {
  BAG_PATH_SCALE,
  QR_IO_BAG,
  QR_IO_BANNER,
  QR_IO_CIRCLE,
  QR_IO_CLIPBOARD,
  QR_IO_PHONE,
  type QrIoSilhouette,
} from './qr-code.frames.js';
import {
  QR_IO_MARKER_IN,
  QR_IO_MARKERS,
  QR_IO_PATTERNS,
  resolveQrIoPattern,
  stampQrIoBall,
  stampQrIoDot,
  stampQrIoMarker,
  type QrIoMarker,
  type QrIoMarkerIn,
  type QrIoPattern,
} from './qr-code.qrio-shapes.js';

/** qr.io `pattern` (+ legacy aliases: square, dots, rounded, …). */
export type QrDotStyle =
  | QrIoPattern
  | 'square'
  | 'rounded'
  | 'extra-rounded'
  | 'dots'
  | 'classy'
  | 'vertical'
  | 'horizontal'
  | 'tiny';
/** qr.io `marker` (+ legacy aliases: square, extra-rounded). */
export type QrEyeFrameStyle = QrIoMarker | 'square' | 'extra-rounded';
/** qr.io `marker_in` (+ legacy aliases: square, leaf). */
export type QrEyeBallStyle = QrIoMarkerIn | 'square' | 'leaf';
export type QrGradient = 'none' | 'linear' | 'radial';
export type QrFrameStyle =
  | 'none'
  | 'box'
  | 'box-top'
  | 'bubble'
  | 'pill'
  | 'corners'
  /** qr.io `new-frame-8` — clipboard / clip-top tote. */
  | 'clipboard'
  /** qr.io bag export — hang-hole shopping bag. */
  | 'bag'
  /** qr.io `phone` — smartphone silhouette. */
  | 'phone'
  /** qr.io circle — ring + modules clipped by omission (whole cells only). */
  | 'circle'
  /** qr.io `bottom` — filled banner box + phrase. */
  | 'banner';
export type QrFrameFont = 'sans' | 'serif' | 'mono';
export type QrLogoIcon =
  | 'link'
  | 'text'
  | 'mail'
  | 'phone'
  | 'sms'
  | 'chat'
  | 'wifi'
  | 'contact'
  | 'location'
  | 'event';

/** All 19 qr.io patterns (generator / docs). Legacy aliases still accepted on attributes. */
export const QR_DOT_STYLES: readonly QrDotStyle[] = QR_IO_PATTERNS;
/** All 15 qr.io markers. */
export const QR_EYE_FRAME_STYLES: readonly QrEyeFrameStyle[] = QR_IO_MARKERS;
/** All 16 qr.io marker_in centres. */
export const QR_EYE_BALL_STYLES: readonly QrEyeBallStyle[] = QR_IO_MARKER_IN;
export const QR_FRAME_STYLES: readonly QrFrameStyle[] = [
  'none',
  'box',
  'box-top',
  'bubble',
  'pill',
  'corners',
  'clipboard',
  'bag',
  'phone',
  'circle',
  'banner',
];
export const QR_FRAME_FONTS: readonly QrFrameFont[] = ['sans', 'serif', 'mono'];

/** Material Icons (Apache-2.0) 24 × 24 paths used as preset logos. */
export const QR_LOGO_ICONS: Readonly<Record<QrLogoIcon, string>> = {
  link: 'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z',
  text: 'M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z',
  mail: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z',
  phone:
    'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  sms: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z',
  chat: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z',
  wifi: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z',
  contact:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  location:
    'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
  event:
    'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z',
};

export interface QrRenderOptions {
  /** Quiet zone in modules (spec recommends 4; 2 is fine for phone cameras). */
  margin: number;
  dotStyle: QrDotStyle;
  eyeFrameStyle: QrEyeFrameStyle;
  eyeBallStyle: QrEyeBallStyle;
  /** Dots colour (gradient start). */
  color: string;
  gradient: QrGradient;
  /** Gradient end colour. */
  gradientColor: string;
  /** Linear gradient angle in degrees (0 = left → right). */
  gradientRotation: number;
  /** Finder frame colour — empty inherits the dots paint. */
  eyeFrameColor: string;
  /** Finder centre colour — empty inherits the dots paint. */
  eyeBallColor: string;
  /** Background colour or `transparent`. */
  background: string;
  /** Background corner radius in modules (frame `none` only). */
  radius: number;
  /** Image logo (data:, https:, blob: or relative URL). */
  logo: string;
  /** Preset vector logo (ignored when `logo` is set). */
  logoIcon: QrLogoIcon | '';
  /** Requested logo width as a fraction of the code (clamped by ECC budget). */
  logoSize: number;
  /** Clear space around the logo, in modules. */
  logoMargin: number;
  /** Keep the dots under the logo (default: cleared, like qr.io). */
  logoKeepDots: boolean;
  frame: QrFrameStyle;
  frameText: string;
  /** Frame colour — empty inherits `color`. */
  frameColor: string;
  /** Frame phrase colour — empty picks black / white by contrast. */
  frameTextColor: string;
  frameFont: QrFrameFont;
  /** Draw a neutral bar instead of the phrase (tiny previews). */
  framePlaceholder: boolean;
  /** Accessible name written to `<title>` / `aria-label`. */
  title: string;
  /** Prefix for internal ids (gradients) — keep unique per document. */
  idPrefix: string;
}

export const QR_RENDER_DEFAULTS: Readonly<QrRenderOptions> = {
  margin: 2,
  dotStyle: 'default',
  eyeFrameStyle: 'default',
  eyeBallStyle: 'default',
  color: '#000000',
  gradient: 'none',
  gradientColor: '#000000',
  gradientRotation: 45,
  eyeFrameColor: '',
  eyeBallColor: '',
  background: '#ffffff',
  radius: 0,
  logo: '',
  logoIcon: '',
  logoSize: 0.22,
  logoMargin: 1,
  logoKeepDots: false,
  frame: 'none',
  frameText: 'Scan me',
  frameColor: '',
  frameTextColor: '',
  frameFont: 'sans',
  framePlaceholder: false,
  title: 'QR code',
  idPrefix: 'k3qr',
};

export interface QrRenderResult {
  svg: string;
  /** viewBox width / height in module units (aspect ratio source). */
  width: number;
  height: number;
  /** Logo box actually used (module units, relative to the matrix), if any. */
  logo: QrLogoBox | null;
}

export interface QrLogoBox {
  /** First hidden module index (x and y). */
  hideStart: number;
  /** Hidden square side in modules. */
  hideSize: number;
  /** Rendered logo side in modules (≤ hideSize − 2 × margin). */
  size: number;
}

const FONT_STACKS: Record<QrFrameFont, string> = {
  sans: "'Google Sans','Roboto','Helvetica Neue',Arial,sans-serif",
  serif: "'Roboto Serif',Georgia,'Times New Roman',serif",
  mono: "'JetBrains Mono','Roboto Mono','Courier New',monospace",
};

/** Share of the ECC budget a logo may consume (safety factor). */
const LOGO_BUDGET = 0.5;
/* ── String / colour safety ────────────────────────────────────────────── */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const COLOR_RE =
  /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/+-]+\)|[a-z]{3,24})$/i;

/** Whitelist CSS colours (hex, rgb/hsl functions, keywords). Fallback otherwise. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  const v = (value ?? '').trim();
  return v && COLOR_RE.test(v) ? v : fallback;
}

/** Accept data:image/*, http(s):, blob: and relative URLs — never script schemes. */
export function safeHref(value: string | null | undefined): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif)[;,]/i.test(v)) return v;
  if (/^(https?:|blob:)/i.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return ''; // any other scheme
  return v; // relative path
}

/** Parse #rgb[a] / #rrggbb[aa] / rgb[a](). Returns null for keywords / hsl. */
export function parseColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (v.startsWith('#')) {
    let hex = v.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = [...hex].map((c) => c + c).join('');
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
  }
  const m = v.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1]!.split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const ch = (p: string) => (p.endsWith('%') ? (parseFloat(p) * 255) / 100 : parseFloat(p));
    const a = parts[3] ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
    return { r: ch(parts[0]!), g: ch(parts[1]!), b: ch(parts[2]!), a };
  }
  if (v === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (v === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  return null;
}

/** WCAG relative luminance (0 black → 1 white). */
export function relativeLuminance(value: string): number | null {
  const c = parseColor(value);
  if (!c) return null;
  const lin = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

/** WCAG contrast ratio between two colours (null when unparseable). */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white — whichever reads best on `background`. */
export function readableOn(background: string): string {
  const l = relativeLuminance(background);
  if (l == null) return '#ffffff';
  return l > 0.36 ? '#1b1b1f' : '#ffffff';
}

/* ── Geometry helpers ──────────────────────────────────────────────────── */

const f = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

type Radii = [tl: number, tr: number, br: number, bl: number];

/** Clockwise rounded rectangle with per-corner radii. */
function roundedRect(x: number, y: number, w: number, h: number, r: Radii): string {
  const [tl, tr, br, bl] = r;
  let d = `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}`;
  if (tr) d += `A${f(tr)} ${f(tr)} 0 0 1 ${f(x + w)} ${f(y + tr)}`;
  d += `V${f(y + h - br)}`;
  if (br) d += `A${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)}`;
  d += `H${f(x + bl)}`;
  if (bl) d += `A${f(bl)} ${f(bl)} 0 0 1 ${f(x)} ${f(y + h - bl)}`;
  d += `V${f(y + tl)}`;
  if (tl) d += `A${f(tl)} ${f(tl)} 0 0 1 ${f(x + tl)} ${f(y)}`;
  return `${d}Z`;
}

/* ── Logo budget ───────────────────────────────────────────────────────── */

/**
 * Logo footprint clamped so hidden modules stay within the ECC budget
 * (`recovery × 50 %` of the symbol) and never touch finder patterns.
 */
export function qrLogoBox(
  matrix: Pick<QrMatrix, 'size' | 'ecc'>,
  logoSize: number,
  logoMargin: number,
): QrLogoBox {
  const size = matrix.size;
  const margin = Math.max(0, Math.min(4, Math.round(logoMargin)));
  const budget = QR_ECC_RECOVERY[matrix.ecc] * LOGO_BUDGET * size * size;
  let hide = Math.floor(Math.sqrt(budget));
  hide = Math.min(hide, size - 16); // keep finders + separators intact
  if ((size - hide) % 2 !== 0) hide -= 1; // centre on the module grid
  hide = Math.max(1, hide);

  const wanted = Math.max(0.05, Math.min(0.45, Number.isFinite(logoSize) ? logoSize : 0.22));
  const requestedSide = wanted * size;
  // The requested size can shrink the cleared area, never grow past the budget.
  let need = Math.ceil(requestedSide + margin * 2);
  if ((size - need) % 2 !== 0) need += 1;
  hide = Math.max(1, Math.min(hide, need));
  const logo = Math.max(1, Math.min(requestedSide, hide - margin * 2 || hide));
  return { hideStart: (size - hide) / 2, hideSize: hide, size: logo };
}

/* ── Main renderer ─────────────────────────────────────────────────────── */

interface FrameGeometry {
  width: number;
  height: number;
  qrX: number;
  qrY: number;
  back: string;
  front: string;
  /** Frame already paints the background behind the code. */
  paintsBackground: boolean;
  /** Corner radius for the code background (module units). */
  bgRadius: number;
  /**
   * qr.io circle — decorative filler dots in the crescent (inside the disc,
   * outside the inscribed QR square). Drawn after the QR modules.
   */
  circleFillDots?: string;
}

export function renderQr(
  matrix: QrMatrix,
  options: Partial<QrRenderOptions> = {},
  pixelWidth?: number,
): QrRenderResult {
  const o: QrRenderOptions = { ...QR_RENDER_DEFAULTS, ...options };
  const id = (o.idPrefix || 'k3qr').replace(/[^a-z0-9_-]/gi, '') || 'k3qr';
  const size = matrix.size;
  const margin = Math.max(0, Math.min(16, Math.round(o.margin)));
  const span = size + margin * 2;

  const color = safeColor(o.color, '#000000');
  const background = safeColor(o.background, '#ffffff');
  const transparentBg = background.toLowerCase() === 'transparent' || parseColor(background)?.a === 0;
  const gradientColor = safeColor(o.gradientColor, color);
  const frameColor = safeColor(o.frameColor, color);

  const defs: string[] = [];
  let dotsPaint = color;
  if (o.gradient === 'linear' || o.gradient === 'radial') {
    const gid = `${id}-g`;
    const stops = `<stop offset="0" stop-color="${escapeXml(color)}"/><stop offset="1" stop-color="${escapeXml(gradientColor)}"/>`;
    dotsPaint = `url(#${gid})`;
    // Gradient coordinates are resolved once the QR block is placed (below).
    defs.push(`@@GRADIENT@@${gid}@@${stops}`);
  }
  const eyeFramePaint = o.eyeFrameColor ? safeColor(o.eyeFrameColor, dotsPaint) : dotsPaint;
  const eyeBallPaint = o.eyeBallColor ? safeColor(o.eyeBallColor, dotsPaint) : dotsPaint;

  /* Frame geometry */
  const frame = buildFrame(o, span, frameColor, background, transparentBg);
  const ox = frame.qrX + margin;
  const oy = frame.qrY + margin;

  /* Logo */
  const hasLogo = !!(safeHref(o.logo) || o.logoIcon);
  const logo = hasLogo ? qrLogoBox(matrix, o.logoSize, o.logoMargin) : null;
  const hideDots = logo != null && !o.logoKeepDots;
  const hideEnd = logo ? logo.hideStart + logo.hideSize : 0;

  const isFinder = (x: number, y: number): boolean =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
  const visible = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    if (matrix.modules[y * size + x] !== 1) return false;
    if (isFinder(x, y)) return false;
    if (hideDots && logo && x >= logo.hideStart && x < hideEnd && y >= logo.hideStart && y < hideEnd) {
      return false;
    }
    return true;
  };

  const dots = buildDots(o.dotStyle, size, visible, ox, oy);
  const eyes = buildEyes(o.eyeFrameStyle, o.eyeBallStyle, size, ox, oy);

  /* Resolve gradient placeholder now that the block position is known */
  const resolvedDefs = defs.map((d) => {
    if (!d.startsWith('@@GRADIENT@@')) return d;
    const [, gid, stops] = d.split('@@').filter(Boolean);
    const cx = frame.qrX + span / 2;
    const cy = frame.qrY + span / 2;
    if (o.gradient === 'radial') {
      return `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(span * 0.62)}">${stops}</radialGradient>`;
    }
    const a = ((Number(o.gradientRotation) || 0) * Math.PI) / 180;
    const dx = (Math.cos(a) * span) / 2;
    const dy = (Math.sin(a) * span) / 2;
    return `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(cx - dx)}" y1="${f(cy - dy)}" x2="${f(cx + dx)}" y2="${f(cy + dy)}">${stops}</linearGradient>`;
  });

  const parts: string[] = [];
  if (resolvedDefs.length) parts.push(`<defs>${resolvedDefs.join('')}</defs>`);
  parts.push(frame.back);

  if (!transparentBg && !frame.paintsBackground) {
    const r = Math.max(0, Math.min(span / 2, frame.bgRadius));
    parts.push(
      `<rect x="${f(frame.qrX)}" y="${f(frame.qrY)}" width="${f(span)}" height="${f(span)}"${r ? ` rx="${f(r)}"` : ''} fill="${escapeXml(background)}"/>`,
    );
  }
  if (dots) {
    const crisp = resolveQrIoPattern(o.dotStyle) === 'default' ? ' shape-rendering="crispEdges"' : '';
    parts.push(`<path d="${dots}" fill="${escapeXml(dotsPaint)}"${crisp}/>`);
  }
  if (eyes.frames) {
    parts.push(
      `<g fill="${escapeXml(eyeFramePaint)}" fill-rule="evenodd">${eyes.frames}</g>`,
    );
  }
  if (eyes.balls) {
    parts.push(`<g fill="${escapeXml(eyeBallPaint)}">${eyes.balls}</g>`);
  }
  if (frame.circleFillDots) {
    const crisp = resolveQrIoPattern(o.dotStyle) === 'default' ? ' shape-rendering="crispEdges"' : '';
    parts.push(`<path d="${frame.circleFillDots}" fill="${escapeXml(dotsPaint)}"${crisp}/>`);
  }

  if (logo) {
    const lx = ox + (size - logo.size) / 2;
    const ly = oy + (size - logo.size) / 2;
    const href = safeHref(o.logo);
    if (href) {
      const h = escapeXml(href);
      parts.push(
        `<image x="${f(lx)}" y="${f(ly)}" width="${f(logo.size)}" height="${f(logo.size)}" href="${h}" xlink:href="${h}" preserveAspectRatio="xMidYMid meet"/>`,
      );
    } else if (o.logoIcon && QR_LOGO_ICONS[o.logoIcon]) {
      const badge = o.eyeBallColor ? safeColor(o.eyeBallColor, color) : color;
      const glyph = transparentBg ? '#ffffff' : background;
      const inset = logo.size * 0.2;
      const gs = (logo.size - inset * 2) / 24;
      parts.push(`<circle cx="${f(lx + logo.size / 2)}" cy="${f(ly + logo.size / 2)}" r="${f(logo.size / 2)}" fill="${escapeXml(badge)}"/>`);
      parts.push(
        `<path transform="translate(${f(lx + inset)} ${f(ly + inset)}) scale(${f(gs)})" d="${QR_LOGO_ICONS[o.logoIcon]}" fill="${escapeXml(glyph)}"/>`,
      );
    }
  }
  parts.push(frame.front);

  const title = escapeXml(o.title || 'QR code');
  const dims =
    pixelWidth && pixelWidth > 0
      ? ` width="${Math.round(pixelWidth)}" height="${Math.round((pixelWidth * frame.height) / frame.width)}"`
      : '';
  const xlink = logo && safeHref(o.logo) ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg"${xlink} viewBox="0 0 ${f(frame.width)} ${f(frame.height)}"${dims} role="img" aria-label="${title}">` +
    `<title>${title}</title>${parts.join('')}</svg>`;

  return { svg, width: frame.width, height: frame.height, logo };
}

/** Convenience wrapper — SVG markup only. */
export function renderQrSvg(
  matrix: QrMatrix,
  options: Partial<QrRenderOptions> = {},
  pixelWidth?: number,
): string {
  return renderQr(matrix, options, pixelWidth).svg;
}

/* ── Dots ──────────────────────────────────────────────────────────────── */

function buildDots(
  style: QrDotStyle,
  size: number,
  visible: (x: number, y: number) => boolean,
  ox: number,
  oy: number,
): string {
  const out: string[] = [];
  const pattern = resolveQrIoPattern(style);

  if (pattern === 'default') {
    // Row runs — fewer nodes, no vertical seams between neighbours
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; ) {
        if (!visible(x, y)) {
          x++;
          continue;
        }
        let end = x;
        while (end + 1 < size && visible(end + 1, y)) end++;
        const len = end - x + 1;
        out.push(`M${f(ox + x)} ${f(oy + y)}h${len}v1h-${len}Z`);
        x = end + 1;
      }
    }
    return out.join('');
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!visible(x, y)) continue;
      out.push(
        stampQrIoDot(pattern, ox + x, oy + y, {
          t: visible(x, y - 1),
          r: visible(x + 1, y),
          b: visible(x, y + 1),
          l: visible(x - 1, y),
        }),
      );
    }
  }
  return out.join('');
}

/* ── Finder patterns ("eyes") ──────────────────────────────────────────── */

type Corner = 'tl' | 'tr' | 'bl';

function buildEyes(
  frameStyle: QrEyeFrameStyle,
  ballStyle: QrEyeBallStyle,
  size: number,
  ox: number,
  oy: number,
): { frames: string; balls: string } {
  const spots: Array<[number, number, Corner]> = [
    [0, 0, 'tl'],
    [size - 7, 0, 'tr'],
    [0, size - 7, 'bl'],
  ];
  let frames = '';
  let balls = '';
  for (const [x, y] of spots) {
    frames += stampQrIoMarker(frameStyle, ox + x, oy + y);
    balls += stampQrIoBall(ballStyle, ox + x, oy + y);
  }
  return { frames, balls };
}

/* ── Frames (qr.io-style "Scan me" call-to-action) ────────────────────── */

function frameText(
  o: QrRenderOptions,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  maxSize: number,
  fill: string,
  u: number,
  opts: { baseline?: boolean; weight?: number } = {},
): string {
  if (o.framePlaceholder) {
    const w = Math.min(maxWidth, maxSize * 4.2);
    const h = maxSize * 0.42;
    const y = opts.baseline ? cy - h * 0.75 : cy - h / 2;
    return `<rect x="${f(cx - w / 2)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${escapeXml(fill)}" opacity=".9"/>`;
  }
  const chars = Math.max(1, [...text].length);
  const perChar = o.frameFont === 'mono' ? 0.66 : 0.62; // em, incl. tracking
  let fs = Math.min(maxSize, maxWidth / (chars * perChar));
  fs = Math.max(fs, u * 1.2);
  const est = chars * perChar * fs;
  const fit = est > maxWidth ? ` textLength="${f(maxWidth)}" lengthAdjust="spacingAndGlyphs"` : '';
  const weight = opts.weight ?? 700;
  const baseline = opts.baseline
    ? ''
    : ' dominant-baseline="central"';
  return (
    `<text x="${f(cx)}" y="${f(cy)}" fill="${escapeXml(fill)}" font-family="${FONT_STACKS[o.frameFont] ?? FONT_STACKS.sans}" ` +
    `font-size="${f(fs)}" font-weight="${weight}" letter-spacing="${f(fs * 0.04)}" text-anchor="middle"${baseline}${fit}>` +
    `${escapeXml(text)}</text>`
  );
}

/**
 * Map a qr.io silhouette artboard onto module units so the QR window = `span`.
 * Path geometry is kept verbatim (only a uniform scale + optional translate).
 */
function buildSilhouetteFrame(
  o: QrRenderOptions,
  span: number,
  frameColor: string,
  def: QrIoSilhouette,
  pathScale = 1,
  /** Bag export punches hang-hole + QR well; evenodd matches the visible cutouts. */
  fillRule: 'nonzero' | 'evenodd' = 'nonzero',
): FrameGeometry {
  const s = span / def.qrSize;
  const width = def.vbW * s;
  const height = def.vbH * s;
  const qrX = def.qrX * s;
  const qrY = def.qrY * s;
  const tx = (def.pathTx ?? 0) * s;
  const ty = (def.pathTy ?? 0) * s;
  const scale = pathScale * s;
  const fc = escapeXml(frameColor);
  const transform =
    tx || ty
      ? `translate(${f(tx)} ${f(ty)}) scale(${f(scale)})`
      : `scale(${f(scale)})`;
  const back = `<g transform="${transform}" fill="${fc}" fill-rule="${fillRule}"><path d="${def.path}"/></g>`;

  const text = (o.frameText ?? '').trim();
  const autoText = o.frameTextColor ? safeColor(o.frameTextColor, '#ffffff') : readableOn(frameColor);
  const fs = def.textFs * s;
  const maxW = width * 0.86;
  const front =
    text || o.framePlaceholder
      ? frameText(o, text, width / 2, def.textY * s, maxW, fs, autoText, span / 25, {
          baseline: true,
          weight: 400,
        })
      : '';

  return {
    width,
    height,
    qrX,
    qrY,
    back,
    front,
    paintsBackground: false,
    bgRadius: 0,
  };
}

/**
 * Decorative dots that fill the crescent between an inscribed QR square and
 * the circle — same pitch as QR modules (qr.io circle frame).
 */
function buildCircleCrescentDots(
  cx: number,
  cy: number,
  discR: number,
  qrX: number,
  qrY: number,
  qrSide: number,
  pitch: number,
): string {
  /* Keep a quiet gap around the QR square so scanners stay happy. */
  const gap = pitch * 0.85;
  const left = qrX - gap;
  const top = qrY - gap;
  const right = qrX + qrSide + gap;
  const bottom = qrY + qrSide + gap;
  /* Inset so dots sit fully inside the disc (no mid-cell clipping at the rim). */
  const rim = discR - pitch * 0.55;
  const rim2 = rim * rim;
  const parts: string[] = [];
  /* Grid aligned on the QR module lattice so crescents match the code. */
  const minCol = Math.floor((cx - rim - qrX) / pitch) - 1;
  const maxCol = Math.ceil((cx + rim - qrX) / pitch) + 1;
  const minRow = Math.floor((cy - rim - qrY) / pitch) - 1;
  const maxRow = Math.ceil((cy + rim - qrY) / pitch) + 1;
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const x = qrX + col * pitch;
      const y = qrY + row * pitch;
      const mx = x + pitch * 0.5;
      const my = y + pitch * 0.5;
      const dx = mx - cx;
      const dy = my - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 > rim2) continue;
      if (mx >= left && mx <= right && my >= top && my <= bottom) continue;
      /* Density ≈ qr.io crescent fill. Stable hash (no Math.random). */
      const h = (((col * 374761393) ^ (row * 668265263)) >>> 0) % 100;
      if (h > 70) continue;
      const inset = pitch * 0.06;
      const s = pitch - inset * 2;
      parts.push(`M${f(x + inset)} ${f(y + inset)}h${f(s)}v${f(s)}h${f(-s)}z`);
    }
  }
  return parts.join('');
}

function buildCircleIoFrame(
  o: QrRenderOptions,
  span: number,
  frameColor: string,
  background: string,
  transparentBg: boolean,
): FrameGeometry {
  const def = QR_IO_CIRCLE;
  const innerR = def.r - def.stroke / 2;
  /*
   * Inscribe the full QR square (incl. quiet zone) in the disc so every finder
   * stays intact — then fill the four crescents with decorative dots.
   * side = diameter / √2.
   */
  const qrBox = (innerR * 2) / Math.SQRT2;
  const s = span / qrBox;
  const width = def.vbW * s;
  const height = def.vbH * s;
  const cx = def.cx * s;
  const cy = def.cy * s;
  const r = def.r * s;
  const stroke = def.stroke * s;
  const discR = innerR * s;
  const qrX = cx - span / 2;
  const qrY = cy - span / 2;
  const fc = escapeXml(frameColor);
  const bgFill = transparentBg ? 'none' : escapeXml(background);
  const discFill = bgFill === 'none' ? '#ffffff' : bgFill;

  const back =
    (transparentBg ? '' : `<rect width="${f(width)}" height="${f(height)}" fill="${bgFill}"/>`) +
    `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${discFill}" stroke="${fc}" stroke-width="${f(stroke)}"/>`;

  const text = (o.frameText ?? '').trim();
  const textFill = o.frameTextColor ? safeColor(o.frameTextColor, frameColor) : frameColor;
  const fs = def.textFs * s;
  const front =
    text || o.framePlaceholder
      ? frameText(o, text, width / 2, def.textY * s, width * 0.86, fs, textFill, span / 25, {
          baseline: true,
          weight: 400,
        })
      : '';

  /* Module pitch = 1 user unit (geometry is already in module space). */
  const circleFillDots = buildCircleCrescentDots(cx, cy, discR, qrX, qrY, span, 1);

  return {
    width,
    height,
    qrX,
    qrY,
    back,
    front,
    paintsBackground: true,
    bgRadius: 0,
    circleFillDots,
  };
}

function buildFrame(
  o: QrRenderOptions,
  span: number,
  frameColor: string,
  background: string,
  transparentBg: boolean,
): FrameGeometry {
  const style = QR_FRAME_STYLES.includes(o.frame) ? o.frame : 'none';
  if (style === 'none') {
    const radius = Math.max(0, Number(o.radius) || 0);
    return { width: span, height: span, qrX: 0, qrY: 0, back: '', front: '', paintsBackground: false, bgRadius: radius };
  }

  const u = span / 25;
  const text = (o.frameText ?? '').trim();
  const autoText = o.frameTextColor ? safeColor(o.frameTextColor, '#ffffff') : readableOn(frameColor);
  const fc = escapeXml(frameColor);
  const bgFill = transparentBg ? 'none' : escapeXml(background);
  const fsMax = u * 2.6;

  switch (style) {
    case 'box':
    case 'box-top': {
      const t = u * 1.2;
      const band = text || o.framePlaceholder ? u * 5.6 : t;
      const w = span + t * 2;
      const h = span + t + band;
      const top = style === 'box-top';
      const qrY = top ? band : t;
      const outer = roundedRect(0, 0, w, h, [u * 2.4, u * 2.4, u * 2.4, u * 2.4]);
      const r = u * 1.2;
      const hole = roundedRect(t, qrY, span, span, [r, r, r, r]);
      const back = `<path d="${outer}${hole}" fill="${fc}" fill-rule="evenodd"/>`;
      const front =
        text || o.framePlaceholder
          ? frameText(o, text, w / 2, top ? band / 2 : t + span + band / 2, w - u * 3, fsMax, autoText, u)
          : '';
      return { width: w, height: h, qrX: t, qrY, back, front, paintsBackground: false, bgRadius: r };
    }

    case 'bubble': {
      const b = u * 0.9;
      const w = span + b * 2;
      const card = roundedRect(b / 2, b / 2, span + b, span + b, [u * 2, u * 2, u * 2, u * 2]);
      const gap = u * 2.2;
      const hb = u * 5;
      const by = span + b * 2 + gap;
      const bw = w * 0.86;
      const bx = (w - bw) / 2;
      const ph = u * 1.5;
      const pointer = `M${f(w / 2 - u * 1.5)} ${f(by + 0.01)}L${f(w / 2)} ${f(by - ph)}L${f(w / 2 + u * 1.5)} ${f(by + 0.01)}Z`;
      const bubble = roundedRect(bx, by, bw, hb, [hb / 2, hb / 2, hb / 2, hb / 2]);
      const h = by + hb;
      const back =
        `<path d="${card}" fill="${bgFill}" stroke="${fc}" stroke-width="${f(b)}"/>` +
        `<path d="${bubble}${pointer}" fill="${fc}"/>`;
      const front = frameText(o, text, w / 2, by + hb / 2, bw - u * 3, fsMax * 0.95, autoText, u);
      return { width: w, height: h, qrX: b, qrY: b, back, front, paintsBackground: !transparentBg, bgRadius: 0 };
    }

    case 'pill': {
      const b = u * 1;
      const w = span + b * 2;
      const hb = u * 4.8;
      // Extra bottom padding: the badge straddles the border, never the modules.
      const padBottom = hb / 2 + u * 0.5;
      const cardH = span + b + padBottom;
      const card = roundedRect(b / 2, b / 2, span + b, cardH, [u * 2.4, u * 2.4, u * 2.4, u * 2.4]);
      const chars = Math.max(1, [...text].length);
      const est = chars * 0.62 * fsMax * 0.92;
      const bw = Math.min(w - u * 2, Math.max(u * 9, est + u * 4));
      const cy = b / 2 + cardH;
      const pill = roundedRect((w - bw) / 2, cy - hb / 2, bw, hb, [hb / 2, hb / 2, hb / 2, hb / 2]);
      const back =
        `<path d="${card}" fill="${bgFill}" stroke="${fc}" stroke-width="${f(b)}"/>` +
        `<path d="${pill}" fill="${fc}"/>`;
      const front = frameText(o, text, w / 2, cy, bw - u * 3, fsMax * 0.92, autoText, u);
      return { width: w, height: cy + hb / 2, qrX: b, qrY: b, back, front, paintsBackground: !transparentBg, bgRadius: 0 };
    }

    case 'corners': {
      const sw = u * 1;
      const pad = u * 0.9;
      const inset = sw / 2;
      const box = span + (pad + sw) * 2;
      const len = u * 4.4;
      const rr = u * 1.8;
      const e = box - inset;
      const brackets =
        `M${f(inset)} ${f(inset + len)}V${f(inset + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(inset + rr)} ${f(inset)}H${f(inset + len)}` +
        `M${f(e - len)} ${f(inset)}H${f(e - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(e)} ${f(inset + rr)}V${f(inset + len)}` +
        `M${f(e)} ${f(e - len)}V${f(e - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(e - rr)} ${f(e)}H${f(e - len)}` +
        `M${f(inset + len)} ${f(e)}H${f(inset + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(inset)} ${f(e - rr)}V${f(e - len)}`;
      const hb = text || o.framePlaceholder ? u * 5.2 : 0;
      const h = box + hb;
      const back =
        (transparentBg ? '' : `<rect width="${f(box)}" height="${f(h)}" rx="${f(u * 2)}" fill="${bgFill}"/>`) +
        `<path d="${brackets}" fill="none" stroke="${fc}" stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;
      const front =
        text || o.framePlaceholder
          ? frameText(o, text, box / 2, box + hb / 2 - u * 0.3, box - u * 2, fsMax, frameColor, u)
          : '';
      return {
        width: box,
        height: h,
        qrX: pad + sw,
        qrY: pad + sw,
        back,
        front,
        paintsBackground: !transparentBg,
        bgRadius: 0,
      };
    }

    /* ── qr.io frames (authentic silhouette paths) ─────────────────────── */

    case 'clipboard':
      return buildSilhouetteFrame(o, span, frameColor, QR_IO_CLIPBOARD);

    case 'bag':
      return buildSilhouetteFrame(o, span, frameColor, QR_IO_BAG, BAG_PATH_SCALE, 'evenodd');

    case 'phone':
      return buildSilhouetteFrame(o, span, frameColor, QR_IO_PHONE);

    case 'circle':
      return buildCircleIoFrame(o, span, frameColor, background, transparentBg);

    case 'banner':
      return buildSilhouetteFrame(o, span, frameColor, QR_IO_BANNER);

    default:
      return { width: span, height: span, qrX: 0, qrY: 0, back: '', front: '', paintsBackground: false, bgRadius: 0 };
  }
}

/* ── Tiny previews for pickers (generator tiles) ───────────────────────── */

/** 5 × 5 sample pattern used to preview a dot style. */
const SAMPLE_PATTERN = ['10110', '11011', '01110', '11001', '10111'];

export function renderDotSampleSvg(style: QrDotStyle, color = 'currentColor'): string {
  const size = 5;
  const visible = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size && SAMPLE_PATTERN[y]![x] === '1';
  const d = buildDots(style, size, visible, 0.5, 0.5);
  const crisp = resolveQrIoPattern(style) === 'default' ? ' shape-rendering="crispEdges"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 6 6" aria-hidden="true"><path d="${d}" fill="${escapeXml(color)}"${crisp}/></svg>`;
}

/** Finder outer ring only (generator « Contour des yeux » tiles). */
export function renderEyeFrameSampleSvg(frameStyle: QrEyeFrameStyle, color = 'currentColor'): string {
  const c = escapeXml(color);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 8 8" aria-hidden="true">` +
    `<g fill="${c}" fill-rule="evenodd">${stampQrIoMarker(frameStyle, 0, 0)}</g></svg>`
  );
}

/** Finder centre only (generator « Centre des yeux » tiles). */
export function renderEyeBallSampleSvg(ballStyle: QrEyeBallStyle, color = 'currentColor'): string {
  const c = escapeXml(color);
  // Ball is stamped at (2,2) inside a 7×7 eye — crop the viewBox to the 3×3 centre.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="1.5 1.5 4 4" aria-hidden="true">` +
    `<g fill="${c}">${stampQrIoBall(ballStyle, 0, 0)}</g></svg>`
  );
}

/** Combined eye preview (frame + ball) — kept for docs / demos. */
export function renderEyeSampleSvg(
  frameStyle: QrEyeFrameStyle,
  ballStyle: QrEyeBallStyle,
  color = 'currentColor',
): string {
  const c = escapeXml(color);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 8 8" aria-hidden="true">` +
    `<g fill="${c}" fill-rule="evenodd">${stampQrIoMarker(frameStyle, 0, 0)}</g>` +
    `<g fill="${c}">${stampQrIoBall(ballStyle, 0, 0)}</g></svg>`
  );
}
