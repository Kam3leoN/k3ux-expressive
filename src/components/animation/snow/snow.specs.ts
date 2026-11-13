import type { NumberPair } from './snow.utils.js';

/** Defaults aligned with react-snowfall `defaultConfig` + snowflakeCount. */
export const SnowSpecs = {
  /** Empty → `--k3-sys-color-on-surface` (resolved at paint time for canvas). */
  color: '',
  radius: [0.5, 3.0] as NumberPair,
  speed: [1.0, 3.0] as NumberPair,
  wind: [-0.5, 2.0] as NumberPair,
  changeFrequency: 200,
  rotationSpeed: [-1.0, 1.0] as NumberPair,
  opacity: [1, 1] as NumberPair,
  enable3DRotation: false,
  snowflakeCount: 150,
  zIndex: 95,
  accessibility: {
    role: 'presentation',
  },
  behaviors: {
    disableForReducedMotion: true,
  },
} as const;
