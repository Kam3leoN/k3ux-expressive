/**
 * Specs for `k3-confetti` — defaults aligned with canvas-confetti / K3ui v1.
 */

export const ConfettiSpecs = {
  behaviors: {
    particleCount: 50,
    angle: 90,
    spread: 45,
    startVelocity: 45,
    decay: 0.9,
    gravity: 1,
    drift: 0,
    ticks: 200,
    scalar: 1,
    zIndex: 100,
    resize: true,
    flat: false,
    disableForReducedMotion: true,
    originX: 0.5,
    originY: 0.5,
  },
  colors: [
    '#26ccff',
    '#a25afd',
    '#ff5e7e',
    '#88ff5a',
    '#fcff42',
    '#ffa62d',
    '#ff36ff',
  ] as const,
  shapes: {
    available: ['square', 'circle', 'star'] as const,
    default: ['square', 'circle'] as const,
  },
  accessibility: {
    role: 'presentation' as const,
    ariaHidden: true,
  },
  presets: [
    'basic',
    'random',
    'realistic',
    'school-pride',
    'fireworks',
    'stars',
    'snow',
    'shapes',
    'rain',
  ] as const,
  /** Defaults for `rain()` — particle drizzle from the top. */
  rain: {
    count: 250,
    gravity: 0.9,
    duration: 3,
    colors: [
      '#e67e22',
      '#2ecc71',
      '#3498db',
      '#84AAC2',
      '#E6D68D',
      '#F67933',
      '#42A858',
      '#4F50A2',
      '#A86BB7',
      '#e74c3c',
      '#1abc9c',
    ] as const,
  },
};

export type ConfettiPresetId = (typeof ConfettiSpecs.presets)[number];
