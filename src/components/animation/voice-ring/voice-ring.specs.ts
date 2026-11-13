/** Specs for the color spectrum voice ring (no mono variant). */
export type VoiceRingState = 'idle' | 'listening' | 'speaking' | 'processing';
export type VoiceRingEmotion = 'positive' | 'negative' | 'calm' | '';
export type VoiceRingTheme = 'auto' | 'dark' | 'light';

export const VoiceRingSpecs = {
  size: 240,
  state: 'idle' as VoiceRingState,
  emotion: '' as VoiceRingEmotion,
  direction: 0,
  sensitivity: 0.85,
  speed: 1,
  threshold: 0.04,
  release: 0.12,
  rings: 6,
  lean: 0.91,
  ringGap: 0.02,
  deform: 1.45,
  halo: 0.5,
  radius: 0.56,
  theme: 'auto' as VoiceRingTheme,
  paused: false,
  accessibility: {
    role: 'img',
  },
} as const;
