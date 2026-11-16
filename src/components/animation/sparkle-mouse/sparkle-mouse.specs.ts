/** Defaults of `<k3-sparkle-mouse>` — a light blue-violet trail by default, dense at 100. */
export const SparkleMouseSpecs = {
  /** Percent, 0–100. 20 = a light trail behind the pointer. */
  intensity: 20,
  /**
   * Palette — theme roles (`primary`), any CSS colour, or `var(--x)`.
   * Any length: every sparkle picks one entry at random.
   */
  colors: ['#5b8def', '#6f7bf7', '#7c5cff', '#9a6bff', '#b388ff'] as readonly string[],
  /** Used when no entry of a custom palette resolves (unknown role, empty `var()`). */
  fallbackColors: ['#5b8def', '#6f7bf7', '#7c5cff', '#9a6bff', '#b388ff'] as readonly string[],
  /** Tip-to-tip length range, CSS px. */
  size: [12, 28] as readonly [number, number],
  /** Mean life of a sparkle, ms (each one varies ±35 %). */
  duration: 1100,
  /** Scatter radius around the pointer path, CSS px. */
  spread: 36,
  /** Downward pull, px / s². 0 = sparkles float where they were born; negative values rise. */
  gravity: 0,
  /** Sparkles per pixel travelled at 100 % intensity. */
  maxPerPx: 0.5,
  /** Live sparkles allowed: `base + perPercent × intensity`. */
  maxParticles: { base: 40, perPercent: 8 },
  /** One pointer event never spawns more than this (tab switch, teleport). */
  maxPerMove: 80,
  /** Inner / outer radius of the four-point star (thin = crisp cross). */
  starInset: 0.14,
  zIndex: 96,
  accessibility: {
    role: 'presentation',
  },
  behaviors: {
    disableForReducedMotion: true,
    touch: false,
  },
} as const;
