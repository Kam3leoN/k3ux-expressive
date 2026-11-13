/**
 * Interaction sound FX (click / hover / enter / leave) — no npm deps.
 * Inspired by K3ui v1 SoundFXManager; mute is independent of music player.
 */

export type SoundFxEvent = 'click' | 'hover' | 'enter' | 'leave';

export interface SoundFxOptions {
  /** Master enable for interaction SFX (not music). Default true unless muted in storage. */
  enabled: boolean;
  volume: number;
  /** Base URL ending with `/` for sound files (name + .mp3|.ogg). */
  soundsPath: string;
  formats: string[];
  clickEnabled: boolean;
  hoverEnabled: boolean;
  enterEnabled: boolean;
  leaveEnabled: boolean;
  /** Persist mute in localStorage. */
  persistMute: boolean;
}

const STORAGE_KEY = 'k3-sfx-muted';
const SAFE_SEGMENT = /^[a-zA-Z0-9_-]+$/;

const DEFAULTS: SoundFxOptions = {
  enabled: true,
  volume: 0.5,
  soundsPath: './assets/sounds/',
  formats: ['ogg', 'mp3', 'wav'],
  clickEnabled: true,
  hoverEnabled: true,
  enterEnabled: true,
  leaveEnabled: true,
  persistMute: true,
};

const ATTR: Record<SoundFxEvent, string> = {
  click: 'data-k3-sound-click',
  hover: 'data-k3-sound-hover',
  enter: 'data-k3-sound-enter',
  leave: 'data-k3-sound-leave',
};

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  aac: 'audio/aac',
};

function readMutedPreference(): boolean | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return null;
    return v === '1' || v === 'true';
  } catch {
    return null;
  }
}

function writeMutedPreference(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* private mode */
  }
}

function isSafeSoundName(name: string): boolean {
  if (!name || name.includes('..') || name.includes('\\') || name.includes(':')) {
    return false;
  }
  const segments = name.split('/').filter(Boolean);
  if (!segments.length || segments.length !== name.split('/').filter((s) => s.length > 0).length) {
    return false;
  }
  return segments.every((s) => SAFE_SEGMENT.test(s));
}

function isSafeFormat(format: string): boolean {
  return SAFE_SEGMENT.test(format);
}

type ListenerBundle = Map<string, EventListener>;

/**
 * Document-scoped interaction sound manager.
 */
export class SoundFxController {
  private options: SoundFxOptions;
  private active: HTMLAudioElement[] = [];
  private listeners = new WeakMap<HTMLElement, ListenerBundle>();
  private wired = new WeakSet<HTMLElement>();
  private root: ParentNode | null = null;
  private observer: MutationObserver | null = null;
  private unlocked = false;

  constructor(options: Partial<SoundFxOptions> = {}) {
    const mutedPref = options.persistMute === false ? null : readMutedPreference();
    this.options = {
      ...DEFAULTS,
      ...options,
      enabled:
        options.enabled ??
        (mutedPref === null ? DEFAULTS.enabled : !mutedPref),
    };
  }

  getOptions(): Readonly<SoundFxOptions> {
    return { ...this.options };
  }

  /** Mute/unmute interaction SFX (does not affect `k3-audio-player`). */
  setMuted(muted: boolean): void {
    this.options.enabled = !muted;
    if (this.options.persistMute) writeMutedPreference(muted);
    if (muted) this.stopAll();
  }

  isMuted(): boolean {
    return !this.options.enabled;
  }

  setVolume(volume: number): void {
    this.options.volume = Math.min(1, Math.max(0, volume));
  }

  setSoundsPath(path: string): void {
    this.options.soundsPath = path.endsWith('/') ? path : `${path}/`;
  }

  updateOptions(partial: Partial<SoundFxOptions>): void {
    this.options = { ...this.options, ...partial };
    if (partial.enabled === false) this.stopAll();
  }

  /**
   * Start observing `root` (default document) for sound attributes.
   * First user gesture unlocks autoplay for hover/enter.
   */
  attach(root: ParentNode = document): void {
    this.root = root;
    this.scan(root);
    if (typeof MutationObserver !== 'undefined') {
      this.observer?.disconnect();
      this.observer = new MutationObserver((records) => {
        for (const r of records) {
          r.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement) {
              this.wireElement(n);
              n.querySelectorAll?.('[data-k3-sound-click],[data-k3-sound-hover],[data-k3-sound-enter],[data-k3-sound-leave]').forEach(
                (el) => {
                  if (el instanceof HTMLElement) this.wireElement(el);
                },
              );
            }
          });
        }
      });
      this.observer.observe(root instanceof Document ? root.documentElement : (root as Node), {
        childList: true,
        subtree: true,
      });
    }
    const unlock = () => {
      this.unlocked = true;
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  detach(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.stopAll();
    this.root = null;
  }

  scan(root: ParentNode = this.root ?? document): void {
    root
      .querySelectorAll?.(
        '[data-k3-sound-click],[data-k3-sound-hover],[data-k3-sound-enter],[data-k3-sound-leave]',
      )
      .forEach((el) => {
        if (el instanceof HTMLElement) this.wireElement(el);
      });
  }

  wireElement(el: HTMLElement): void {
    if (this.wired.has(el)) return;
    const bundle: ListenerBundle = new Map();

    const bind = (event: SoundFxEvent, domEvent: string, attr: string) => {
      const name = el.getAttribute(attr);
      if (!name) return;
      const enabledKey =
        event === 'click'
          ? 'clickEnabled'
          : event === 'hover'
            ? 'hoverEnabled'
            : event === 'enter'
              ? 'enterEnabled'
              : 'leaveEnabled';
      const listener = () => {
        if (!this.options[enabledKey]) return;
        /* Hover/enter need a prior unlock (autoplay policy). */
        if ((event === 'hover' || event === 'enter') && !this.unlocked) return;
        this.play(name, event);
      };
      el.addEventListener(domEvent, listener);
      bundle.set(domEvent, listener);
    };

    bind('click', 'click', ATTR.click);
    bind('hover', 'mouseenter', ATTR.hover);
    bind('enter', 'focusin', ATTR.enter);
    bind('leave', 'mouseleave', ATTR.leave);
    /* Keyboard leave — separate map key so it does not replace mouseleave. */
    {
      const name = el.getAttribute(ATTR.leave);
      if (name && this.options.leaveEnabled) {
        const listener = () => this.play(name, 'leave');
        el.addEventListener('focusout', listener);
        bundle.set('focusout', listener);
      }
    }

    if (bundle.size) {
      this.listeners.set(el, bundle);
      this.wired.add(el);
    }
  }

  /** Play a named sound (stem without extension). */
  play(soundName: string, type: SoundFxEvent | 'custom' = 'custom'): void {
    if (!this.options.enabled) return;
    if (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches &&
      (type === 'hover' || type === 'enter' || type === 'leave')
    ) {
      return;
    }
    if (!isSafeSoundName(soundName)) return;

    const audio = document.createElement('audio');
    audio.preload = 'auto';
    audio.volume = this.options.volume;
    for (const format of this.options.formats) {
      if (!isSafeFormat(format)) continue;
      const src = this.buildPath(soundName, format);
      if (!src) continue;
      const source = document.createElement('source');
      source.src = src;
      source.type = MIME[format] ?? 'audio/mpeg';
      audio.appendChild(source);
    }
    if (!audio.querySelector('source')) return;

    const cleanup = () => {
      const i = this.active.indexOf(audio);
      if (i >= 0) this.active.splice(i, 1);
      audio.remove();
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    this.active.push(audio);
    try {
      const p = audio.play();
      if (p && typeof (p as Promise<void>).catch === 'function') {
        void (p as Promise<void>).catch(() => cleanup());
      }
    } catch {
      cleanup();
    }
    void type;
  }

  stopAll(): void {
    this.active.forEach((a) => {
      try {
        a.pause();
      } catch {
        /* jsdom */
      }
      a.remove();
    });
    this.active = [];
  }

  private buildPath(soundName: string, format: string): string {
    const base = this.options.soundsPath.endsWith('/')
      ? this.options.soundsPath
      : `${this.options.soundsPath}/`;
    return `${base}${soundName}.${format}`;
  }
}

let singleton: SoundFxController | null = null;

/** Shared interaction SFX controller. */
export function getSoundFx(options?: Partial<SoundFxOptions>): SoundFxController {
  if (!singleton) singleton = new SoundFxController(options);
  else if (options) singleton.updateOptions(options);
  return singleton;
}

export function resetSoundFxForTests(): void {
  singleton?.detach();
  singleton = null;
}
