import { SparkleMouseSpecs } from './sparkle-mouse.specs.js';

export type NumberPair = [number, number];

/** Intensity as a 0–1 factor (`NaN` and out-of-range values are clamped). */
export function intensityFactor(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent)) / 100;
}

/** Live sparkles allowed at this intensity. */
export function maxParticles(percent: number): number {
  const { base, perPercent } = SparkleMouseSpecs.maxParticles;
  const f = intensityFactor(percent);
  return f === 0 ? 0 : Math.round(base + perPercent * f * 100);
}

/**
 * `"#f00, rgb(0, 128, 255), primary"` → `['#f00', 'rgb(0, 128, 255)', 'primary']`.
 * Commas inside parentheses belong to the colour. Arrays are cleaned the same way.
 */
export function parseSparkleColors(value: string | readonly string[] | null | undefined): string[] {
  if (value == null) return [];
  if (typeof value !== 'string') {
    return value.filter((c): c is string => typeof c === 'string').map((c) => c.trim()).filter(Boolean);
  }
  const text = value.trim();
  /* JSON array from an attribute: colors='["#f00","#0f0"]' */
  if (text.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) return parseSparkleColors(parsed as string[]);
    } catch {
      /* fall through to the comma list */
    }
  }
  const out: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      out.push(current);
      current = '';
    } else current += ch;
  }
  out.push(current);
  return out.map((c) => c.trim()).filter(Boolean);
}

const ROLE = /^[a-z][a-z0-9-]*$/;

/**
 * Canvas-ready colours. `primary` → `--k3-sys-color-primary`, `var(--x)` →
 * its computed value, anything else is passed through. Empty input → the
 * default palette; entries that resolve to nothing are dropped.
 */
export function resolveSparkleColors(
  colors: readonly string[] | null | undefined,
  el: Element | null = typeof document !== 'undefined' ? document.documentElement : null,
): string[] {
  const list = colors?.length ? colors : SparkleMouseSpecs.colors;
  const style = el && typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
  const read = (name: string): string => style?.getPropertyValue(name).trim() ?? '';
  const out: string[] = [];
  for (const raw of list) {
    const value = raw.trim();
    if (!value) continue;
    const viaVar = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
    if (viaVar) {
      const resolved = read(viaVar[1]!) || viaVar[2]?.trim() || '';
      if (resolved) out.push(resolved);
      continue;
    }
    if (ROLE.test(value)) {
      /* A theme role when the token exists, otherwise a CSS named colour (`gold`). */
      out.push(read(`--k3-sys-color-${value}`) || value);
      continue;
    }
    out.push(value);
  }
  return out.length ? out : [...SparkleMouseSpecs.fallbackColors];
}

export function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
