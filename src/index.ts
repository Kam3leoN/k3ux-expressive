import './styles/k3ux.scss';
import { VERSION } from './version.js';
import { init, autoBootstrap, type InitOptions, type K3UXGlobal } from './bootstrap/init.js';
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
} from './components/feedback/confetti.js';
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
  K3HeartBurst,
  HeartBurstSpecs,
  type HeartBurstTrigger,
  type HeartBurstIcon,
} from './components/animation/heart-burst.js';
export {
  K3Halftone,
  HalftoneSpecs,
  type HalftoneTone,
} from './components/animation/halftone.js';
export {
  K3HoloCard,
  HoloCardSpecs,
  type HoloCardEffect,
} from './components/animation/holo-card.js';
export {
  K3ScratchCard,
  ScratchCardSpecs,
  type ScratchType,
  type ScratchMetal,
} from './components/animation/scratch-card.js';
export {
  K3LenticularCard,
  LenticularCardSpecs,
  type LenticularAxis,
} from './components/animation/lenticular-card.js';

autoBootstrap();

const api = {
  version: VERSION,
  init,
  registry,
} satisfies K3UXGlobal;

export default api;

declare global {
  interface Window {
    K3UX?: K3UXGlobal;
    K3UX_OPTIONS?: InitOptions;
    K3UX_MANUAL?: boolean;
  }
}
