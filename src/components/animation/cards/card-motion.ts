/**
 * Shared motion for the card effects (`k3-holo-card`, `k3-lenticular-card`):
 * a multi-value spring, pointer → ratio mapping and device-tilt input.
 * Internal module — no custom element here.
 */

export interface CardSpringConfig {
  /** Higher = follows the target faster. */
  stiffness: number;
  /** Higher = less overshoot. */
  damping: number;
}

/** Below this, a value is considered settled. */
const EPSILON = 0.001;

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * Damped spring on several values at once (semi-implicit Euler, time-based —
 * same feel at any refresh rate). Drives itself with `requestAnimationFrame`
 * and calls `onFrame` after each step; stops once every value has settled.
 */
export class CardSpring<K extends string> {
  readonly value: Record<K, number>;
  readonly target: Record<K, number>;
  config: CardSpringConfig;
  private readonly velocity: Record<K, number>;
  private frame = 0;
  private last = 0;

  constructor(
    initial: Record<K, number>,
    config: CardSpringConfig,
    private readonly onFrame: () => void,
  ) {
    this.value = { ...initial };
    this.target = { ...initial };
    this.velocity = { ...initial };
    for (const key in this.velocity) this.velocity[key] = 0;
    this.config = config;
  }

  /** Move toward `target` (animated) — or jump there when `instant`. */
  to(target: Partial<Record<K, number>>, instant = false): void {
    Object.assign(this.target, target);
    if (instant || typeof requestAnimationFrame !== 'function') {
      this.snap();
      return;
    }
    if (this.frame) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  /** Jump to the target and stop. */
  snap(): void {
    this.stop();
    for (const key in this.target) {
      this.value[key] = this.target[key];
      this.velocity[key] = 0;
    }
    this.onFrame();
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private readonly tick = (now: number): void => {
    /* Bounded step: no jump after a background tab */
    const dt = clamp((now - this.last) / 1000, 0, 1 / 30);
    this.last = now;
    const { stiffness, damping } = this.config;
    let moving = false;
    for (const key in this.target) {
      const offset = this.value[key] - this.target[key];
      const velocity = this.velocity[key] + (-stiffness * offset - damping * this.velocity[key]) * dt;
      const next = this.value[key] + velocity * dt;
      if (Math.abs(velocity) < EPSILON && Math.abs(next - this.target[key]) < EPSILON) {
        this.value[key] = this.target[key];
        this.velocity[key] = 0;
      } else {
        this.value[key] = next;
        this.velocity[key] = velocity;
        moving = true;
      }
    }
    this.onFrame();
    this.frame = moving ? requestAnimationFrame(this.tick) : 0;
  };
}

/** Pointer position over `el`, each axis 0…1 (clamped). */
export function pointerRatio(el: Element, event: PointerEvent): { x: number; y: number } | null {
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
    y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
  };
}

/** Screen rotation in degrees (0 · 90 · 180 · 270). */
function screenAngle(): number {
  const angle =
    (typeof screen !== 'undefined' ? screen.orientation?.angle : undefined) ??
    (window as { orientation?: number }).orientation ??
    0;
  return ((angle % 360) + 360) % 360;
}

/** Side (left/right) and front (forward/back) tilt in degrees, whatever the screen orientation. */
export function deviceTilt(event: DeviceOrientationEvent): { side: number; front: number } {
  const beta = event.beta ?? 0;
  const gamma = event.gamma ?? 0;
  switch (screenAngle()) {
    case 90:
      return { side: beta, front: -gamma };
    case 270:
      return { side: -beta, front: gamma };
    case 180:
      return { side: -gamma, front: -beta };
    default:
      return { side: gamma, front: beta };
  }
}

type OrientationConstructor = { requestPermission?: () => Promise<string> };

/**
 * Listen to device tilt. Call from a click / tap: iOS asks for permission then.
 * Resolves `true` once real data arrives, `false` when denied, unsupported, or
 * silent for 1.5 s (desktop, sensors blocked in a frame). Abort `signal` to stop.
 */
export async function watchDeviceTilt(
  onTilt: (tilt: { side: number; front: number }) => void,
  signal: AbortSignal,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const Orientation = (window as { DeviceOrientationEvent?: OrientationConstructor }).DeviceOrientationEvent;
  if (!Orientation) return false;
  if (typeof Orientation.requestPermission === 'function') {
    try {
      if ((await Orientation.requestPermission()) !== 'granted') return false;
    } catch {
      return false;
    }
  }
  if (signal.aborted) return false;
  return new Promise<boolean>((resolve) => {
    let live = false;
    const timeout = window.setTimeout(() => resolve(false), 1500);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeout);
      resolve(live);
    });
    window.addEventListener(
      'deviceorientation',
      (event) => {
        if (event.beta === null || event.gamma === null) return;
        if (!live) {
          live = true;
          window.clearTimeout(timeout);
          resolve(true);
        }
        onTilt(deviceTilt(event));
      },
      { signal },
    );
  });
}
