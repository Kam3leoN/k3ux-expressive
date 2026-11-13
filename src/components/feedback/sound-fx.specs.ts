export const SoundFxSpecs = {
  storageKey: 'k3-sfx-muted',
  defaultVolume: 0.5,
  defaultFormats: ['ogg', 'mp3', 'wav'] as const,
  events: ['click', 'hover', 'enter', 'leave'] as const,
  accessibility: {
    role: 'group' as const,
  },
};
