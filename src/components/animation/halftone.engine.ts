/**
 * Screen-print halftone engine (AM screening) — canvas 2D, no dependency.
 *
 * 1. Sample the image (area average) and separate it into ink coverages:
 *    C / M / Y with grey-component replacement for K, or luminance for mono.
 * 2. Shape the tones: contrast, dot gain, smallest printable dot.
 * 3. Draw one plate per ink on its own rotated screen. Dot sizes come from a
 *    lookup table so each dot covers exactly the requested share of its cell
 *    (overlap with neighbours included) — tones stay true from 0 to 100 %.
 * 4. Composite plates: `multiply` (transparent inks on light paper) or
 *    `screen` (light inks on dark stock).
 */

export type HalftoneShape = 'circle' | 'ellipse' | 'square' | 'line';

/** Coverage source of an ink: process separations, or combined / luminance channels. */
export type HalftoneChannel = 'c' | 'm' | 'y' | 'k' | 'ck' | 'mk' | 'yk' | 'luma';

export interface HalftoneInk {
  color: string;
  /** Screen angle in degrees. */
  angle: number;
  channel: HalftoneChannel;
  /** Registration offset in CSS px, scaled by `misregistration`. */
  offset?: readonly [number, number];
  /** Ink opacity 0…1 (default 1). */
  opacity?: number;
}

export type HalftonePresetName = 'poster' | 'cmyk' | 'riso' | 'mono';
export type HalftoneBlend = 'multiply' | 'screen';

export interface HalftoneOptions {
  /** Screen pitch (cell size) in output px. */
  cellSize?: number;
  shape?: HalftoneShape;
  /** Paper colour, or `transparent`. */
  paper?: string;
  /** 1 = neutral; > 1 pushes solids and highlights. */
  contrast?: number;
  /** Grey-component replacement 0…1 (share of common CMY moved to black). */
  blackStrength?: number;
  inks?: readonly HalftoneInk[];
  /** Extra rotation added to every screen (degrees). */
  angle?: number;
  /** Multiplies the ink offsets (0 = perfect registration). */
  misregistration?: number;
  /** −0.5…0.5 — positive darkens midtones like spreading ink. */
  dotGain?: number;
  /** Coverage under which no dot prints (screens cannot hold tiny dots). */
  minDot?: number;
  /** `multiply` (default) or `screen` for light inks on dark stock. */
  blend?: HalftoneBlend;
  /** Paper grain 0…1. */
  grain?: number;
  /** Dot edge irregularity 0…1 (hand-pulled look). */
  roughness?: number;
  /** Seed of the deterministic noise (grain, roughness). */
  seed?: number;
}

export const HALFTONE_PRESETS: Readonly<Record<HalftonePresetName, readonly HalftoneInk[]>> = {
  /* Poster / screen-print spot inks — warm, slightly off-register */
  poster: [
    { color: '#ffd400', angle: 0, channel: 'y' },
    { color: '#e8301f', angle: 75, channel: 'm', offset: [1, -1] },
    { color: '#1d3fa8', angle: 15, channel: 'c', offset: [-1, 1] },
    { color: '#111111', angle: 45, channel: 'k' },
  ],
  /* Process CMYK — standard angles Y 0° · M 75° · C 15° · K 45° */
  cmyk: [
    { color: '#fff200', angle: 0, channel: 'y' },
    { color: '#ec008c', angle: 75, channel: 'm' },
    { color: '#00aeef', angle: 15, channel: 'c' },
    { color: '#231f20', angle: 45, channel: 'k' },
  ],
  /* Two-colour riso: fluorescent pink + blue carry the darks between them */
  riso: [
    { color: '#ff48b0', angle: 75, channel: 'mk', offset: [1.5, 0] },
    { color: '#0078bf', angle: 15, channel: 'ck', offset: [-1, 1] },
  ],
  /* Single ink from luminance — colour comes from the component `color` */
  mono: [{ color: '#111111', angle: 45, channel: 'luma' }],
};

export const HALFTONE_DEFAULTS = {
  cellSize: 9,
  shape: 'circle' as HalftoneShape,
  paper: '#f3eedf',
  contrast: 1.25,
  blackStrength: 0.9,
  angle: 0,
  misregistration: 1,
  dotGain: 0,
  minDot: 0.03,
  blend: 'multiply' as HalftoneBlend,
  grain: 0.12,
  roughness: 0,
  seed: 7,
} as const;

type Resolved = Required<Omit<HalftoneOptions, 'inks'>> & { inks: readonly HalftoneInk[] };

function resolve(options: HalftoneOptions): Resolved {
  return {
    ...HALFTONE_DEFAULTS,
    ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)),
    inks: options.inks?.length ? options.inks : HALFTONE_PRESETS.poster,
  } as Resolved;
}

/* ── Tone-accurate dot sizes ─────────────────────────────────────────── */

const LUT_STEPS = 256;
const lutCache = new Map<HalftoneShape, Float32Array>();

/** Ellipse aspect (minor / major) — elliptical "chain" dots join along one axis first. */
const ELLIPSE_RATIO = 0.7;

/**
 * Share of a unit cell covered by dots of size `r` (radius, or half-axis for
 * ellipses) — own dot plus the overlap of the 8 neighbours, sampled on a grid.
 */
function coverageOf(shape: 'circle' | 'ellipse', r: number): number {
  const N = 48;
  let hit = 0;
  const ry = shape === 'ellipse' ? r * ELLIPSE_RATIO : r;
  for (let j = 0; j < N; j++) {
    const py = (j + 0.5) / N - 0.5;
    for (let i = 0; i < N; i++) {
      const px = (i + 0.5) / N - 0.5;
      inside: for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = (px - dx) / r;
          const y = (py - dy) / ry;
          if (x * x + y * y <= 1) {
            hit++;
            break inside;
          }
        }
      }
    }
  }
  return hit / (N * N);
}

/** coverage (0…1, 256 steps) → dot size in cell units. */
export function dotSizeTable(shape: HalftoneShape): Float32Array {
  const cached = lutCache.get(shape);
  if (cached) return cached;
  const lut = new Float32Array(LUT_STEPS);
  if (shape === 'square' || shape === 'line') {
    /* Squares tile exactly (side = √coverage); lines: thickness = coverage */
    for (let i = 0; i < LUT_STEPS; i++) {
      const c = i / (LUT_STEPS - 1);
      lut[i] = shape === 'square' ? Math.sqrt(c) : c;
    }
  } else {
    /* Monotonic coverage(r): sample it, then invert by linear interpolation */
    const S = 96;
    const max = shape === 'ellipse' ? 1 / ELLIPSE_RATIO : Math.SQRT1_2;
    const rs = new Float32Array(S + 1);
    const cs = new Float32Array(S + 1);
    for (let k = 0; k <= S; k++) {
      rs[k] = (k / S) * max;
      cs[k] = k === 0 ? 0 : coverageOf(shape, rs[k]!);
    }
    let k = 0;
    for (let i = 0; i < LUT_STEPS; i++) {
      const c = i / (LUT_STEPS - 1);
      while (k < S && cs[k + 1]! < c) k++;
      const c0 = cs[k]!;
      const c1 = cs[Math.min(S, k + 1)]!;
      const t = c1 > c0 ? Math.min(1, Math.max(0, (c - c0) / (c1 - c0))) : 0;
      lut[i] = rs[k]! + t * (rs[Math.min(S, k + 1)]! - rs[k]!);
    }
  }
  lutCache.set(shape, lut);
  return lut;
}

/* ── Separation ──────────────────────────────────────────────────────── */

export interface Separation {
  c: number;
  m: number;
  y: number;
  k: number;
  luma: number;
}

/** sRGB (0…255) → ink coverages, with contrast and grey-component replacement. */
export function separate(r: number, g: number, b: number, contrast: number, blackStrength: number): Separation {
  const adj = (v: number) => Math.min(1, Math.max(0, (v / 255 - 0.5) * contrast + 0.5));
  const R = adj(r);
  const G = adj(g);
  const B = adj(b);
  let c = 1 - R;
  let m = 1 - G;
  let y = 1 - B;
  const k = Math.min(c, m, y) * Math.min(1, Math.max(0, blackStrength));
  c -= k;
  m -= k;
  y -= k;
  return { c, m, y, k, luma: 1 - (0.2126 * R + 0.7152 * G + 0.0722 * B) };
}

export function channelValue(s: Separation, channel: HalftoneChannel): number {
  switch (channel) {
    case 'c':
      return s.c;
    case 'm':
      return s.m;
    case 'y':
      return s.y;
    case 'k':
      return s.k;
    case 'ck':
      return Math.min(1, s.c + s.k);
    case 'mk':
      return Math.min(1, s.m + s.k);
    case 'yk':
      return Math.min(1, s.y + s.k);
    default:
      return s.luma;
  }
}

/** Dot gain curve: +g darkens midtones (strongest at 50 %), 0 and 100 % unchanged. */
export function applyDotGain(coverage: number, gain: number): number {
  return Math.min(1, Math.max(0, coverage + gain * 4 * coverage * (1 - coverage)));
}

/* ── Sampling ────────────────────────────────────────────────────────── */

interface Sampler {
  (x: number, y: number): [number, number, number];
}

type Source = CanvasImageSource & { width?: number; height?: number };

/** Area-averaged source at half-cell resolution, sampled bilinearly in output space. */
function makeSampler(source: Source, width: number, height: number, cellSize: number): Sampler {
  const step = Math.max(1, cellSize / 2);
  const sw = Math.max(1, Math.ceil(width / step));
  const sh = Math.max(1, Math.ceil(height / step));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  if (!sctx) throw new Error('2D canvas unavailable');
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(source, 0, 0, sw, sh);
  /* Throws a SecurityError for cross-origin images without CORS — caller handles it */
  const px = sctx.getImageData(0, 0, sw, sh).data;
  return (x, y) => {
    const fx = Math.min(sw - 1, Math.max(0, x / step - 0.5));
    const fy = Math.min(sh - 1, Math.max(0, y / step - 0.5));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(sw - 1, x0 + 1);
    const y1 = Math.min(sh - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const at = (xx: number, yy: number, o: number) => px[(yy * sw + xx) * 4 + o]!;
    const mix = (o: number) =>
      (at(x0, y0, o) * (1 - tx) + at(x1, y0, o) * tx) * (1 - ty) +
      (at(x0, y1, o) * (1 - tx) + at(x1, y1, o) * tx) * ty;
    return [mix(0), mix(1), mix(2)];
  };
}

/* ── Plates ──────────────────────────────────────────────────────────── */

/** Deterministic 2D hash → 0…1 (grain, roughness). */
function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Draw one ink plate (dots only, transparent background) into `ctx`, at
 * `width × height` output px. `scale` converts CSS px (cell size, offsets) to
 * output px. The plate keeps its registration offset.
 */
export function drawPlate(
  ctx: CanvasRenderingContext2D,
  sample: Sampler,
  ink: HalftoneInk,
  o: Resolved,
  width: number,
  height: number,
  scale = 1,
): number {
  const cell = Math.max(2, o.cellSize * scale);
  const rad = ((ink.angle + o.angle) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const [offX, offY] = ink.offset ?? [0, 0];
  const ox = offX * o.misregistration * scale;
  const oy = offY * o.misregistration * scale;
  const lut = dotSizeTable(o.shape);
  const invert = o.blend === 'screen';
  const cx = width / 2;
  const cy = height / 2;

  /* Visit only the screen cells whose centre can fall on the canvas */
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, y] of [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ] as const) {
    const dx = x - cx;
    const dy = y - cy;
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const i0 = Math.floor(minU / cell) - 1;
  const i1 = Math.ceil(maxU / cell) + 1;
  const j0 = Math.floor(minV / cell) - 1;
  const j1 = Math.ceil(maxV / cell) + 1;

  ctx.beginPath();
  let dots = 0;
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const u = i * cell;
      const v = j * cell;
      const x = cx + u * cos - v * sin;
      const y = cy + u * sin + v * cos;
      if (x < -cell || y < -cell || x > width + cell || y > height + cell) continue;

      const [r, g, b] = sample(x, y);
      let cov = channelValue(separate(r, g, b, o.contrast, o.blackStrength), ink.channel);
      if (invert) cov = 1 - cov;
      cov = applyDotGain(cov, o.dotGain);
      if (cov < o.minDot) continue;
      if (o.roughness > 0) cov = Math.min(1, cov * (1 + (hash(i, j, o.seed) - 0.5) * 0.3 * o.roughness));

      const size = lut[Math.round(cov * (LUT_STEPS - 1))]! * cell;
      const px = x + ox;
      const py = y + oy;
      dots++;
      switch (o.shape) {
        case 'square':
        case 'line': {
          /* Rotated rectangle: square side = size; line = full pitch × thickness */
          const hw = (o.shape === 'square' ? size : cell) / 2;
          const hh = size / 2;
          const ax = cos * hw;
          const ay = sin * hw;
          const bx = -sin * hh;
          const by = cos * hh;
          ctx.moveTo(px - ax - bx, py - ay - by);
          ctx.lineTo(px + ax - bx, py + ay - by);
          ctx.lineTo(px + ax + bx, py + ay + by);
          ctx.lineTo(px - ax + bx, py - ay + by);
          ctx.closePath();
          break;
        }
        case 'ellipse':
          ctx.moveTo(px + cos * size, py + sin * size);
          ctx.ellipse(px, py, size, size * ELLIPSE_RATIO, rad, 0, Math.PI * 2);
          break;
        default:
          ctx.moveTo(px + size, py);
          ctx.arc(px, py, size, 0, Math.PI * 2);
      }
    }
  }
  /* One fill per plate: dots of the same ink merge instead of darkening each other */
  ctx.fillStyle = ink.color;
  ctx.globalAlpha = Math.min(1, Math.max(0, ink.opacity ?? 1));
  ctx.fill('nonzero');
  ctx.globalAlpha = 1;
  return dots;
}

/** Paper fill + optional grain (deterministic). */
export function drawPaper(ctx: CanvasRenderingContext2D, o: Resolved, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
  if (o.paper && o.paper !== 'transparent') {
    ctx.fillStyle = o.paper;
    ctx.fillRect(0, 0, width, height);
  }
  if (o.grain <= 0) return;
  const tile = 96;
  const noise = document.createElement('canvas');
  noise.width = tile;
  noise.height = tile;
  const nctx = noise.getContext('2d');
  if (!nctx) return;
  const img = nctx.createImageData(tile, tile);
  const strength = Math.min(1, o.grain) * 38;
  for (let i = 0; i < tile * tile; i++) {
    const n = (hash(i % tile, Math.floor(i / tile), o.seed + 101) - 0.5) * 2 * strength;
    const v = o.blend === 'screen' ? 0 : 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = Math.abs(n);
  }
  nctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(noise, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = o.blend === 'screen' ? 'screen' : 'multiply';
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export interface HalftoneResult {
  width: number;
  height: number;
  dots: number;
  ms: number;
}

/**
 * One-shot render (paper + every plate, composited) into `target`.
 * `width` / `height` default to the source's intrinsic size.
 */
export function renderHalftone(
  source: Source,
  target: HTMLCanvasElement,
  options: HalftoneOptions = {},
  size?: { width: number; height: number; scale?: number },
): HalftoneResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const o = resolve(options);
  const nat = intrinsicSize(source);
  const width = Math.max(1, Math.round(size?.width ?? nat.width));
  const height = Math.max(1, Math.round(size?.height ?? nat.height));
  const scale = size?.scale ?? 1;
  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const sample = makeSampler(source, width, height, o.cellSize * scale);
  drawPaper(ctx, o, width, height);
  ctx.globalCompositeOperation = o.blend === 'screen' ? 'screen' : 'multiply';
  let dots = 0;
  for (const ink of o.inks) dots += drawPlate(ctx, sample, ink, o, width, height, scale);
  ctx.globalCompositeOperation = 'source-over';
  return { width, height, dots, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 };
}

/**
 * One canvas per ink plus a paper canvas — composited by CSS (`mix-blend-mode`),
 * so registration drift can animate with transforms instead of re-rendering.
 */
export function renderHalftoneLayers(
  source: Source,
  options: HalftoneOptions,
  size: { width: number; height: number; scale?: number },
  canvases: { paper: HTMLCanvasElement; plates: HTMLCanvasElement[] },
): HalftoneResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const o = resolve(options);
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const scale = size.scale ?? 1;
  const sample = makeSampler(source, width, height, o.cellSize * scale);

  canvases.paper.width = width;
  canvases.paper.height = height;
  const pctx = canvases.paper.getContext('2d');
  if (pctx) drawPaper(pctx, o, width, height);

  let dots = 0;
  o.inks.forEach((ink, idx) => {
    const canvas = canvases.plates[idx];
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    dots += drawPlate(ctx, sample, ink, o, width, height, scale);
  });
  return { width, height, dots, ms: (typeof performance !== 'undefined' ? performance.now() : 0) - t0 };
}

export function intrinsicSize(source: Source): { width: number; height: number } {
  const el = source as HTMLImageElement & HTMLVideoElement;
  let width = el.naturalWidth || el.videoWidth || el.width || 0;
  let height = el.naturalHeight || el.videoHeight || el.height || 0;
  /* Before decode, fall back to HTML width/height attributes so print layout
     can reserve aspect ratio (lazy imgs in a clipped slot never paint otherwise). */
  if ((!width || !height) && 'getAttribute' in el) {
    const aw = Number((el as HTMLImageElement).getAttribute?.('width'));
    const ah = Number((el as HTMLImageElement).getAttribute?.('height'));
    if (aw > 0 && ah > 0) {
      width = aw;
      height = ah;
    }
  }
  return { width, height };
}

/** Parse a JSON ink list (attribute) — invalid input falls back to `null`. */
export function parseInks(json: string | null | undefined): HalftoneInk[] | null {
  if (!json) return null;
  try {
    const list = JSON.parse(json) as unknown;
    if (!Array.isArray(list)) return null;
    const channels: HalftoneChannel[] = ['c', 'm', 'y', 'k', 'ck', 'mk', 'yk', 'luma'];
    const inks = list
      .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map((i) => ({
        color: typeof i.color === 'string' ? i.color : '#111111',
        angle: Number.isFinite(Number(i.angle)) ? Number(i.angle) : 45,
        channel: channels.includes(i.channel as HalftoneChannel) ? (i.channel as HalftoneChannel) : 'luma',
        offset: Array.isArray(i.offset) && i.offset.length === 2 ? ([Number(i.offset[0]) || 0, Number(i.offset[1]) || 0] as const) : undefined,
        opacity: Number.isFinite(Number(i.opacity)) ? Number(i.opacity) : undefined,
      }));
    return inks.length ? inks : null;
  } catch {
    return null;
  }
}
