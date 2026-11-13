/**
 * qr.io API shape catalogues — paths scraped from api-documentation icons.
 *
 * Markers are authored in a 14×14 viewBox and scaled to 7×7 finder modules.
 * Balls are authored in a 6×6 viewBox and scaled to 3×3 eye centres.
 * Patterns are stamped per dark module (see stampQrIoDot).
 */

export const QR_IO_PATTERNS = [
  "default",
  "circle",
  "star",
  "diamond",
  "sparkle",
  "danger",
  "cross",
  "plus",
  "x",
  "heart",
  "shake",
  "blob",
  "special-circle-orizz",
  "special-circle-vert",
  "special-circle",
  "special-diamond",
  "ribbon",
  "oriental",
  "ellipse"
] as const;
export type QrIoPattern = (typeof QR_IO_PATTERNS)[number];

/** Finder outer rings offered in the generator (drop_in / flower_in / dropeyeright omitted — near-duplicates). */
export const QR_IO_MARKERS = [
  'default',
  'flurry',
  'sdoz',
  'drop',
  'dropeye',
  'dropeyeleft',
  'dropeyeleaf',
  'squarecircle',
  'circle',
  'rounded',
  'flower',
  'leaf',
] as const;
export type QrIoMarker = (typeof QR_IO_MARKERS)[number];

export const QR_IO_MARKER_IN = [
  "default",
  "flurry",
  "sdoz",
  "drop_in",
  "drop",
  "dropeye",
  "circle",
  "rounded",
  "sun",
  "star",
  "diamond",
  "danger",
  "cross",
  "plus",
  "x",
  "heart"
] as const;
export type QrIoMarkerIn = (typeof QR_IO_MARKER_IN)[number];

export const QR_IO_MARKER_PATHS: Readonly<Record<string, string>> = {
  'circle': 'M0,3.5L0,3.5c0,1.95,1.55,3.5,3.5,3.5h0c1.95,0,3.5-1.55,3.5-3.5v0c0-1.95-1.55-3.5-3.5-3.5h0C1.55,0,0,1.55,0,3.5z M3.5,6L3.5,6c-1.4,0-2.5-1.1-2.5-2.5v0 c0-1.4,1.1-2.5,2.5-2.5h0c1.4,0,2.5,1.1,2.5,2.5v0C6,4.9,4.9,6,3.5,6z',
  'default': 'M0,0v7h7V0H0z M6,6H1V1h5V6z',
  'drop': 'M0,3.5L0,3.5c0,1.95,1.55,3.5,3.5,3.5h3.5V3.5c0-1.95-1.55-3.5-3.5-3.5h0C1.55,0,0,1.55,0,3.5z M6,6H3.5c-1.4,0-2.5-1.1-2.5-2.5v0c0-1.4,1.1-2.5,2.5-2.5h0 c1.4,0,2.5,1.1,2.5,2.5V6z',
  'drop_in': 'M0,0l0,3.5c0,1.95,1.55,3.5,3.5,3.5h0c1.95,0,3.5-1.55,3.5-3.5v0c0-1.95-1.55-3.5-3.5-3.5H0z M3.5,6L3.5,6c-1.4,0-2.5-1.1-2.5-2.5V1h2.5c1.4,0,2.5,1.1,2.5,2.5v0 C6,4.9,4.9,6,3.5,6z',
  'dropeye': 'M0,0l0,3.5c0,1.95,1.55,3.5,3.5,3.5h3.5V3.5c0-1.95-1.55-3.5-3.5-3.5H0z M6,6H3.5c-1.4,0-2.5-1.1-2.5-2.5V1h2.5c1.4,0,2.5,1.1,2.5,2.5V6z',
  'dropeyeleaf': 'M0,0l0,3.5c0,1.95,1.55,3.5,3.5,3.5h3.5V3.5c0-1.95-1.55-3.5-3.5-3.5H0z M3.5,6L3.5,6c-1.4,0-2.5-1.1-2.5-2.5v0c0-1.4,1.1-2.5,2.5-2.5h0c1.4,0,2.5,1.1,2.5,2.5v0 C6,4.9,4.9,6,3.5,6z',
  'dropeyeleft': 'M0,0l0,3.5c0,1.95,1.55,3.5,3.5,3.5h3.5V3.5c0-1.95-1.55-3.5-3.5-3.5H0z M6,6H3.5c-1.4,0-2.5-1.1-2.5-2.5v0c0-1.4,1.1-2.5,2.5-2.5h0c1.4,0,2.5,1.1,2.5,2.5V6z',
  'dropeyeright': 'M0,0l0,3.5c0,1.95,1.55,3.5,3.5,3.5h3.5V3.5c0-1.95-1.55-3.5-3.5-3.5H0z M3.5,6L3.5,6c-1.4,0-2.5-1.1-2.5-2.5V1h2.5c1.4,0,2.5,1.1,2.5,2.5v0C6,4.9,4.9,6,3.5,6z',
  'flower': 'M0,0v4.8C0,6,1,7,2.2,7h2.55C6,7,7,6,7,4.8V2.2C7,1,6,0,4.8,0H0z M4.6,6H2.4C1.65,6,1,5.35,1,4.6V1h3.6 C5.35,1,6,1.65,6,2.4v2.2C6,5.35,5.35,6,4.6,6z',
  'flower_in': 'M0,0v4.8C0,6,1,7,2.2,7h2.55C6,7,7,6,7,4.8V2.2C7,1,6,0,4.8,0H0z M4.6,6H2.4C1.65,6,1,5.35,1,4.6V1h3.6 C5.35,1,6,1.65,6,2.4v2.2C6,5.35,5.35,6,4.6,6z',
  'flurry': 'M0.1,0.05L0.05,0.3l0.05,0.25L0.1,0.8L0.05,1.05l0.05,0.25L0,1.55l0,0.25L0,2l0.05,0.25l0,0.25l0.05,0.25L0.05,3l0,0.25l0,0.25 l0.1,0.25L0.05,4l0.05,0.25L0,4.45l0.1,0.25L0,4.95l0.1,0.25l-0.05,0.25l0,0.25L0,5.95l0.1,0.25l-0.05,0.25l0.05,0.25l0,0.2L0.3,7l0.25,0l0.25-0.05 l0.25,0.05l0.25,0.05L1.55,7l0.25-0.05l0.25-0.05l0.25,0L2.5,6.95l0.25-0.05l0.25,0l0.25,0L3.5,6.95L3.75,7L4,7l0.25-0.1L4.5,6.95L4.7,7l0.25-0.1 l0.25,0.1l0.25-0.05l0.25,0l0.25-0.05l0.25,0l0.25,0l0.25,0l0.25,0.05l-0.05-0.25l0.1-0.25l-0.05-0.25l-0.05-0.25l0.1-0.25l-0.1-0.25l0.05-0.25L7,4.95 l-0.1-0.25L6.95,4.5L7,4.25L7,4l-0.1-0.25l0-0.25l0.05-0.25L6.9,3l0-0.25L7,2.5l0-0.25l-0.05-0.25l0.05-0.25l-0.1-0.25l0.05-0.25l0-0.25l0-0.25 l-0.05-0.25L7,0.3l-0.1-0.2l-0.2,0l-0.25,0L6.2,0l-0.25,0.1l-0.25,0l-0.25-0.05l-0.25,0L5,0l-0.25,0L4.5,0L4.25,0.1L4,0.1L3.75,0.05L3.5,0.05 L3.25,0.1L3,0L2.75,0.1L2.55,0.1L2.3,0.05L2.05,0.05L1.8,0L1.55,0.05L1.3,0L1.05,0.05l-0.25,0l-0.25,0L0.3,0.1L0.1,0.05z M5.95,5.95l-0.25-0.05 L5.45,6l-0.25-0.05L5,5.95l-0.25,0.05L4.5,5.9l-0.25,0l-0.25,0l-0.25,0.05l-0.25,0L3.25,6L3,5.95l-0.25,0l-0.25,0L2.3,6l-0.25-0.1L1.8,6 l-0.25-0.05L1.3,6l-0.2-0.05L1,5.7l0.05-0.25l0-0.25l0.05-0.25L1,4.75L1.05,4.5L1,4.25L1,4l0.1-0.25l0-0.25L1,3.25L1.05,3l0.05-0.25L1.1,2.5L1.05,2.25 L1,2.05l0-0.25l0.1-0.25L1,1.3L1,1l0.25,0l0.25,0.05l0.25,0.05l0.25,0L2.25,1L2.5,1.05l0.25,0.05L3,1l0.25,0.1L3.5,1.05l0.25,0L4,1l0.25,0L4.5,1l0.25,0 l0.25,0.05L5.2,1l0.25,0.1L5.7,1L6,1l-0.05,0.3L6,1.55l-0.05,0.25L5.9,2L6,2.25L5.95,2.5l-0.05,0.25l0,0.25L6,3.25L6,3.5l-0.05,0.25L6,4 l0,0.25l-0.1,0.25l0,0.25l0.05,0.25l-0.05,0.25l0.1,0.25l-0.05,0.25L5.95,5.95z',
  'leaf': 'M0,0v4.8C0,6,1,7,2.2,7H7V2.2C7,1,6,0,4.8,0H0z M6,6H2.4C1.65,6,1,5.35,1,4.6V1h3.6C5.35,1,6,1.65,6,2.4V6z',
  'rounded': 'M2.25,7h2.55C6,7,7,6,7,4.8V2.25C7,1,6,0,4.75,0H2.2C1,0,0,1,0,2.2v2.55C0,6,1,7,2.25,7z M6,2.4v2.2 c0,0.75-0.65,1.4-1.4,1.4H2.4C1.6,6,1,5.4,1,4.6V2.4C1,1.65,1.65,1,2.4,1h2.2C5.4,1,6,1.6,6,2.4z',
  'sdoz': 'M0,0l0.45,6.5c0,0.3,0.25,0.5,0.5,0.5h6V1c0-0.3-0.2-0.5-0.5-0.5L0,0z M6,6H1.9c-0.25,0-0.5-0.2-0.5-0.5L1,1l4.5,0.35c0.25,0,0.5,0.25,0.5,0.5 V6z',
  'squarecircle': 'M0,0l0,7h7V0H0z M3.5,6L3.5,6c-1.4,0-2.5-1.1-2.5-2.5v0c0-1.4,1.1-2.5,2.5-2.5h0c1.4,0,2.5,1.1,2.5,2.5v0C6,4.9,4.9,6,3.5,6z',
};

export const QR_IO_BALL_PATHS: Readonly<Record<string, string>> = {
  'circle': 'M0,1.5a1.5,1.5 0 1,0 3,0a1.5,1.5 0 1,0 -3,0Z',
  'cross': 'M3,0.75L2.25,0.75L2.25,0L0.75,0L0.75,0.75L0,0.75L0,2.25L0.75,2.25L0.75,3L2.25,3L2.25,2.25L3,2.25Z',
  'danger': 'M1.5,2.55L1.95,3L3,3L3,1.95L2.55,1.5L3,1.05L3,0L1.95,0L1.5,0.45L1.05,0L0,0L0,1.05L0.45,1.5L0,1.95L0,3L1.05,3Z',
  'default': 'M0,0h3v3h-3Z',
  'diamond': 'M1.5,0L3,1.5L1.5,3L0,1.5Z',
  'drop': 'M3,3H1.5C0.65,3,0,2.35,0,1.5v0c0-0.85,0.65-1.5,1.5-1.5h0c0.85,0,1.5,0.65,1.5,1.5V3z',
  'drop_in': 'M1.5,3L1.5,3C0.65,3,0,2.35,0,1.5l0-1.5l1.5,0c0.85,0,1.5,0.65,1.5,1.5v0C3,2.35,2.35,3,1.5,3z',
  'dropeye': 'M3,3H1.5C0.65,3,0,2.35,0,1.5l0-1.5l1.5,0c0.85,0,1.5,0.65,1.5,1.5V3z',
  'flurry': 'M2.95,2.95L2.8,2.95L2.65,3L2.5,2.85L2.35,2.9L2.2,2.9L2.05,2.9L1.95,2.85L1.8,2.85L1.65,2.9L1.5,2.95L1.35,2.9L1.2,2.9L1.05,2.9L0.95,2.85L0.8,2.85L0.65,2.85L0.5,2.9L0.35,2.9L0.2,2.9L0.05,2.95L0,2.75L0.05,2.65L0,2.5L0.15,2.35L0.15,2.2L0.1,2.05L0.1,1.9L0.05,1.75L0.15,1.65L0.05,1.5L0.05,1.35L0.1,1.2L0.05,1.05L0.05,0.9L0.05,0.75L0.1,0.65L0.15,0.5L0,0.35L0,0.2L0.15,0.1L0.2,0.05L0.35,0.05L0.5,0.1L0.65,0.05L0.8,0.15L0.95,0.05L1.05,0.05L1.2,0.1L1.35,0.05L1.5,0.15L1.65,0.1L1.8,0.1L1.9,0.1L2.05,0.05L2.2,0.15L2.35,0.05L2.5,0.1L2.65,0.05L2.8,0L2.95,0L2.9,0.2L3,0.35L3,0.5L2.95,0.6L2.85,0.75L2.85,0.9L2.95,1.05L2.85,1.2L2.9,1.35L3,1.5L2.95,1.65L2.9,1.75L2.9,1.9L2.9,2.05L3,2.2L2.9,2.35L2.85,2.5L2.85,2.65L2.9,2.75Z',
  'heart': 'M3,0.9C2.95,0.5,2.65,0.2,2.25,0.15C1.95,0.1,1.7,0.25,1.5,0.45C1.3,0.25,1.05,0.15,0.8,0.15C0.4,0.2,0.05,0.5,0,0.9 C0,1.15,0.05,1.35,0.15,1.5l0,0l0,0c0.05,0.05,0.1,0.1,0.15,0.15l0.95,1.1c0.15,0.15,0.35,0.15,0.45,0l0.9-0.95c0.05-0.05,0.15-0.15,0.2-0.25 C2.95,1.4,3.05,1.15,3,0.9z',
  'plus': 'M2.25,0.75L2.25,0.75L2.25,0.75C2.25,0.35,1.9,0,1.5,0h0C1.1,0,0.75,0.35,0.75,0.75v0h0C0.35,0.75,0,1.1,0,1.5v0 c0,0.4,0.35,0.75,0.75,0.75h0v0C0.75,2.65,1.1,3,1.5,3h0c0.4,0,0.75-0.35,0.75-0.75v0h0C2.65,2.25,3,1.9,3,1.5v0C3,1.1,2.65,0.75,2.25,0.75z',
  'rounded': 'M3,0.85v1.35C3,2.6,2.6,3,2.15,3H0.85C0.35,3,0,2.65,0,2.15V0.85C0,0.4,0.4,0,0.85,0h1.35C2.65,0,3,0.35,3,0.85z',
  'sdoz': 'M3,3L0.25,3L0,0L3,0.25Z',
  'star': 'M1.6,0.15l0.3,0.65C2,0.9,2.05,0.95,2.15,0.95l0.7,0.1c0.1,0,0.15,0.15,0.1,0.25l-0.5,0.5C2.35,1.85,2.35,1.95,2.35,2.05L2.5,2.75 c0,0.1-0.1,0.2-0.2,0.15L1.65,2.6c-0.1-0.05-0.2-0.05-0.3,0L0.7,2.9C0.6,2.95,0.5,2.9,0.5,2.75l0.1-0.7c0-0.1,0-0.2-0.1-0.25l-0.5-0.5 C-0.05,1.2,0,1.1,0.1,1.05l0.7-0.1c0.1,0,0.2-0.1,0.25-0.15l0.3-0.65C1.45,0.05,1.55,0.05,1.6,0.15z',
  'sun': 'M1.5,0L1.7,0.35L2,0.1L2.05,0.45L2.45,0.35L2.4,0.75L2.8,0.75L2.6,1.1L2.95,1.25L2.65,1.5L2.95,1.75L2.6,1.9L2.8,2.25L2.4,2.25L2.45,2.65L2.05,2.55L2,2.9L1.7,2.65L1.5,3L1.25,2.65L0.95,2.9L0.9,2.55L0.5,2.65L0.55,2.25L0.2,2.25L0.35,1.9L0,1.75L0.3,1.5L0,1.25L0.35,1.1L0.2,0.75L0.55,0.75L0.5,0.35L0.9,0.45L0.95,0.1L1.25,0.35Z',
  'x': 'M1.5,2.55l0.2,0.2C1.85,2.9,2.05,3,2.25,3h0C2.65,3,3,2.65,3,2.25v0c0-0.2-0.1-0.4-0.2-0.55L2.55,1.5l0.2-0.2 C2.9,1.15,3,0.95,3,0.75v0C3,0.35,2.65,0,2.25,0h0C2.05,0,1.85,0.1,1.7,0.2L1.5,0.45L1.3,0.2C1.15,0.1,0.95,0,0.75,0h0C0.35,0,0,0.35,0,0.75v0 c0,0.2,0.1,0.4,0.2,0.55L0.45,1.5L0.2,1.7C0.1,1.85,0,2.05,0,2.25v0C0,2.65,0.35,3,0.75,3h0c0.2,0,0.4-0.1,0.55-0.2L1.5,2.55z',
};


/** Neighbour flags for connected pattern styles. */
export interface QrDotNeighbours {
  t: boolean;
  r: boolean;
  b: boolean;
  l: boolean;
}

const SEAM = 0.02;

const f = (n: number): string => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
};

function circ(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
}

function diam(cx: number, cy: number, d: number): string {
  return `M${f(cx)} ${f(cy - d)}L${f(cx + d)} ${f(cy)}L${f(cx)} ${f(cy + d)}L${f(cx - d)} ${f(cy)}Z`;
}

function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: [number, number, number, number],
): string {
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

/** 5-point star inscribed in the module. */
function starUnit(px: number, py: number): string {
  const cx = px + 0.5;
  const cy = py + 0.5;
  const R = 0.48;
  const r = 0.2;
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${f(cx + Math.cos(a) * rad)},${f(cy + Math.sin(a) * rad)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** 4-point sparkle / danger-star. */
function sparkleUnit(px: number, py: number): string {
  const cx = px + 0.5;
  const cy = py + 0.5;
  const R = 0.48;
  const r = 0.14;
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${f(cx + Math.cos(a) * rad)},${f(cy + Math.sin(a) * rad)}`);
  }
  return `M${pts.join('L')}Z`;
}

function crossUnit(px: number, py: number): string {
  const t = 0.28;
  const o = (1 - t) / 2;
  return (
    `M${f(px + o)} ${f(py)}h${f(t)}v${f(o)}h${f(o)}v${f(t)}h${f(-o)}v${f(o)}h${f(-t)}` +
    `v${f(-o)}h${f(-o)}v${f(-t)}h${f(o)}Z`
  );
}

function plusUnit(px: number, py: number): string {
  // Soft plus (qr.io) — rounded cross ~0.7 of cell
  const c = px + 0.5;
  const m = py + 0.5;
  const arm = 0.18;
  const tip = 0.42;
  return roundedRect(c - arm, m - tip, arm * 2, tip * 2, [arm, arm, arm, arm])
    + roundedRect(c - tip, m - arm, tip * 2, arm * 2, [arm, arm, arm, arm]);
}

function xUnit(px: number, py: number): string {
  const cx = px + 0.5;
  const cy = py + 0.5;
  const s = 0.32;
  const w = 0.14;
  // Two rounded bars as diamond-thick X approximation
  return (
    `M${f(cx - s)} ${f(cy - s + w)}L${f(cx - s + w)} ${f(cy - s)}L${f(cx + s)} ${f(cy + s - w)}` +
    `L${f(cx + s - w)} ${f(cy + s)}Z` +
    `M${f(cx + s - w)} ${f(cy - s)}L${f(cx + s)} ${f(cy - s + w)}L${f(cx - s + w)} ${f(cy + s)}` +
    `L${f(cx - s)} ${f(cy + s - w)}Z`
  );
}

function heartAt(px: number, py: number): string {
  // Compact heart fitted in module
  const x = px;
  const y = py;
  return (
    `M${f(x + 0.5)} ${f(y + 0.95)}` +
    `C${f(x + 0.5)} ${f(y + 0.95)} ${f(x + 0.05)} ${f(y + 0.55)} ${f(x + 0.05)} ${f(y + 0.32)}` +
    `C${f(x + 0.05)} ${f(y + 0.12)} ${f(x + 0.22)} ${f(y + 0.02)} ${f(x + 0.38)} ${f(y + 0.12)}` +
    `C${f(x + 0.45)} ${f(y + 0.18)} ${f(x + 0.5)} ${f(y + 0.28)} ${f(x + 0.5)} ${f(y + 0.28)}` +
    `C${f(x + 0.5)} ${f(y + 0.28)} ${f(x + 0.55)} ${f(y + 0.18)} ${f(x + 0.62)} ${f(y + 0.12)}` +
    `C${f(x + 0.78)} ${f(y + 0.02)} ${f(x + 0.95)} ${f(y + 0.12)} ${f(x + 0.95)} ${f(y + 0.32)}` +
    `C${f(x + 0.95)} ${f(y + 0.55)} ${f(x + 0.5)} ${f(y + 0.95)} ${f(x + 0.5)} ${f(y + 0.95)}Z`
  );
}

function blobAt(px: number, py: number): string {
  // Soft irregular blob (4 cubic lobes)
  const cx = px + 0.5;
  const cy = py + 0.5;
  return (
    `M${f(cx)} ${f(cy - 0.46)}` +
    `C${f(cx + 0.28)} ${f(cy - 0.46)} ${f(cx + 0.48)} ${f(cy - 0.22)} ${f(cx + 0.46)} ${f(cy)}` +
    `C${f(cx + 0.48)} ${f(cy + 0.26)} ${f(cx + 0.22)} ${f(cy + 0.48)} ${f(cx)} ${f(cy + 0.44)}` +
    `C${f(cx - 0.26)} ${f(cy + 0.48)} ${f(cx - 0.48)} ${f(cy + 0.2)} ${f(cx - 0.44)} ${f(cy)}` +
    `C${f(cx - 0.48)} ${f(cy - 0.24)} ${f(cx - 0.24)} ${f(cy - 0.46)} ${f(cx)} ${f(cy - 0.46)}Z`
  );
}

function shakeAt(px: number, py: number): string {
  // Slightly rotated square (~5°)
  const cx = px + 0.5;
  const cy = py + 0.5;
  const s = 0.38;
  const a = 0.087; // rad
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const corner = (dx: number, dy: number) => {
    const x = cx + dx * cos - dy * sin;
    const y = cy + dx * sin + dy * cos;
    return `${f(x)},${f(y)}`;
  };
  return `M${corner(-s, -s)}L${corner(s, -s)}L${corner(s, s)}L${corner(-s, s)}Z`;
}

function dangerUnit(px: number, py: number): string {
  // Concave square (cut corners inward)
  const x = px;
  const y = py;
  const c = 0.22;
  return (
    `M${f(x + c)} ${f(y)}L${f(x + 1 - c)} ${f(y)}L${f(x + 1)} ${f(y + c)}L${f(x + 1)} ${f(y + 1 - c)}` +
    `L${f(x + 1 - c)} ${f(y + 1)}L${f(x + c)} ${f(y + 1)}L${f(x)} ${f(y + 1 - c)}L${f(x)} ${f(y + c)}Z`
  );
}

/**
 * Legacy / friendly aliases → qr.io API pattern ids.
 */
export const QR_DOT_ALIASES: Readonly<Record<string, QrIoPattern>> = {
  square: 'default',
  dots: 'circle',
  rounded: 'special-circle',
  'extra-rounded': 'ellipse',
  classy: 'special-diamond',
  vertical: 'special-circle-vert',
  horizontal: 'special-circle-orizz',
  tiny: 'plus',
};

export const QR_EYE_FRAME_ALIASES: Readonly<Record<string, QrIoMarker>> = {
  square: 'default',
  'extra-rounded': 'rounded',
  drop_in: 'drop',
  flower_in: 'flower',
  dropeyeright: 'dropeye',
};

export const QR_EYE_BALL_ALIASES: Readonly<Record<string, QrIoMarkerIn>> = {
  square: 'default',
  leaf: 'dropeye',
};

export function resolveQrIoPattern(style: string): QrIoPattern {
  if ((QR_IO_PATTERNS as readonly string[]).includes(style)) return style as QrIoPattern;
  return QR_DOT_ALIASES[style] ?? 'default';
}

export function resolveQrIoMarker(style: string): QrIoMarker {
  if ((QR_IO_MARKERS as readonly string[]).includes(style)) return style as QrIoMarker;
  return QR_EYE_FRAME_ALIASES[style] ?? 'default';
}

export function resolveQrIoMarkerIn(style: string): QrIoMarkerIn {
  if ((QR_IO_MARKER_IN as readonly string[]).includes(style)) return style as QrIoMarkerIn;
  return QR_EYE_BALL_ALIASES[style] ?? 'default';
}

/** Stamp one dark module for a qr.io pattern. */
export function stampQrIoDot(style: string, px: number, py: number, n: QrDotNeighbours): string {
  const id = resolveQrIoPattern(style);
  switch (id) {
    case 'default':
      return `M${f(px)} ${f(py)}h1v1h-1Z`;
    case 'circle':
      return circ(px + 0.5, py + 0.5, 0.45);
    case 'star':
      return starUnit(px, py);
    case 'diamond':
      return diam(px + 0.5, py + 0.5, 0.56);
    case 'sparkle':
      return sparkleUnit(px, py);
    case 'danger':
      return dangerUnit(px, py);
    case 'cross':
      return crossUnit(px, py);
    case 'plus':
      return plusUnit(px, py);
    case 'x':
      return xUnit(px, py);
    case 'heart':
      return heartAt(px, py);
    case 'shake':
      return shakeAt(px, py);
    case 'blob':
      return blobAt(px, py);
    case 'special-circle-orizz': {
      const h = 0.78;
      const y0 = py + (1 - h) / 2;
      const x0 = px - (n.l ? SEAM : 0);
      const w = 1 + (n.l ? SEAM : 0) + (n.r ? SEAM : 0);
      const start = n.l ? 0 : h / 2;
      const end = n.r ? 0 : h / 2;
      return roundedRect(x0, y0, w, h, [start, end, end, start]);
    }
    case 'special-circle-vert': {
      const w = 0.78;
      const x0 = px + (1 - w) / 2;
      const y0 = py - (n.t ? SEAM : 0);
      const h = 1 + (n.t ? SEAM : 0) + (n.b ? SEAM : 0);
      const top = n.t ? 0 : w / 2;
      const bottom = n.b ? 0 : w / 2;
      return roundedRect(x0, y0, w, h, [top, top, bottom, bottom]);
    }
    case 'special-circle': {
      const radius = 0.45;
      const tl = !n.t && !n.l ? radius : 0;
      const tr = !n.t && !n.r ? radius : 0;
      const br = !n.b && !n.r ? radius : 0;
      const bl = !n.b && !n.l ? radius : 0;
      const x0 = px - (n.l ? SEAM : 0);
      const y0 = py - (n.t ? SEAM : 0);
      const w = 1 + (n.l ? SEAM : 0) + (n.r ? SEAM : 0);
      const h = 1 + (n.t ? SEAM : 0) + (n.b ? SEAM : 0);
      return roundedRect(x0, y0, w, h, [tl, tr, br, bl]);
    }
    case 'special-diamond': {
      // Classy: round only TL + BR
      const radius = 0.5;
      const tl = !n.t && !n.l ? radius : 0;
      const br = !n.b && !n.r ? radius : 0;
      const x0 = px - (n.l ? SEAM : 0);
      const y0 = py - (n.t ? SEAM : 0);
      const w = 1 + (n.l ? SEAM : 0) + (n.r ? SEAM : 0);
      const h = 1 + (n.t ? SEAM : 0) + (n.b ? SEAM : 0);
      return roundedRect(x0, y0, w, h, [tl, 0, br, 0]);
    }
    case 'ribbon': {
      // Thick interlocking ribbon ≈ rounded square with soft corners
      return roundedRect(px + 0.04, py + 0.04, 0.92, 0.92, [0.35, 0.12, 0.35, 0.12]);
    }
    case 'oriental': {
      return roundedRect(px + 0.05, py + 0.05, 0.9, 0.9, [0.55, 0.05, 0.55, 0.05]);
    }
    case 'ellipse': {
      const radius = 0.5;
      const tl = !n.t && !n.l ? radius : 0;
      const tr = !n.t && !n.r ? radius : 0;
      const br = !n.b && !n.r ? radius : 0;
      const bl = !n.b && !n.l ? radius : 0;
      const x0 = px - (n.l ? SEAM : 0);
      const y0 = py - (n.t ? SEAM : 0);
      const w = 1 + (n.l ? SEAM : 0) + (n.r ? SEAM : 0);
      const h = 1 + (n.t ? SEAM : 0) + (n.b ? SEAM : 0);
      return roundedRect(x0, y0, w, h, [tl, tr, br, bl]);
    }
    default:
      return `M${f(px)} ${f(py)}h1v1h-1Z`;
  }
}

/** Finder outer ring (7×7) as an SVG path element with translate. */
export function stampQrIoMarker(style: string, x: number, y: number): string {
  const id = resolveQrIoMarker(style);
  const d = QR_IO_MARKER_PATHS[id] ?? QR_IO_MARKER_PATHS.default;
  return `<path d="${d}" transform="translate(${f(x)} ${f(y)})"/>`;
}

/** Finder centre (3×3) as an SVG path element with translate. */
export function stampQrIoBall(style: string, x: number, y: number): string {
  const id = resolveQrIoMarkerIn(style);
  const d = QR_IO_BALL_PATHS[id] ?? QR_IO_BALL_PATHS.default;
  return `<path d="${d}" transform="translate(${f(x + 2)} ${f(y + 2)})"/>`;
}
