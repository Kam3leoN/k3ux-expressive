/**
 * Named confetti presets (canvas-confetti demos + K3ui v1).
 * @see https://www.kirilv.com/canvas-confetti/
 */

import {
  ConfettiCannon,
  shapeFromPath,
  shapeFromText,
  type ConfettiFireOptions,
  type ConfettiFireShape,
  type ConfettiPathShape,
} from './confetti-engine.js';
import { ConfettiSpecs, type ConfettiPresetId } from './confetti.specs.js';

/** Options for the top-down confetti rain effect. */
export type ConfettiRainOptions = {
  /** Total particles to launch (default 250). */
  count?: number;
  /** Base gravity multiplier (default 0.9). */
  gravity?: number;
  /** Effect length in seconds — launch window is 60 % of this (default 3). */
  duration?: number;
  /** Palette; defaults to the rain preset colours. */
  colors?: readonly string[];
};

export type ConfettiPresetTarget = ConfettiCannon | HTMLElement | undefined;

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function resolveCannon(target?: ConfettiPresetTarget): ConfettiCannon | null {
  if (typeof window === 'undefined') return null;
  let cannon: ConfettiCannon | null = null;
  if (target instanceof ConfettiCannon) cannon = target;
  else if (target instanceof HTMLElement) {
    const host = target as HTMLElement & { getCannon?: () => ConfettiCannon; cannon?: ConfettiCannon };
    if (typeof host.getCannon === 'function') cannon = host.getCannon();
    else if (host.cannon instanceof ConfettiCannon) cannon = host.cannon;
    else {
      cannon = new ConfettiCannon(null, { resize: true });
      host.cannon = cannon;
    }
  } else {
    cannon = new ConfettiCannon(null, { resize: true });
  }
  cannon.warm();
  return cannon;
}

/** Basic cannon — default blast. */
export function fireBasic(target?: ConfettiPresetTarget): void {
  resolveCannon(target)?.fire({
    particleCount: 100,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
  });
}

/** Random direction blast. */
export function fireRandom(target?: ConfettiPresetTarget): void {
  resolveCannon(target)?.fire({
    angle: randomInRange(55, 125),
    spread: randomInRange(50, 70),
    particleCount: randomInRange(50, 100),
    origin: { x: 0.5, y: 0.6 },
  });
}

/** Realistic look — layered bursts. */
export function fireRealistic(target?: ConfettiPresetTarget): void {
  const instance = resolveCannon(target);
  if (!instance) return;
  const count = 200;
  const defaults = { origin: { x: 0.5, y: 0.7 } };
  const fire = (particleRatio: number, opts: ConfettiFireOptions) => {
    void instance.fire({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  };
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}

/** Side fireworks for ~15s. */
export function fireFireworks(target?: ConfettiPresetTarget): void {
  const instance = resolveCannon(target);
  if (!instance) return;
  const duration = 15_000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
  const interval = window.setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) {
      clearInterval(interval);
      return;
    }
    const particleCount = 50 * (timeLeft / duration);
    void instance.fire({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
    });
    void instance.fire({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
    });
  }, 250);
}

/** Star bursts. */
export function fireStars(target?: ConfettiPresetTarget): void {
  const instance = resolveCannon(target);
  if (!instance) return;
  const defaults = {
    spread: 360,
    ticks: 50,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: ['#FFE400', '#FFBD00', '#E89400', '#FFCA6C', '#FDFFB8'],
  };
  const shoot = () => {
    void instance.fire({
      ...defaults,
      particleCount: 40,
      scalar: 1.2,
      shapes: ['star'],
    });
  };
  setTimeout(shoot, 0);
  setTimeout(shoot, 100);
  setTimeout(shoot, 200);
}

/** Gentle snow (~15s). */
export function fireSnow(target?: ConfettiPresetTarget): void {
  const instance = resolveCannon(target);
  if (!instance) return;
  let snowflake: ConfettiPathShape;
  try {
    snowflake = shapeFromPath({
      path: 'M288.2 0c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 62.1-15-15c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l49 49 0 70.6-61.2-35.3-17.9-66.9c-3.4-12.8-16.6-20.4-29.4-17S95.3 98 98.7 110.8l5.5 20.5-53.7-31C35.2 91.5 15.6 96.7 6.8 112s-3.6 34.9 11.7 43.7l53.7 31-20.5 5.5c-12.8 3.4-20.4 16.6-17 29.4s16.6 20.4 29.4 17l66.9-17.9 61.2 35.3-61.2 35.3-66.9-17.9c-12.8-3.4-26 4.2-29.4 17s4.2 26 17 29.4l20.5 5.5-53.7 31C3.2 365.1-2 384.7 6.8 400s28.4 20.6 43.7 11.7l53.7-31-5.5 20.5c-3.4 12.8 4.2 26 17 29.4s26-4.2 29.4-17l17.9-66.9 61.2-35.3 0 70.6-49 49c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l15-15 0 62.1c0 17.7 14.3 32 32 32s32-14.3 32-32l0-62.1 15 15c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-49-49 0-70.6 61.2 35.3 17.9 66.9c3.4 12.8 16.6 20.4 29.4 17s20.4-16.6 17-29.4l-5.5-20.5 53.7 31c15.3 8.8 34.9 3.6 43.7-11.7s3.6-34.9-11.7-43.7l-53.7-31 20.5-5.5c12.8-3.4 20.4-16.6 17-29.4s-16.6-20.4-29.4-17l-66.9 17.9-61.2-35.3 61.2-35.3 66.9 17.9c12.8 3.4 26-4.2 29.4-17s-4.2-26-17-29.4l-20.5-5.5 53.7-31c15.3-8.8 20.6-28.4 11.7-43.7s-28.4-20.5-43.7-11.7l-53.7 31 5.5-20.5c3.4-12.8-4.2-26-17-29.4s-26 4.2-29.4 17l-17.9 66.9-61.2 35.3 0-70.6 49-49c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-15 15 0-62.1z',
      matrix: [0.01953125, 0, 0, 0.01953125, -5, -5],
    });
  } catch {
    snowflake = null as unknown as ConfettiPathShape;
  }

  const duration = 15_000;
  const animationEnd = Date.now() + duration;
  let skew = 1;

  (function frame() {
    const timeLeft = animationEnd - Date.now();
    const ticks = Math.max(200, 500 * (timeLeft / duration));
    skew = Math.max(0.8, skew - 0.001);
    const shapes: ConfettiFireShape[] =
      snowflake && Math.random() < 0.6 ? [snowflake] : ['circle'];
    void instance.fire({
      particleCount: 1,
      startVelocity: 0,
      ticks,
      origin: { x: Math.random(), y: Math.random() * skew - 0.2 },
      colors: ['#ffffff'],
      shapes,
      gravity: randomInRange(0.4, 0.6),
      scalar: randomInRange(0.4, 1.2),
      drift: randomInRange(-0.4, 0.4),
    });
    if (timeLeft > 0) requestAnimationFrame(frame);
  })();
}

/** Dual side cannons (school pride). */
export function fireSchoolPride(
  target?: ConfettiPresetTarget,
  colors: string[] = ['#bb0000', '#ffffff'],
): void {
  const instance = resolveCannon(target);
  if (!instance) return;
  const end = Date.now() + 15_000;
  (function frame() {
    void instance.fire({
      particleCount: 2,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.5 },
      colors,
    });
    void instance.fire({
      particleCount: 2,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.5 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Custom SVG path shapes (pumpkin / tree style demos). */
export function fireShapes(target?: ConfettiPresetTarget): void {
  const instance = resolveCannon(target);
  if (!instance) return;
  let triangle: ConfettiFireShape = 'square';
  try {
    triangle = shapeFromPath({
      path: 'M0 10 L5 0 L10 10z',
      matrix: [0.5, 0, 0, 0.5, -2.5, -2.5],
    });
  } catch {
    /* Path2D unsupported */
  }
  void instance.fire({
    particleCount: 80,
    spread: 70,
    origin: { x: 0.5, y: 0.6 },
    shapes: [triangle, 'circle', 'star'],
  });
}

/** Emoji confetti. */
export function fireEmoji(target?: ConfettiPresetTarget): void {
  const instance = resolveCannon(target);
  if (!instance) return;
  let shapes: ConfettiFireShape[] = ['circle'];
  try {
    shapes = [shapeFromText({ text: '🎉', scalar: 2 }), shapeFromText({ text: '✨', scalar: 2 })];
  } catch {
    /* OffscreenCanvas unsupported */
  }
  void instance.fire({
    particleCount: 40,
    spread: 90,
    origin: { x: 0.5, y: 0.6 },
    shapes,
  });
}

/**
 * Confetti rain — particles spawn above the viewport and fall for `duration` seconds.
 * Launch window = 60 % of duration (rAF-paced, batched via `fireSpread`).
 *
 * @example
 * rain({ count: 250, gravity: 0.9, duration: 3 });
 */
export function fireRain(
  target?: ConfettiPresetTarget,
  options: ConfettiRainOptions = {},
): void {
  const instance = resolveCannon(target);
  if (!instance) return;

  const defaults = ConfettiSpecs.rain;
  const count = Math.max(0, Math.floor(options.count ?? defaults.count));
  const gravity = options.gravity ?? defaults.gravity;
  const duration = Math.max(0.1, options.duration ?? defaults.duration);
  const palette = options.colors?.length ? options.colors : defaults.colors;
  if (count === 0) return;

  const launchMs = duration * 600;
  const start = performance.now();
  let fired = 0;

  const frame = (now: number) => {
    const targetCount = Math.min(
      count,
      Math.round((count * (now - start)) / launchMs),
    );
    const batch: ConfettiFireOptions[] = [];
    for (; fired < targetCount; fired++) {
      batch.push({
        particleCount: 1,
        origin: { x: Math.random(), y: -0.05 - Math.random() * 0.2 },
        angle: 270,
        spread: 70,
        startVelocity: 8 + Math.random() * 14,
        gravity: gravity * (0.85 + Math.random() * 0.3),
        drift: (Math.random() - 0.5) * 1.2,
        decay: 0.93,
        ticks: 600,
        scalar: 0.9 + Math.random() * 0.6,
        colors: [palette[Math.floor(Math.random() * palette.length)]!],
      });
    }
    if (batch.length) void instance.fireSpread(batch);
    if (fired < count) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Alias — same as `fireRain` without a target (fullscreen cannon). */
export function rain(options: ConfettiRainOptions = {}): void {
  fireRain(undefined, options);
}

const PRESET_MAP: Record<ConfettiPresetId, (t?: ConfettiPresetTarget) => void> = {
  basic: fireBasic,
  random: fireRandom,
  realistic: fireRealistic,
  fireworks: fireFireworks,
  stars: fireStars,
  snow: fireSnow,
  'school-pride': fireSchoolPride,
  shapes: fireShapes,
  rain: (t) => fireRain(t),
};

/** Run a named preset by id. */
export function firePreset(
  id: ConfettiPresetId,
  target?: ConfettiPresetTarget,
): void {
  PRESET_MAP[id]?.(target);
}

export const ConfettiPresets = {
  fireBasic,
  fireRandom,
  fireRealistic,
  fireFireworks,
  fireStars,
  fireSnow,
  fireSchoolPride,
  fireShapes,
  fireEmoji,
  fireRain,
  rain,
  firePreset,
};
