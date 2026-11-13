/**
 * QR Code encoder — ISO/IEC 18004 (Model 2), versions 1–40, ECC L · M · Q · H.
 *
 * Pure TypeScript, zero dependency, DOM-free (SSR / worker safe).
 * The pipeline follows the classic reference structure (segment → codewords →
 * Reed–Solomon → interleave → function patterns → zig-zag placement → mask
 * selection by penalty score), re-implemented for K3ui.
 *
 * Data modes: numeric · alphanumeric · byte (UTF-8, no ECI — what every modern
 * scanner expects). A single mode is picked for the whole payload.
 */

export type QrEcc = 'L' | 'M' | 'Q' | 'H';
export type QrMode = 'numeric' | 'alphanumeric' | 'byte';

export interface QrEncodeOptions {
  /** Error-correction level (default `M`). */
  ecc?: QrEcc;
  /** Smallest version allowed (1–40, default 1). */
  minVersion?: number;
  /** Largest version allowed (1–40, default 40). */
  maxVersion?: number;
  /** Mask pattern 0–7, or -1 for automatic selection (default). */
  mask?: number;
  /** Raise ECC when the payload still fits the chosen version (default false). */
  boostEcc?: boolean;
  /** Force a data mode (must be able to encode the text). */
  mode?: QrMode;
}

export interface QrMatrix {
  version: number;
  /** Modules per side (`17 + 4 × version`). */
  size: number;
  ecc: QrEcc;
  mask: number;
  mode: QrMode;
  /** Encoded payload length in bytes (UTF-8 for byte mode, chars otherwise). */
  length: number;
  /** Row-major dark modules — `modules[y * size + x] === 1`. */
  modules: Uint8Array;
  /** Row-major function-pattern map (finder, timing, alignment, format, version). */
  functions: Uint8Array;
}

/** Thrown when the payload does not fit in `maxVersion` at the requested ECC. */
export class QrCapacityError extends Error {
  readonly bits: number;
  readonly capacityBits: number;
  constructor(bits: number, capacityBits: number) {
    super(`QR payload too long: ${bits} bits > ${capacityBits} bits`);
    this.name = 'QrCapacityError';
    this.bits = bits;
    this.capacityBits = capacityBits;
  }
}

export const QR_MIN_VERSION = 1;
export const QR_MAX_VERSION = 40;

const ECC_ORDER: readonly QrEcc[] = ['L', 'M', 'Q', 'H'];
const ECC_ORDINAL: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
/** Two-bit format code per level (spec table 12). */
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Share of codewords each level can restore (spec, rounded). */
export const QR_ECC_RECOVERY: Record<QrEcc, number> = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

/* prettier-ignore */
const ECC_CODEWORDS_PER_BLOCK: readonly (readonly number[])[] = [
  // Version: (index 0 unused)
  // 0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40
  [-1,  7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // H
];

/* prettier-ignore */
const NUM_ERROR_CORRECTION_BLOCKS: readonly (readonly number[])[] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4,  4,  4,  4,  4,  6,  6,  6,  6,  7,  8,  8,  9,  9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5,  5,  8,  9,  9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8,  8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // H
];

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const NUMERIC_RE = /^[0-9]*$/;
const ALPHANUMERIC_RE = /^[0-9A-Z $%*+./:-]*$/;

const MODE_INDICATOR: Record<QrMode, number> = { numeric: 0x1, alphanumeric: 0x2, byte: 0x4 };
const CHAR_COUNT_BITS: Record<QrMode, readonly [number, number, number]> = {
  numeric: [10, 12, 14],
  alphanumeric: [9, 11, 13],
  byte: [8, 16, 16],
};

/* ── Capacity helpers ──────────────────────────────────────────────────── */

/** Modules available for data + ECC codewords (remainder bits included). */
export function qrRawDataModules(version: number): number {
  assertVersion(version);
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** 8-bit data codewords for a version / level (ECC codewords excluded). */
export function qrDataCodewords(version: number, ecc: QrEcc): number {
  const e = ECC_ORDINAL[ecc];
  return (
    Math.floor(qrRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[e]![version]! * NUM_ERROR_CORRECTION_BLOCKS[e]![version]!
  );
}

/** Pick the most compact single mode able to encode `text`. */
export function qrDetectMode(text: string): QrMode {
  if (NUMERIC_RE.test(text)) return 'numeric';
  if (ALPHANUMERIC_RE.test(text)) return 'alphanumeric';
  return 'byte';
}

function charCountBits(mode: QrMode, version: number): number {
  const i = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return CHAR_COUNT_BITS[mode][i];
}

function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < QR_MIN_VERSION || version > QR_MAX_VERSION) {
    throw new RangeError(`QR version out of range: ${version}`);
  }
}

/* ── Bit buffer ────────────────────────────────────────────────────────── */

class BitBuffer {
  readonly bits: number[] = [];

  append(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  get length(): number {
    return this.bits.length;
  }
}

interface Segment {
  mode: QrMode;
  count: number;
  data: BitBuffer;
}

const textEncoder: { encode(input: string): Uint8Array } | null =
  typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

/** UTF-8 bytes (TextEncoder when present, manual fallback otherwise). */
export function utf8Bytes(text: string): Uint8Array {
  if (textEncoder) return textEncoder.encode(text);
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
  }
  return Uint8Array.from(out);
}

function makeSegment(text: string, mode: QrMode): Segment {
  const data = new BitBuffer();
  if (mode === 'numeric') {
    if (!NUMERIC_RE.test(text)) throw new TypeError('Text is not numeric');
    for (let i = 0; i < text.length; ) {
      const n = Math.min(text.length - i, 3);
      data.append(parseInt(text.slice(i, i + n), 10), n * 3 + 1);
      i += n;
    }
    return { mode, count: text.length, data };
  }
  if (mode === 'alphanumeric') {
    if (!ALPHANUMERIC_RE.test(text)) throw new TypeError('Text is not alphanumeric');
    let i = 0;
    for (; i + 2 <= text.length; i += 2) {
      const v =
        ALPHANUMERIC_CHARSET.indexOf(text[i]!) * 45 + ALPHANUMERIC_CHARSET.indexOf(text[i + 1]!);
      data.append(v, 11);
    }
    if (i < text.length) data.append(ALPHANUMERIC_CHARSET.indexOf(text[i]!), 6);
    return { mode, count: text.length, data };
  }
  const bytes = utf8Bytes(text);
  for (const b of bytes) data.append(b, 8);
  return { mode, count: bytes.length, data };
}

/** Total bits for the segment at `version`, or `Infinity` when the count overflows. */
function segmentBits(seg: Segment, version: number): number {
  const ccBits = charCountBits(seg.mode, version);
  if (seg.count >= 1 << ccBits) return Number.POSITIVE_INFINITY;
  return 4 + ccBits + seg.data.length;
}

/* ── Reed–Solomon over GF(2^8 / 0x11D) ─────────────────────────────────── */

function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

const rsDivisorCache = new Map<number, Uint8Array>();

function rsDivisor(degree: number): Uint8Array {
  const cached = rsDivisorCache.get(degree);
  if (cached) return cached;
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = rsMultiply(result[j]!, root);
      if (j + 1 < degree) result[j]! ^= result[j + 1]!;
    }
    root = rsMultiply(root, 0x02);
  }
  rsDivisorCache.set(degree, result);
  return result;
}

function rsRemainder(data: ArrayLike<number>, divisor: Uint8Array): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (let k = 0; k < data.length; k++) {
    const factor = data[k]! ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i]! ^= rsMultiply(divisor[i]!, factor);
  }
  return result;
}

function addEccAndInterleave(data: number[], version: number, ecc: QrEcc): number[] {
  const e = ECC_ORDINAL[ecc];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]![version]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e]![version]!;
  const rawCodewords = Math.floor(qrRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + len);
    k += len;
    const eccWords = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0); // placeholder, skipped when interleaving
    blocks.push(dat.concat(eccWords));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(blocks[j]![i]!);
    }
  }
  return result;
}

/* ── Matrix construction ───────────────────────────────────────────────── */

class Grid {
  readonly modules: Uint8Array;
  readonly functions: Uint8Array;
  constructor(readonly size: number) {
    this.modules = new Uint8Array(size * size);
    this.functions = new Uint8Array(size * size);
  }
  get(x: number, y: number): number {
    return this.modules[y * this.size + x]!;
  }
  setFunction(x: number, y: number, dark: boolean): void {
    const i = y * this.size + x;
    this.modules[i] = dark ? 1 : 0;
    this.functions[i] = 1;
  }
}

/** Alignment pattern centre coordinates (ascending) for a version. */
export function qrAlignmentPositions(version: number): number[] {
  assertVersion(version);
  if (version === 1) return [];
  const size = version * 4 + 17;
  const numAlign = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function drawFinder(grid: Grid, cx: number, cy: number): void {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 0 && x < grid.size && y >= 0 && y < grid.size) {
        grid.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
}

function drawAlignment(grid: Grid, cx: number, cy: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      grid.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(grid: Grid, ecc: QrEcc, mask: number): void {
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number): boolean => ((bits >>> i) & 1) !== 0;
  const size = grid.size;

  // First copy — around the top-left finder
  for (let i = 0; i <= 5; i++) grid.setFunction(8, i, bit(i));
  grid.setFunction(8, 7, bit(6));
  grid.setFunction(8, 8, bit(7));
  grid.setFunction(7, 8, bit(8));
  for (let i = 9; i < 15; i++) grid.setFunction(14 - i, 8, bit(i));

  // Second copy — split between top-right and bottom-left finders
  for (let i = 0; i < 8; i++) grid.setFunction(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) grid.setFunction(8, size - 15 + i, bit(i));
  grid.setFunction(8, size - 8, true); // dark module
}

function drawVersionBits(grid: Grid, version: number): void {
  if (version < 7) return;
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0;
    const a = grid.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    grid.setFunction(a, b, dark);
    grid.setFunction(b, a, dark);
  }
}

function drawFunctionPatterns(grid: Grid, version: number, ecc: QrEcc): void {
  const size = grid.size;
  for (let i = 0; i < size; i++) {
    grid.setFunction(6, i, i % 2 === 0);
    grid.setFunction(i, 6, i % 2 === 0);
  }
  drawFinder(grid, 3, 3);
  drawFinder(grid, size - 4, 3);
  drawFinder(grid, 3, size - 4);

  const align = qrAlignmentPositions(version);
  const n = align.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const corner = (i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0);
      if (!corner) drawAlignment(grid, align[i]!, align[j]!);
    }
  }
  drawFormatBits(grid, ecc, 0); // reserved — overwritten after masking
  drawVersionBits(grid, version);
}

function drawCodewords(grid: Grid, codewords: number[]): void {
  const size = grid.size;
  const totalBits = codewords.length * 8;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing column
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        const idx = y * size + x;
        if (!grid.functions[idx] && i < totalBits) {
          grid.modules[idx] = (codewords[i >>> 3]! >>> (7 - (i & 7))) & 1;
          i++;
        }
        // Remainder bits stay light (0)
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new RangeError(`Invalid mask: ${mask}`);
  }
}

/** XOR the mask over non-function modules (self-inverse). */
function applyMask(grid: Grid, mask: number): void {
  const size = grid.size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (!grid.functions[idx] && maskBit(mask, x, y)) grid.modules[idx]! ^= 1;
    }
  }
}

/* ── Penalty score (spec §7.8.3) ───────────────────────────────────────── */

function penaltyScore(grid: Grid): number {
  const size = grid.size;
  let result = 0;

  const addHistory = (run: number, history: number[]): void => {
    if (history[0] === 0) run += size; // light border before the first run
    history.pop();
    history.unshift(run);
  };
  const countPatterns = (h: number[]): number => {
    const n = h[1]!;
    const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
    return (
      (core && h[0]! >= n * 4 && h[6]! >= n ? 1 : 0) +
      (core && h[6]! >= n * 4 && h[0]! >= n ? 1 : 0)
    );
  };
  const terminate = (runColor: number, run: number, history: number[]): number => {
    if (runColor) {
      addHistory(run, history);
      run = 0;
    }
    run += size; // light border after the last run
    addHistory(run, history);
    return countPatterns(history);
  };

  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let runColor = 0;
      let run = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let b = 0; b < size; b++) {
        const color = pass === 0 ? grid.get(b, a) : grid.get(a, b);
        if (color === runColor) {
          run++;
          if (run === 5) result += PENALTY_N1;
          else if (run > 5) result++;
        } else {
          addHistory(run, history);
          if (!runColor) result += countPatterns(history) * PENALTY_N3;
          runColor = color;
          run = 1;
        }
      }
      result += terminate(runColor, run, history) * PENALTY_N3;
    }
  }

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = grid.get(x, y);
      if (c === grid.get(x + 1, y) && c === grid.get(x, y + 1) && c === grid.get(x + 1, y + 1)) {
        result += PENALTY_N2;
      }
    }
  }

  let dark = 0;
  for (let i = 0; i < grid.modules.length; i++) dark += grid.modules[i]!;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * PENALTY_N4;
  return result;
}

/* ── Public API ────────────────────────────────────────────────────────── */

/**
 * Encode `text` into a QR matrix.
 *
 * @throws {QrCapacityError} payload too long for `maxVersion` at that level
 */
export function encodeQr(text: string, options: QrEncodeOptions = {}): QrMatrix {
  let ecc: QrEcc = options.ecc ?? 'M';
  if (!ECC_ORDER.includes(ecc)) ecc = 'M';
  const minVersion = clampInt(options.minVersion ?? QR_MIN_VERSION, 1, 40);
  const maxVersion = clampInt(options.maxVersion ?? QR_MAX_VERSION, minVersion, 40);
  const mask = options.mask ?? -1;
  if (!Number.isInteger(mask) || mask < -1 || mask > 7) throw new RangeError(`Invalid mask: ${mask}`);

  const mode = options.mode ?? qrDetectMode(text);
  const seg = makeSegment(text, mode);

  // Smallest version that fits
  let version = minVersion;
  let usedBits = 0;
  for (;;) {
    const capacityBits = qrDataCodewords(version, ecc) * 8;
    usedBits = segmentBits(seg, version);
    if (usedBits <= capacityBits) break;
    if (version >= maxVersion) {
      throw new QrCapacityError(Number.isFinite(usedBits) ? usedBits : seg.data.length, capacityBits);
    }
    version++;
  }

  if (options.boostEcc) {
    for (const level of ['M', 'Q', 'H'] as const) {
      if (ECC_ORDINAL[level] > ECC_ORDINAL[ecc] && usedBits <= qrDataCodewords(version, level) * 8) {
        ecc = level;
      }
    }
  }

  // Data bits → codewords (terminator + padding)
  const capacityBits = qrDataCodewords(version, ecc) * 8;
  const bb = new BitBuffer();
  bb.append(MODE_INDICATOR[seg.mode], 4);
  bb.append(seg.count, charCountBits(seg.mode, version));
  for (const b of seg.data.bits) bb.bits.push(b);
  bb.append(0, Math.min(4, capacityBits - bb.length));
  bb.append(0, (8 - (bb.length % 8)) % 8);
  for (let pad = 0xec; bb.length < capacityBits; pad ^= 0xec ^ 0x11) bb.append(pad, 8);

  const data: number[] = new Array(bb.length >>> 3).fill(0);
  bb.bits.forEach((bit, i) => {
    data[i >>> 3]! |= bit << (7 - (i & 7));
  });

  const size = version * 4 + 17;
  const grid = new Grid(size);
  drawFunctionPatterns(grid, version, ecc);
  drawCodewords(grid, addEccAndInterleave(data, version, ecc));

  let chosen = mask;
  if (chosen === -1) {
    let best = Number.POSITIVE_INFINITY;
    for (let m = 0; m < 8; m++) {
      applyMask(grid, m);
      drawFormatBits(grid, ecc, m);
      const score = penaltyScore(grid);
      if (score < best) {
        best = score;
        chosen = m;
      }
      applyMask(grid, m); // undo (XOR)
    }
  }
  applyMask(grid, chosen);
  drawFormatBits(grid, ecc, chosen);

  return {
    version,
    size,
    ecc,
    mask: chosen,
    mode: seg.mode,
    length: seg.count,
    modules: grid.modules,
    functions: grid.functions,
  };
}

/** `true` when the module at (x, y) is dark (out-of-range → light). */
export function qrIsDark(matrix: QrMatrix, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= matrix.size || y >= matrix.size) return false;
  return matrix.modules[y * matrix.size + x] === 1;
}

/** Max payload (bytes in byte mode) for a version / level — handy for UI hints. */
export function qrByteCapacity(version: number, ecc: QrEcc): number {
  const bits = qrDataCodewords(version, ecc) * 8 - 4 - charCountBits('byte', version);
  return Math.max(0, Math.floor(bits / 8));
}

function clampInt(value: number, min: number, max: number): number {
  const n = Math.round(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, n));
}
