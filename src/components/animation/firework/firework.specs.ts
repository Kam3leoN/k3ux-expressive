import type { Quality, ShellTypeName, SkyLighting, SoundMode } from './firework-engine.js';
import {
  FIREWORK_SOUND_LOCAL_BASE_URL,
  FIREWORK_SOUND_REMOTE_BASE_URL,
  getFireworkSoundSourcesWithFallback,
} from './firework-audio.js';

/** Defaults aligned with K3ui v1 FireworkSpecs (exact mp3 samples by default). */
export const FireworkSpecs = {
  behaviors: {
    quality: 2 as Quality,
    shell: 'Random' as ShellTypeName,
    size: 3,
    autoLaunch: false,
    finale: false,
    skyLighting: 2 as SkyLighting,
    longExposure: false,
    trails: true,
    imprints: false,
    scaleFactor: 1,
    soundEnabled: false,
    soundMode: 'samples' as SoundMode,
    transparentBackground: true,
    layer: 'front' as const,
    zIndexBehind: -1,
    zIndexFront: 450,
    highDPI: true,
    autoStart: true,
    disableForReducedMotion: true,
  },
  sound: {
    defaultMode: 'samples' as SoundMode,
    defaultBaseUrl: FIREWORK_SOUND_REMOTE_BASE_URL,
    localBaseUrl: FIREWORK_SOUND_LOCAL_BASE_URL,
    /** Exact CodePen / v1 samples (base64 first, then remote, then local). */
    defaultSources: () => getFireworkSoundSourcesWithFallback(),
  },
  shells: [
    'Random',
    'Crackle',
    'Crossette',
    'Crysanthemum',
    'Falling Leaves',
    'Floral',
    'Ghost',
    'Horse Tail',
    'Palm',
    'Ring',
    'Strobe',
    'Willow',
  ] as const satisfies readonly ShellTypeName[],
  sequences: {
    celebrate: [{ count: 2 }, { count: 3 }, { count: 2 }, { finale: true }],
  },
  accessibility: {
    role: 'presentation',
  },
} as const;

export type FireworkLayer = 'behind' | 'front';

export function resolveFireworkZIndex(
  layer: FireworkLayer,
  zIndex?: number,
  zIndexExplicit = false,
): number {
  if (zIndexExplicit && zIndex != null) return zIndex;
  return layer === 'front'
    ? FireworkSpecs.behaviors.zIndexFront
    : FireworkSpecs.behaviors.zIndexBehind;
}
