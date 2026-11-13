/**
 * Marquee — behaviour modelled on MarqueeJS (Vincent Loy, MIT): time-based
 * scrolling in px/s, four directions, gap, clone count, pause on hover, auto
 * pause off-screen / in hidden tabs, dynamic content.
 */
export type MarqueeMode = 'infinite' | 'classic';
export type MarqueeDirection = 'left' | 'right' | 'up' | 'down';
/** Infinite mode only: `filled` = track already covered · `edge` = enters from the far edge. */
export type MarqueeStart = 'filled' | 'edge';
/** Surface style of the band. */
export type MarqueeVariant = 'plain' | 'tonal' | 'filled' | 'outlined';

export const MarqueeSpecs = {
  mode: 'infinite' as MarqueeMode,
  direction: 'left' as MarqueeDirection,
  start: 'filled' as MarqueeStart,
  /** Seconds per loop when `speed` is not set (previous API). */
  duration: 20 as number,
  gap: 80 as number,
  pauseOnHover: false as boolean,
  variant: 'plain' as MarqueeVariant,
  pauseOnFocus: true as boolean,
  autoplay: true as boolean,
  /** Pause when each item’s start reaches the near edge. */
  pauseAtItems: false as boolean,
  /** Dwell at each item when `pauseAtItems` is on (seconds). */
  itemPause: 1.5 as number,
  /** MarqueeJS caps clones at 15. */
  maxClones: 15,
};

/** Derive animation duration (seconds) from speed (px/s) and track width (px). */
export function durationFromSpeed(trackWidthPx: number, speedPxPerSec: number): number {
  if (speedPxPerSec <= 0 || trackWidthPx <= 0) return MarqueeSpecs.duration;
  return Math.max(0.1, trackWidthPx / speedPxPerSec);
}

/**
 * Offset of the track along the scroll axis after travelling `distance` px.
 * Coordinates are for a track anchored at the start edge and moving towards it
 * (left / up); the component mirrors them for right / down.
 *
 * - infinite + filled: `-(d mod period)` — covered from the first frame
 * - infinite + edge:   enters from `viewport`, then loops like filled
 * - classic:           single pass from `viewport` to `-setSize`, then again
 */
/** `a mod n` in `[0, n)` (also for negative `a`). */
export function positiveMod(a: number, n: number): number {
  return n > 0 ? ((a % n) + n) % n : 0;
}

export function marqueeOffset(
  distance: number,
  o: { mode: MarqueeMode; start: MarqueeStart; viewport: number; period: number; setSize: number },
): number {
  /* distance can be negative after dragging backwards — wrap with a positive modulo */
  const d = Number.isFinite(distance) ? distance : 0;
  if (o.mode === 'classic') {
    const lap = o.viewport + o.setSize;
    return lap > 0 ? o.viewport - positiveMod(d, lap) : 0;
  }
  if (o.period <= 0) return 0;
  if (o.start === 'edge') {
    if (d < o.viewport) return o.viewport - Math.max(0, d);
    return -positiveMod(d - o.viewport, o.period);
  }
  return -positiveMod(d, o.period);
}

/**
 * Station offsets (px) within one period — each item’s start relative to the set.
 * Deduped, sorted, clamped to `[0, period)`.
 */
export function marqueeItemStations(itemOffsets: readonly number[], period: number): number[] {
  if (period <= 0) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of itemOffsets) {
    if (!Number.isFinite(raw)) continue;
    const s = ((Math.round(raw) % period) + period) % period;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.sort((a, b) => a - b);
}

/**
 * If travel from `prevLocal` → `local` (both in `[0, period)`) crossed a station,
 * returns that station; otherwise `null`. Prefers the first station on the path.
 */
export function crossedMarqueeStation(
  prevLocal: number,
  local: number,
  stations: readonly number[],
  period: number,
): number | null {
  if (stations.length === 0 || period <= 0) return null;
  if (prevLocal === local) return null;
  const eps = 0.5;
  const path: number[] = [];
  if (local >= prevLocal) {
    for (const s of stations) {
      if (s > prevLocal + eps && s <= local + eps) path.push(s);
    }
  } else {
    /* Wrapped past period → 0 */
    for (const s of stations) {
      if (s > prevLocal + eps && s < period) path.push(s);
    }
    for (const s of stations) {
      if (s <= local + eps) path.push(s);
    }
  }
  return path[0] ?? null;
}
