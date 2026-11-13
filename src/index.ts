import './styles/k3ux.scss';
import { VERSION } from './version.js';
import { init, autoBootstrap, type K3UXGlobal } from './bootstrap/init.js';
import { registry } from './registry/register.js';

export { VERSION } from './version.js';
export { init, getInitOptions, type InitOptions, type K3UXGlobal } from './bootstrap/init.js';
export { registry } from './registry/register.js';
export { catalog, type ComponentDef } from './registry/catalog.js';

export {
  ConfettiCannon,
  ConfettiPresets,
  ConfettiSpecs,
  firePreset,
  fireRain,
  rain,
  shapeFromPath,
  shapeFromText,
  type ConfettiFireOptions,
  type ConfettiPresetId,
  type ConfettiRainOptions,
} from './components/animation/confetti.js';
export {
  K3Snow,
  SnowEngine,
  SnowSpecs,
  resolveSnowColor,
  SNOW_COLOR_FALLBACK,
  type SnowEngineOptions,
} from './components/animation/snow.js';
export {
  K3Firework,
  FireworksEngine,
  FireworkSpecs,
  resolveFireworkZIndex,
  FIREWORK_SOUND_FILES,
  FIREWORK_SOUND_LOCAL_BASE_URL,
  FIREWORK_SOUND_REMOTE_BASE_URL,
  FIREWORK_SOUND_SOURCES_BASE64,
  getFireworkSoundSources,
  getFireworkSoundSourcesWithFallback,
  type FireworkLayer,
  type FireworkSoundSourceMap,
  type FireworksConfig,
  type FireworksOptions,
  type Quality,
  type SequenceOptions,
  type SequenceSalvo,
  type ShellTypeName,
  type SkyLighting,
  type SoundMode,
} from './components/animation/firework.js';
export {
  K3VoiceRing,
  VoiceRingEngine,
  VoiceRingSpecs,
  type VoiceRingEmotion,
  type VoiceRingEngineOptions,
  type VoiceRingState,
  type VoiceRingTheme,
} from './components/animation/voice-ring.js';
export {
  K3TextBounce,
  TextBounceSpecs,
} from './components/animation/text-bounce.js';
export {
  K3TextScramble,
  TextScrambleSpecs,
  SCRAMBLE_CHAR_PRESETS,
  type ScrambleCharPreset,
  type ScrambleFrom,
} from './components/animation/text-scramble.js';
export {
  K3IconsBurst,
  IconsBurstSpecs,
  type IconsBurstTrigger,
  type IconsBurstIcon,
} from './components/animation/icons-burst.js';
export {
  K3Halftone,
  HalftoneSpecs,
  type HalftoneTone,
} from './components/animation/halftone.js';
export {
  K3HoloCard,
  HoloCardSpecs,
  type HoloCardEffect,
} from './components/animation/cards/holo-card.js';
export {
  K3ScratchCard,
  ScratchCardSpecs,
  type ScratchType,
  type ScratchMetal,
} from './components/animation/cards/scratch-card.js';
export {
  K3LenticularCard,
  LenticularCardSpecs,
  type LenticularAxis,
} from './components/animation/cards/lenticular-card.js';

export {
  getSoundFx,
  SoundFxController,
  SoundFxSpecs,
  resetSoundFxForTests,
  type SoundFxEvent,
  type SoundFxOptions,
} from './components/feedback/sound-fx.js';
export {
  AudioPlayerSpecs,
  resolveAudioPlayerVariant,
  type AudioTrack,
  type AudioPlayerVariant,
  type AudioPlayerVariantAlias,
  type AudioPlayerView,
  type AudioRepeatMode,
} from './components/media/audio-player.js';
export type { K3AudioPlayer } from './components/media/audio-player.js';
export {
  QrCodeSpecs,
  encodeQr,
  QrCapacityError,
  qrDetectMode,
  qrByteCapacity,
  renderQr,
  renderQrSvg,
  contrastRatio,
  QR_DOT_STYLES,
  QR_EYE_FRAME_STYLES,
  QR_EYE_BALL_STYLES,
  QR_FRAME_STYLES,
  QR_FRAME_FONTS,
  QR_LOGO_ICONS,
  type QrEcc,
  type QrMatrix,
  type QrMode,
  type QrEncodeOptions,
  type QrDotStyle,
  type QrEyeFrameStyle,
  type QrEyeBallStyle,
  type QrGradient,
  type QrFrameStyle,
  type QrFrameFont,
  type QrLogoIcon,
  type QrRenderOptions,
  type QrCodeSize,
  type QrExportFormat,
  type QrRenderDetail,
  type QrDownloadDetail,
  type QrExportOptions,
} from './components/media/qr-code.js';
export {
  QR_CONTENT_TYPES,
  buildQrPayload,
  emptyQrPayloads,
  validateQrPayload,
  normalizeUrl,
  normalizePhone,
  type QrContentType,
  type QrPayloadMap,
  type QrFieldError,
  type QrFieldErrors,
  type QrWifiEncryption,
} from './components/media/qr-code.payload.js';
export type { K3QrCode } from './components/media/qr-code.js';
export {
  K3Chart,
  ChartSpecs,
  type K3ChartType,
} from './components/charts/chart.js';
export {
  ensureChartEngine,
  ensureChartJsRegistered,
  Chart as ChartEngine,
  Chart as ChartJs,
  type ChartConfiguration,
  type ChartData,
  type ChartOptions,
  type ChartType,
} from './components/charts/chart.register.js';
export {
  buildDefaultOptions,
  mergeChartOptions,
} from './components/charts/chart.theme.js';
export {
  K3Masonry,
  MasonrySpecs,
} from './components/containment/masonry.js';
export {
  packMasonryItems,
  type MasonryPackOptions,
} from './components/containment/masonry-pack.js';
export {
  K3IsoFilter,
  IsoFilterSpecs,
  type IsoFilterLayout,
} from './components/containment/iso-filter.js';
export {
  K3Countdown,
  CountdownSpecs,
  formatCountdownTime,
  msToCountdownTime,
  parseCountdownFormat,
} from './components/feedback/countdown.js';
export {
  K3Marquee,
  MarqueeSpecs,
} from './components/feedback/marquee.js';
export {
  K3Rating,
  RatingSpecs,
  type RatingColor,
  type RatingSize,
} from './components/inputs/rating.js';
export {
  K3Signature,
  SignatureSpecs,
} from './components/inputs/signature.js';
export {
  K3WheelPicker,
  WheelPickerSpecs,
} from './components/pickers/wheel-picker.js';

const api = {
  version: VERSION,
  init,
  registry,
} satisfies K3UXGlobal;

export default api;

if (typeof window !== 'undefined') {
  window.K3UX = api;
  if (window.K3UX_MANUAL !== true) {
    void autoBootstrap();
  }
}
