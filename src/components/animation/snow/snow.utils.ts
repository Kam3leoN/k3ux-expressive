/** Math helpers — same roles as react-snowfall `utils`. */

/** Random in [min, max]. Integers stay integers when both bounds are ints. */
export function random(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return Math.random() * (max - min) + min;
  }
  return Math.floor(Math.random() * (max - min + 1) + min);
}

/** Linear interpolation toward a target. */
export function lerp(start: number, end: number, normal: number): number {
  return (1 - normal) * start + normal * end;
}

/** Pick a random element from a non-empty array. */
export function randomElement<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export const twoPi = Math.PI * 2;

/** Target frame duration for 60 fps (ms). */
export const targetFrameTime = 1000 / 60;

export type NumberPair = [number, number];

/** Fallback when `--k3-sys-color-on-surface` is unavailable (M3 light on-surface). */
export const SNOW_COLOR_FALLBACK = '#1c1b1f';

/**
 * Resolve a snow paint color for canvas.
 * Empty / `on-surface` / `var(--k3-sys-color-on-surface)` → theme token.
 */
export function resolveSnowColor(
  color: string | undefined | null,
  el: Element | null = typeof document !== 'undefined'
    ? document.documentElement
    : null,
): string {
  const raw = (color ?? '').trim();
  const useTheme =
    !raw ||
    raw === 'on-surface' ||
    raw === 'var(--k3-sys-color-on-surface)' ||
    raw === 'currentColor';
  if (!useTheme) return raw;
  if (!el || typeof getComputedStyle !== 'function') return SNOW_COLOR_FALLBACK;
  const token = getComputedStyle(el)
    .getPropertyValue('--k3-sys-color-on-surface')
    .trim();
  return token || SNOW_COLOR_FALLBACK;
}

export function samePair(
  a: NumberPair | undefined,
  b: NumberPair | undefined,
): boolean {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

export function sameImages(
  a: CanvasImageSource[] | undefined,
  b: CanvasImageSource[] | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((img, i) => img === b[i]);
}
