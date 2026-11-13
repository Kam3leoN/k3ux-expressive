/**
 * k3-audio-player — Material 3 Expressive media player (K3ui).
 *
 * Fichier unique et autonome : remplace `audio-player.ts`, `audio-player.styles.ts`
 * et `audio-player.specs.ts` (supprimer les deux derniers).
 *
 * Variantes (`variant`) :
 *   - `card`    (défaut) carte compacte : pochette morphée · méta · seek ondulé · transport
 *   - extras unifiés : k3-button-group connected (repeat · shuffle · like · playlist · paroles · volume)
 *   - `toolbar` barre horizontale : pochette · méta · transport · seek · volume
 *   - `sticky`  même barre, fixée en bas dans l’espace contenu (pas sur le nav-rail)
 *   - `phone`   gabarit vertical smartphone ; paroles / file en bottom sheet
 *   - `full`    grand lecteur deux colonnes (file d'attente + paroles)
 * `expandable` + `expanded` : sheet dialog depuis **card** uniquement (pas toolbar).
 * `dock-toggle` : 2ᵉ clic sur sticky → toolbar (démo playground uniquement).
 * Sticky respecte `--k3-shell-rail-inline-size` (rail) et
 * `--k3-floating-chrome-inset-inline-{start,end}` (FAB / extended / fab-menu / STT,
 * les deux coins bas · LTR/RTL). Morph inset = spatial-fast (élastique en expressif).
 *
 * Réutilise K3ui : k3-icon-button · k3-button · k3-slider ·
 * k3-list / k3-list-item · k3-button-segmented · k3-loading-indicator ·
 * shapes (morph Material) · progress-draw (onde) · slider-tokens · thème MCU ·
 * snackbar · edge scrollbar · focus ring · state layer · i18n.
 *
 * Nouveau : `k3-audio-seek` — onde M3 ou oscillation PCM réelle (`seek-style="oscillation"`).
 * Opt-in full / sheet : `skip-back` · `skip-forward` · `show-share` · `show-download`.
 *
 * @fires k3-play · k3-pause · k3-stop · k3-change · k3-ended · k3-like · k3-expand · k3-share · k3-download
 */
import { css, html, nothing, svg, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import {
  K3Element,
  LayerPortal,
  attachDrag,
  attachOutsideDismiss,
  clearAxisTranslate,
  edgeScrollbarStyles,
  focusRingStyles,
  observeFloatingChromeInset,
  prefersReducedMotion,
  shouldDismissDrag,
  stateLayerStyles,
  i18n,
  type FloatingChromeInsetObserver,
  COLOR_ROLES,
  sysColorCssVars,
  MATERIAL_SHAPE_SVG,
  animateMaterialShapeMorph,
  GAP_DP,
  LINEAR_WAVE_AMP,
  LINEAR_WAVE_LEN,
  STOP_DP,
  drawFlatBar,
  drawOscillationBars,
  drawStop,
  drawWavyBar,
  indicatorAmplitudeFactor,
  loadWaveformPeaks,
  oscillationBarCount,
  resamplePeaks,
  SLIDER_HANDLE_GAP,
  SLIDER_HANDLE_GAP_PRESSED,
  SLIDER_HANDLE_WIDTH_PRESSED,
  showSnackbar,
  attachTextMarquee,
  springs,
  registry,
  type DragController,
  type OutsideDismissController,
  type MaterialShapeName,
  type TextMarqueeHandle,
} from 'k3ui';
import { hostReset } from '../_shared.js';
import { volumeToolbarStyles } from './volume-toolbar.styles.js';

/* Child CEs live in peer `k3ui` — register if the host app has not yet. */
const AUDIO_PLAYER_DEPS = [
  'k3-icon-button',
  'k3-button',
  'k3-button-group',
  'k3-button-segmented',
  'k3-slider',
  'k3-card',
  'k3-list',
  'k3-list-item',
  'k3-loading-indicator',
  'k3-tooltip',
] as const;

let audioPlayerDepsReady: Promise<void> | null = null;

/** Register peer k3ui child CEs once (lazy — avoids Vitest teardown races). */
export function ensureAudioPlayerDeps(): Promise<void> {
  audioPlayerDepsReady ??= registry
    .registerAll([...AUDIO_PLAYER_DEPS])
    .then(() => undefined)
    .catch(() => undefined);
  return audioPlayerDepsReady ?? Promise.resolve();
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Specs
 * ═════════════════════════════════════════════════════════════════════════ */

export const AudioPlayerSpecs = {
  storageKey: 'k3-music-muted',
  defaultVolume: 0.7,
  formats: ['ogg', 'mp3'] as const,
  variants: ['card', 'compact', 'toolbar', 'sticky', 'phone', 'full'] as const,
  repeatModes: ['off', 'all', 'one'] as const,
  speeds: [0.75, 1, 1.25, 1.5, 2] as const,
  /** Cycle de formes de pochette (catalogue Material Shapes). */
  coverShapes: [
    'Cookie9Sided',
    'Sunny',
    'Clover4Leaf',
    'SoftBurst',
    'Flower',
    'Cookie12Sided',
    'Puffy',
    'VerySunny',
    'Clover8Leaf',
    'Cookie6Sided',
    'Pill',
    'Gem',
  ] as const satisfies readonly MaterialShapeName[],
  miniShape: 'Cookie12Sided' as MaterialShapeName,
  /** Container queries (dp). */
  breakpoints: { cardUtility: 480, barTime: 680, barVolume: 960, fullTwoPane: 860 },
  accessibility: { role: 'region' as const },
  /** Ligatures Material Symbols à ajouter au subset `icon_names=` du playground. */
  icons: [
    'close',
    'download',
    'favorite',
    'keyboard_arrow_down',
    'lyrics',
    'music_note',
    'open_in_full',
    'pause',
    'play_arrow',
    'queue_music',
    'repeat',
    'repeat_one',
    'share',
    'shuffle',
    'skip_next',
    'skip_previous',
    'stop',
    'volume_down',
    'volume_off',
    'volume_up',
  ] as const,
  /** Valeurs typiques pour `skip-back` / `skip-forward` (secondes). */
  skipSeconds: [15, 30] as const,
  seekStyles: ['wave', 'oscillation'] as const,
};

export type AudioPlayerVariant = (typeof AudioPlayerSpecs.variants)[number];
/** Legacy aliases still accepted on the `variant` attribute. */
export type AudioPlayerVariantAlias =
  | AudioPlayerVariant
  | 'smartphone'
  | 'overlay';
export type AudioPlayerView = 'expanded' | 'collapsed';
export type AudioRepeatMode = (typeof AudioPlayerSpecs.repeatModes)[number];
export type AudioSeekStyle = (typeof AudioPlayerSpecs.seekStyles)[number];
type PanelTab = 'queue' | 'lyrics';

/** Map legacy `smartphone`/`overlay` → `phone`/`sticky`. */
export function resolveAudioPlayerVariant(
  raw: string | null | undefined,
): AudioPlayerVariant {
  if (raw === 'smartphone') return 'phone';
  if (raw === 'overlay') return 'sticky';
  if (
    raw === 'card' ||
    raw === 'compact' ||
    raw === 'toolbar' ||
    raw === 'sticky' ||
    raw === 'phone' ||
    raw === 'full'
  ) {
    return raw;
  }
  return 'card';
}

export interface AudioTrack {
  src: string;
  title?: string;
  artist?: string;
  album?: string;
  /** Pochette (URL, data: ou blob:). */
  artwork?: string;
  /** Source alternative (ex. ogg à côté du mp3). */
  srcAlt?: string;
  type?: string;
  typeAlt?: string;
  /** Durée connue (s) — affichée dans la file avant chargement. */
  duration?: number;
  /** Couleur source du thème dynamique. Sinon extraite de la pochette (MCU). */
  seed?: string;
  /** Forme de la pochette (catalogue Material Shapes). */
  shape?: MaterialShapeName;
  /** Paroles synchronisées au format LRC : `[mm:ss.xx] ligne`. */
  lyrics?: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Helpers
 * ═════════════════════════════════════════════════════════════════════════ */

/** i18n : catalogue K3ui si la clé existe, sinon libellé EN / FR intégré. */
function tr(key: string, en: string, fr: string, vars?: Record<string, string | number>): string {
  return i18n.t(`audioPlayer.${key}`, i18n.locale === 'fr' ? fr : en, vars);
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function guessType(src: string): string {
  const lower = src.toLowerCase().split('?')[0] ?? '';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.aac') || lower.endsWith('.m4a')) return 'audio/aac';
  if (lower.endsWith('.flac')) return 'audio/flac';
  return 'audio/mpeg';
}

function readMusicMuted(): boolean {
  try {
    const v = localStorage.getItem(AudioPlayerSpecs.storageKey);
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

function writeMusicMuted(muted: boolean): void {
  try {
    localStorage.setItem(AudioPlayerSpecs.storageKey, muted ? '1' : '0');
  } catch {
    /* navigation privée */
  }
}

interface LyricLine {
  time: number;
  text: string;
}

function parseLrc(src?: string): LyricLine[] {
  if (!src) return [];
  const out: LyricLine[] = [];
  const re = /\[(\d{1,2}):(\d{2}(?:\.\d{1,3})?)\]/g;
  for (const raw of src.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(re)];
    if (!stamps.length) continue;
    const text = raw.replace(re, '').trim();
    for (const s of stamps) out.push({ time: Number(s[1]) * 60 + Number(s[2]), text });
  }
  return out.sort((a, b) => a.time - b.time);
}

function activeLyric(lines: LyricLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.time <= t + 0.05) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** MCU is heavy — load on demand (dynamic color / artwork seed only). */
type McuModule = typeof import('./audio-player.mcu.js');
let mcuMod: Promise<McuModule> | null = null;
function loadMcu(): Promise<McuModule> {
  return (mcuMod ??= import('./audio-player.mcu.js'));
}

/** Scheme MCU local (même recette que `theme.apply`, sans toucher au thème global). */
async function scopedSchemeVars(
  seed: string,
  dark: boolean,
  variant: string,
  contrast: string,
): Promise<Record<string, string>> {
  const {
    argbFromHex,
    hexFromArgb,
    Hct,
    MaterialDynamicColors,
    SchemeExpressive,
    SchemeFidelity,
    SchemeTonalSpot,
    SchemeVibrant,
  } = await loadMcu();
  const source = Hct.fromInt(argbFromHex(seed));
  const c = contrast === 'high' ? 1 : contrast === 'medium' ? 0.5 : 0;
  const scheme =
    variant === 'tonalspot'
      ? new SchemeTonalSpot(source, dark, c)
      : variant === 'vibrant'
        ? new SchemeVibrant(source, dark, c)
        : variant === 'fidelity'
          ? new SchemeFidelity(source, dark, c)
          : new SchemeExpressive(source, dark, c);
  const colors = MaterialDynamicColors as unknown as Record<
    string,
    { getArgb: (s: typeof scheme) => number } | undefined
  >;
  const vars: Record<string, string> = {};
  for (const key of COLOR_ROLES) {
    const dc = colors[key];
    if (dc) Object.assign(vars, sysColorCssVars(key, hexFromArgb(dc.getArgb(scheme))));
  }
  return vars;
}

function isDarkContext(): boolean {
  const mode = document.documentElement.dataset.k3ColorMode;
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

const seedCache = new Map<string, Promise<string | null>>();

/** Couleur source extraite de la pochette (MCU quantizer + score). `null` si CORS / erreur. */
function seedFromArtwork(url: string): Promise<string | null> {
  let hit = seedCache.get(url);
  if (!hit) {
    hit = (async () => {
      const { sourceColorFromImage, hexFromArgb } = await loadMcu();
      return new Promise<string | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.decoding = 'async';
        img.onload = () => {
          sourceColorFromImage(img)
            .then((argb: number) => resolve(hexFromArgb(argb)))
            .catch(() => resolve(null));
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    })();
    seedCache.set(url, hit);
  }
  return hit;
}

type IdleHandle = { kind: 'idle' | 'timeout'; id: number };

function scheduleIdle(fn: () => void): IdleHandle {
  if (typeof requestIdleCallback === 'function') {
    const id = requestIdleCallback(() => fn(), { timeout: 1200 });
    return { kind: 'idle', id };
  }
  const id = window.setTimeout(fn, 0);
  return { kind: 'timeout', id };
}

function cancelIdle(h: IdleHandle | undefined): void {
  if (!h) return;
  if (h.kind === 'idle' && typeof cancelIdleCallback === 'function') cancelIdleCallback(h.id);
  else clearTimeout(h.id);
}

const icon = (name: string, slot?: string, cls = '') => html`<span
  class="ms notranslate ${cls}"
  translate="no"
  lang="zxx"
  slot=${slot ?? nothing}
  data-k3-icon=${name}
  aria-hidden="true"
></span>`;

/**
 * Skip ±N s — Material n’a pas `replay_15` / `forward_15` (seulement 5/10/30).
 * SVG calqué sur les glyphes replay/forward pour supporter 15 et 30.
 */
const skipSecIcon = (sec: number, dir: 'back' | 'forward') => {
  const label = String(Math.round(sec));
  const arrow =
    dir === 'back'
      ? svg`<path
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            d="M7.2 8.1A6.15 6.15 0 1 0 12 5.85"
          />
          <path fill="currentColor" d="M7.05 4.35 4.9 7.55l4.55.35z" />`
      : svg`<path
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            d="M16.8 8.1A6.15 6.15 0 1 1 12 5.85"
          />
          <path fill="currentColor" d="M16.95 4.35 19.1 7.55l-4.55.35z" />`;
  return svg`<svg
      class="skip-sec-icon"
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      aria-hidden="true"
    >
      ${arrow}
      <text
        x="12"
        y="15.2"
        text-anchor="middle"
        fill="currentColor"
        font-size="${label.length > 2 ? 7.5 : 8.5}"
        font-weight="600"
        font-family="system-ui, sans-serif"
      >
        ${label}
      </text>
    </svg>`;
};

let UID = 0;

/* ═══════════════════════════════════════════════════════════════════════════
 * k3-audio-seek — slider de position ondulé (M3 Expressive)
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Slider de lecture : `mode="wave"` (onde M3) ou `mode="oscillation"` (waveform
 * PCM réelle via `src` + Web Audio). Clavier : flèches ±`step` s · PageUp/Down ±10 % · Home/End.
 *
 * @fires k3-input — `{ value }` pendant le drag
 * @fires k3-change — `{ value }` au relâchement / clavier
 */
export class K3AudioSeek extends K3Element {
  static override styles = [
    hostReset,
    css`
      :host {
        display: block;
        inline-size: 100%;
        min-inline-size: 0;
        --k3-seek-active: var(--k3-sys-color-primary);
        --k3-seek-track: var(--k3-sys-color-secondary-container);
      }
      .track {
        position: relative;
        inline-size: 100%;
        block-size: var(--_h);
        touch-action: none;
        cursor: pointer;
        outline: none;
      }
      canvas {
        position: absolute;
        inset: 0;
        inline-size: 100%;
        block-size: 100%;
        display: block;
      }
      .handle {
        position: absolute;
        inset-block-start: 50%;
        inset-inline-start: 0;
        inline-size: var(--_hw, 4px);
        block-size: var(--_hh);
        border-radius: var(--k3-sys-shape-corner-full, 999px);
        background: var(--k3-seek-active);
        transform: translate(calc(var(--_x) - 50%), -50%);
        transition: inline-size var(--k3-sys-motion-duration-spatial-fast, 350ms)
          var(--k3-sys-motion-easing-spatial-fast, ease);
        pointer-events: none;
      }
      :host([mode='oscillation']) .handle {
        display: none;
      }
      .track:focus-visible {
        outline: 3px solid var(--k3-sys-color-secondary);
        outline-offset: 3px;
        border-radius: var(--k3-sys-shape-corner-extra-small, 4px);
      }
      .track:focus-visible .handle {
        outline: 3px solid var(--k3-sys-color-secondary);
        outline-offset: 3px;
      }
      :host([dragging]) .handle {
        --_hw: ${SLIDER_HANDLE_WIDTH_PRESSED}px;
      }
      @media (forced-colors: active) {
        .handle {
          background: CanvasText;
        }
      }
    `,
  ];

  @property({ type: Number }) value = 0;
  @property({ type: Number }) max = 1;
  /** Onde animée (lecture en cours) — wave mode only. */
  @property({ type: Boolean, reflect: true }) playing = false;
  /** `wave` (défaut) · `oscillation` (barres PCM). */
  @property({ reflect: true }) mode: AudioSeekStyle = 'wave';
  /** Audio URL to decode for oscillation peaks (same-origin / CORS). */
  @property() src = '';
  /** Épaisseur de piste (dp) : 4 · 6 · 8. */
  @property({ type: Number }) thickness = 6;
  /** Hauteur de poignée (dp). */
  @property({ type: Number }) handle = 28;
  /** Pas clavier (s). */
  @property({ type: Number }) step = 5;
  @property() label = '';
  @property({ attribute: 'value-text' }) valueText = '';
  @property({ type: Boolean, reflect: true }) dragging = false;

  @query('canvas') private canvas!: HTMLCanvasElement;
  @query('.track') private trackEl!: HTMLElement;

  private dragValue = 0;
  private amp = 0;
  private phase = 0;
  private raf = 0;
  private last = 0;
  private width = 0;
  /** High-res PCM peaks (normalized); empty until decode completes. */
  private pcmPeaks: Float32Array = new Float32Array(0);
  /** Display-resampled peaks for current width. */
  private peaks: Float32Array = new Float32Array(0);
  private peaksKey = '';
  private waveAbort: AbortController | null = null;
  private waveToken = 0;
  private ro?: ResizeObserver;

  private get isOscillation(): boolean {
    return this.mode === 'oscillation';
  }

  private get height(): number {
    if (this.isOscillation) return Math.max(36, this.handle + 8);
    return Math.max(this.handle, LINEAR_WAVE_AMP * 2 + this.thickness + 4);
  }

  private get shown(): number {
    return this.dragging ? this.dragValue : this.value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(this);
    }
  }

  override disconnectedCallback(): void {
    this.ro?.disconnect();
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.waveAbort?.abort();
    this.waveAbort = null;
    super.disconnectedCallback();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('playing')) this.wake();
    if (
      (changed.has('mode') || changed.has('src')) &&
      this.isOscillation &&
      this.src
    ) {
      void this.loadPcmWaveform();
    }
    if (changed.has('mode') && !this.isOscillation) {
      this.waveAbort?.abort();
      this.pcmPeaks = new Float32Array(0);
      this.peaks = new Float32Array(0);
      this.peaksKey = '';
    }
    this.paint();
  }

  /** Redessine (après changement de thème / palette). */
  repaint(): void {
    this.paint();
  }

  private measure(): void {
    this.width = this.trackEl?.clientWidth ?? 0;
    this.paint();
  }

  private wake(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const target = this.playing ? LINEAR_WAVE_AMP : 0;
    this.amp += (target - this.amp) * Math.min(1, dt * 8);
    const reduce = prefersReducedMotion();
    if (this.amp > 0.05 && !reduce) this.phase += dt * ((2 * Math.PI) / 1.2);
    this.paint();
    const settling = Math.abs(target - this.amp) > 0.02;
    if ((this.playing && !reduce) || settling) this.raf = requestAnimationFrame(this.frame);
    else this.raf = 0;
  };

  private cssColor(prop: string, fallback: string): string {
    return getComputedStyle(this).getPropertyValue(prop).trim() || fallback;
  }

  /** Fetch + decode PCM for the current `src` (oscillation only). */
  private async loadPcmWaveform(): Promise<void> {
    const url = this.src.trim();
    if (!this.isOscillation || !url) return;

    this.waveAbort?.abort();
    const ac = new AbortController();
    this.waveAbort = ac;
    const token = ++this.waveToken;
    this.pcmPeaks = new Float32Array(0);
    this.peaks = new Float32Array(0);
    this.peaksKey = '';
    this.paint();

    try {
      const peaks = await loadWaveformPeaks(url, { signal: ac.signal });
      if (token !== this.waveToken || ac.signal.aborted) return;
      this.pcmPeaks = peaks;
      this.peaksKey = '';
      this.paint();
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      /* Keep empty peaks — no fake waveform. */
      if (token === this.waveToken) {
        this.pcmPeaks = new Float32Array(0);
        this.paint();
      }
    }
  }

  private ensureDisplayPeaks(width: number): void {
    const n = oscillationBarCount(width);
    const key = `${this.src}|${this.pcmPeaks.length}|${n}`;
    if (key === this.peaksKey && this.peaks.length === n) return;
    this.peaksKey = key;
    if (!this.pcmPeaks.length) {
      /* Loading / error placeholder — flat low bars, not a fake song shape. */
      this.peaks = new Float32Array(n).fill(0.08);
      return;
    }
    this.peaks = resamplePeaks(this.pcmPeaks, n);
  }

  private paint(): void {
    const canvas = this.canvas;
    const W = this.width || this.trackEl?.clientWidth || 0;
    if (!canvas || !W) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;
    const H = this.height;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const frac = this.max > 0 ? Math.min(1, Math.max(0, this.shown / this.max)) : 0;
    const rtl = getComputedStyle(this).direction === 'rtl';
    const active = this.cssColor('--k3-seek-active', '#6750a4');
    const track = this.cssColor('--k3-seek-track', '#e8def8');

    if (this.isOscillation) {
      this.ensureDisplayPeaks(W);
      const hx = frac * W;
      this.style.setProperty('--_x', `${rtl ? W - hx : hx}px`);
      drawOscillationBars(ctx, W, H, frac, this.peaks, active, track, rtl);
      return;
    }

    const th = this.thickness;
    const cy = H / 2;
    const hw = this.dragging ? SLIDER_HANDLE_WIDTH_PRESSED : 4;
    const gap = this.dragging ? SLIDER_HANDLE_GAP_PRESSED : Math.max(SLIDER_HANDLE_GAP, GAP_DP);
    const hx = hw / 2 + frac * (W - hw);
    this.style.setProperty('--_x', `${rtl ? W - hx : hx}px`);
    const map = (x: number) => (rtl ? W - x : x);

    const a0 = th / 2;
    const a1 = hx - hw / 2 - gap - th / 2;
    if (a1 > a0) {
      const amp = this.amp * indicatorAmplitudeFactor(Math.max(0.2, Math.min(0.85, frac)));
      if (rtl) drawFlatBar(ctx, map(a1), map(a0), cy, th, active);
      else drawWavyBar(ctx, a0, a1, cy, th, amp, LINEAR_WAVE_LEN, -this.phase, active);
    }
    const i0 = hx + hw / 2 + gap + th / 2;
    const i1 = W - th / 2;
    if (i1 > i0) drawFlatBar(ctx, Math.min(map(i0), map(i1)), Math.max(map(i0), map(i1)), cy, th, track);
    if (i1 - i0 > STOP_DP * 2) drawStop(ctx, map(W - th / 2), cy, Math.min(STOP_DP, th), active);
  }

  private fromPointer(clientX: number): number {
    const r = this.trackEl.getBoundingClientRect();
    let f = (clientX - r.left - 2) / Math.max(1, r.width - 4);
    if (getComputedStyle(this).direction === 'rtl') f = 1 - f;
    return Math.min(1, Math.max(0, f)) * this.max;
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    this.trackEl.setPointerCapture(e.pointerId);
    this.dragging = true;
    this.dragValue = this.fromPointer(e.clientX);
    this.emit('k3-input', { value: this.dragValue });
    this.paint();
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragValue = this.fromPointer(e.clientX);
    this.emit('k3-input', { value: this.dragValue });
    this.paint();
  };

  private onUp = (): void => {
    if (!this.dragging) return;
    this.value = this.dragValue;
    this.dragging = false;
    this.emit('k3-change', { value: this.value });
  };

  private onKey = (e: KeyboardEvent): void => {
    let v = this.value;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        v -= this.step;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        v += this.step;
        break;
      case 'PageDown':
        v -= this.max * 0.1;
        break;
      case 'PageUp':
        v += this.max * 0.1;
        break;
      case 'Home':
        v = 0;
        break;
      case 'End':
        v = this.max;
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    this.value = Math.min(this.max, Math.max(0, v));
    this.emit('k3-input', { value: this.value });
    this.emit('k3-change', { value: this.value });
  };

  override render() {
    return html`<div
      class="track"
      part="track"
      role="slider"
      tabindex="0"
      aria-label=${this.label || nothing}
      aria-valuemin="0"
      aria-valuemax=${String(Math.round(this.max))}
      aria-valuenow=${String(Math.round(this.shown))}
      aria-valuetext=${this.valueText || nothing}
      style=${styleMap({ '--_h': `${this.height}px`, '--_hh': `${this.handle}px` })}
      @pointerdown=${this.onDown}
      @pointermove=${this.onMove}
      @pointerup=${this.onUp}
      @pointercancel=${this.onUp}
      @keydown=${this.onKey}
    >
      <canvas aria-hidden="true"></canvas>
      <span class="handle" part="handle"></span>
    </div>`;
  }
}

if (!customElements.get('k3-audio-seek')) customElements.define('k3-audio-seek', K3AudioSeek);

/* ═══════════════════════════════════════════════════════════════════════════
 * Styles du lecteur
 * ═════════════════════════════════════════════════════════════════════════ */

const playerStyles = css`
  :host {
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 30rem;
    color: var(--k3-sys-color-on-surface);
    font-family: var(--k3-ref-typeface-plain);
    --_spatial: var(--k3-sys-motion-duration-spatial-default, 500ms)
      var(--k3-sys-motion-easing-spatial, cubic-bezier(0.38, 1.21, 0.22, 1));
    --_spatial-fast: var(--k3-sys-motion-duration-spatial-fast, 350ms)
      var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9));
    --_effects: var(--k3-sys-motion-duration-effects-default, 200ms)
      var(--k3-sys-motion-easing-effects, cubic-bezier(0.2, 0, 0, 1));
    --_color-swap: var(--k3-sys-motion-duration-extra-long1, 700ms)
      var(--k3-sys-motion-easing-effects, ease);
  }
  :host([hidden]) {
    display: none !important;
  }
  :host([variant='compact']) {
    max-inline-size: 22rem;
  }
  :host([variant='toolbar']),
  :host([variant='sticky']),
  :host([variant='full']) {
    max-inline-size: none;
  }
  /* Tooltips + upward playlist must paint outside the bar bounds */
  :host([variant='toolbar']),
  :host([variant='sticky']) {
    overflow: visible;
  }
  :host([variant='phone']) {
    max-inline-size: 26rem;
    inline-size: 100%;
    block-size: auto;
    min-block-size: 42rem;
    margin-inline: auto;
  }
  /*
   * Sticky — content band only:
   * start = rail + bottom-start FAB/STT · end = bottom-end FAB/STT.
   * Inset morph uses spatial-fast (elastic when data-k3-motion=expressive).
   */
  :host([variant='sticky']) {
    position: fixed;
    inset-inline-start: calc(
      var(--k3-shell-rail-inline-size, 0px) + var(--k3-floating-chrome-inset-inline-start, 0px) +
        var(--k3-sys-spacing-space200, 1rem)
    );
    inset-inline-end: calc(
      var(--k3-floating-chrome-inset-inline-end, 0px) + var(--k3-sys-spacing-space200, 1rem)
    );
    inset-block-end: calc(var(--k3-nav-chrome-inset-block-end, 0px) + var(--k3-sys-spacing-space200, 1rem));
    inline-size: auto;
    z-index: 40;
    margin: 0;
    transition:
      inset-inline-start var(--k3-sys-motion-duration-spatial-fast, 350ms)
        var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)),
      inset-inline-end var(--k3-sys-motion-duration-spatial-fast, 350ms)
        var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)),
      inset-block-end var(--k3-sys-motion-duration-spatial-fast, 350ms)
        var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)),
      opacity var(--_effects),
      visibility var(--_effects);
  }

  /* Playground / framed demos — keep sticky inside the stage */
  :host([staged][variant='sticky']),
  :host([staged][variant='overlay']) {
    display: block;
    position: relative;
    inline-size: 100%;
    inset: auto;
    z-index: 0;
    min-block-size: 5.5rem;
  }

  audio {
    display: none;
  }

  .ms {
    font-family: var(--k3-sys-icon-font-family, 'Material Symbols Rounded', 'Material Symbols Outlined', sans-serif);
    font-weight: var(--k3-sys-icon-weight, 400);
    font-style: normal;
    font-size: var(--k3-sys-icon-size-medium, 1.5rem);
    line-height: 1;
    letter-spacing: normal;
    white-space: nowrap;
    direction: ltr;
    font-feature-settings: 'liga';
    -webkit-font-smoothing: antialiased;
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
  .ms.fill {
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }

  /* ── Typo — AOSP marquee (button-smart) instead of ellipsis ───────────── */
  .title,
  .artist {
    margin: 0;
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow: hidden;
  }
  .title {
    font-family: var(--k3-ref-typeface-brand, var(--k3-ref-typeface-plain));
    font-size: var(--k3-sys-typescale-title-medium-size);
    line-height: var(--k3-sys-typescale-title-medium-line-height);
    font-weight: var(--k3-sys-typescale-title-medium-emphasized-weight, 600);
    letter-spacing: var(--k3-sys-typescale-title-medium-tracking);
  }
  .artist {
    font-size: var(--k3-sys-typescale-body-medium-size);
    line-height: var(--k3-sys-typescale-body-medium-line-height);
    color: var(--k3-sys-color-on-surface-variant);
  }
  .meta-marquee {
    display: block;
    overflow: hidden;
    white-space: nowrap;
    min-inline-size: 0;
    max-inline-size: 100%;
    --k3-ap-meta-fade: 0.875rem;
  }
  .meta-marquee.scrolling {
    -webkit-mask-image: linear-gradient(
      to right,
      #000 0,
      #000 calc(100% - var(--k3-ap-meta-fade)),
      transparent 100%
    );
    mask-image: linear-gradient(
      to right,
      #000 0,
      #000 calc(100% - var(--k3-ap-meta-fade)),
      transparent 100%
    );
  }
  :host([dir='rtl']) .meta-marquee.scrolling,
  .meta-marquee.scrolling:dir(rtl) {
    -webkit-mask-image: linear-gradient(
      to left,
      #000 0,
      #000 calc(100% - var(--k3-ap-meta-fade)),
      transparent 100%
    );
    mask-image: linear-gradient(
      to left,
      #000 0,
      #000 calc(100% - var(--k3-ap-meta-fade)),
      transparent 100%
    );
  }
  .meta-track {
    display: inline-flex;
    align-items: center;
    flex-wrap: nowrap;
    max-width: none;
    gap: var(--k3-text-marquee-gap, 0px);
    will-change: transform;
  }
  .meta-label {
    flex: 0 0 auto;
    max-width: none;
    white-space: nowrap;
  }
  .meta-label.ghost {
    display: none;
  }
  .meta-marquee.scrolling .meta-label.ghost {
    display: block;
  }
  @media (prefers-reduced-motion: reduce) {
    .meta-marquee:not(.scrolling) .meta-label {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  .times {
    display: flex;
    justify-content: space-between;
    gap: var(--k3-sys-spacing-space100);
    font-size: var(--k3-sys-typescale-label-medium-size);
    line-height: var(--k3-sys-typescale-label-medium-line-height);
    font-weight: var(--k3-sys-typescale-label-medium-weight);
    color: var(--k3-sys-color-on-surface-variant);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .meta {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    flex: 1;
  }

  /* ── Pochette morphée ─────────────────────────────────────────────────── */
  .cover {
    position: relative;
    display: block;
    flex: none;
    aspect-ratio: 1;
    max-inline-size: 100%;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 0;
    color: var(--k3-sys-color-on-primary-container);
    cursor: pointer;
    overflow: visible;
    filter: drop-shadow(0 0.75rem 1.5rem color-mix(in srgb, var(--k3-sys-color-shadow, #000) 28%, transparent));
  }
  .cover svg {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    display: block;
    overflow: hidden;
  }
  .cover .fill-rect {
    fill: var(--k3-sys-color-primary-container);
    transition: fill var(--_color-swap);
  }
  .cover .fallback {
    position: absolute;
    inset: 18%;
    display: grid;
    place-items: center;
    pointer-events: none;
    /* Keep glyph inside morph — not floating above title */
    clip-path: circle(48% at 50% 50%);
  }
  .cover .fallback .ms {
    font-size: clamp(2rem, 28%, 4.5rem);
    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 48;
    color: var(--k3-sys-color-on-primary-container);
  }
  .cover-glow {
    position: absolute;
    inset: 18%;
    z-index: -1;
    border-radius: 50%;
    background: var(--k3-sys-color-primary);
    filter: blur(2.25rem);
    opacity: 0.28;
    transform: translateY(8%);
    transition: background-color var(--_color-swap);
    pointer-events: none;
  }
  .cover--mini {
    inline-size: 3.5rem;
    cursor: inherit;
  }
  .cover--mini svg {
    animation: k3-ap-spin 16s linear infinite paused;
  }
  :host([playing]) .cover--mini svg {
    animation-play-state: running;
  }
  @keyframes k3-ap-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Transport ───────────────────────────────────────────────────────── */
  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--k3-sys-spacing-space100);
    position: relative;
    z-index: 1;
  }
  .transport {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-inline: auto;
  }
  /* k3-button-group owns gap; keep host centered in card/phone/full */
  k3-button-group.transport {
    width: auto;
    max-width: 100%;
  }
  .transport .skip-sec-icon {
    display: block;
    inline-size: 1.35em;
    block-size: 1.35em;
  }
  .play k3-loading-indicator {
    --k3-loading-size: 100%;
  }
  .utility {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--k3-sys-spacing-space100);
    inline-size: 100%;
    flex-shrink: 0;
    /* Above transport so volume bubble / tips clear the play button */
    position: relative;
    z-index: 2;
  }
  /* Temporary elevate while a floating VI / tooltip / volume toolbar is active */
  .utility:has(k3-slider[data-vi-active]),
  .utility:has(k3-tooltip[data-open]),
  .utility[data-vol-open],
  .bar-controls:has(k3-tooltip[data-open]),
  .bar-extras:has(k3-tooltip[data-open]),
  .bar-extras[data-vol-open],
  .extras-row[data-vol-open],
  .transport:has(k3-tooltip[data-open]),
  .controls:has(k3-tooltip[data-open]),
  .card-head:has(k3-tooltip[data-open]),
  .topbar:has(k3-tooltip[data-open]),
  .seek-block:has(k3-slider[data-vi-active]) {
    z-index: 24;
  }
  /* Libellé conservé pour l'accessibilité (aria-label), masqué visuellement. */
  k3-slider::part(label) {
    display: none;
  }
  .utility k3-slider {
    flex: 1;
    min-inline-size: 0;
  }
  .speed {
    font-variant-numeric: tabular-nums;
  }

  /* ── Variante CARD / COMPACT ─────────────────────────────────────────── */
  .card {
    display: block;
    inline-size: 100%;
    container: k3-ap-card / inline-size;
    overflow: visible;
  }
  .card::part(body) {
    padding: var(--k3-sys-spacing-space200);
    gap: 0;
  }
  .card-body {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    align-items: center;
    gap: var(--k3-sys-spacing-space150) var(--k3-sys-spacing-space200);
  }
  .card-body > .seek-block,
  .card-body > .controls,
  .card-body > .utility,
  .card-body > .extras-row {
    grid-column: 1 / -1;
  }
  .card-body .cover {
    inline-size: 5.5rem;
  }
  .card-head {
    display: flex;
    align-items: flex-start;
    gap: var(--k3-sys-spacing-space50);
    min-inline-size: 0;
  }
  .card-head .meta {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  .card-head k3-icon-button {
    flex: none;
    margin-block-start: 0.1rem;
  }
  .card-body .title {
    font-size: var(--k3-sys-typescale-title-large-size);
    line-height: var(--k3-sys-typescale-title-large-line-height);
  }
  /* Legacy wide card still shows inline utility (speed) when room */
  .card-body .utility {
    display: none;
  }
  @container k3-ap-card (min-width: 480px) {
    .card-body {
      grid-template-columns: 7rem minmax(0, 1fr);
    }
    .card-body .cover {
      inline-size: 7rem;
    }
    .card-body .utility {
      display: flex;
    }
  }
  :host([variant='compact']) .card-body {
    grid-template-columns: 4rem minmax(0, 1fr);
  }
  :host([variant='compact']) .card-body .cover {
    inline-size: 4rem;
  }
  :host([variant='compact']) .card-body .title {
    font-size: var(--k3-sys-typescale-title-medium-size);
    line-height: var(--k3-sys-typescale-title-medium-line-height);
  }
  :host([variant='card']) .controls,
  :host([variant='compact']) .controls {
    justify-content: center;
  }
  /* Card / compact / phone — extras under transport (k3-button-group connected) */
  .extras-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--k3-sys-spacing-space100);
    inline-size: 100%;
    position: relative;
    z-index: 2;
  }
  .extras-row:has(k3-tooltip[data-open]),
  .extras-row[data-vol-open] {
    z-index: 28;
  }
  .extras-row k3-button-group {
    flex: none;
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  :host([variant='compact']) .extras-row,
  .is-phone .extras-row {
    overflow: hidden;
    padding-inline: var(--k3-sys-spacing-space50);
    box-sizing: border-box;
  }
  /* ── Variante TOOLBAR / STICKY ───────────────────────────────────────── */
  .bar {
    position: relative;
    container: k3-ap-bar / inline-size;
    border-radius: var(--k3-sys-shape-corner-extra-large-increased, 2rem);
    background: var(--k3-sys-color-primary-container);
    color: var(--k3-sys-color-on-primary-container);
    box-shadow: var(--k3-sys-elevation-level2);
    overflow: visible;
    transition:
      background-color var(--_color-swap),
      color var(--_color-swap);
    --k3-seek-track: color-mix(in srgb, var(--k3-sys-color-on-primary-container) 22%, transparent);
  }
  .bar-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'open controls'
      'seek seek';
    align-items: center;
    column-gap: var(--k3-sys-spacing-space100);
    min-inline-size: 0;
    padding: var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space150) var(--k3-sys-spacing-space50)
      var(--k3-sys-spacing-space100);
    border-radius: inherit;
    background: inherit;
    color: inherit;
    /* visible — never clip k3-tooltip above transport / extras */
    overflow: visible;
  }
  /* Playlist panel — expands upward above the toolbar */
  .bar-queue {
    position: absolute;
    inset-inline: 0;
    inset-block-end: calc(100% + var(--k3-sys-spacing-space100, 0.5rem));
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: var(--k3-sys-spacing-space100);
    max-block-size: min(20rem, 50vh);
    border-radius: var(--k3-sys-shape-corner-extra-large, 1.75rem);
    background: var(--k3-sys-color-surface-container-high);
    color: var(--k3-sys-color-on-surface);
    box-shadow: var(--k3-sys-elevation-level3);
    padding: var(--k3-sys-spacing-space100, 0.5rem);
    --k3-scroll-track-inset: var(--k3-sys-shape-corner-extra-large, 1.75rem);
    transform-origin: bottom center;
    animation: k3-bar-queue-in var(--k3-sys-motion-duration-spatial-fast, 350ms)
      var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)) both;
  }
  .bar-queue > .tabs {
    flex: none;
  }
  .bar-queue-inner {
    flex: 1;
    min-block-size: 0;
    padding: 0;
  }
  @keyframes k3-bar-queue-in {
    from {
      opacity: 0;
      transform: translateY(0.75rem) scale(0.96);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bar-queue {
      animation: none;
    }
  }
  .bar-controls {
    grid-area: controls;
    display: flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space50, 0.25rem);
    position: relative;
    z-index: 1;
  }
  .bar-controls k3-icon-button:not(.play) {
    color: inherit;
  }
  .bar-extras {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: var(--k3-sys-spacing-space25, 0.125rem);
    position: relative;
    z-index: 2;
  }
  .bar-extras[data-vol-open] {
    z-index: 28;
  }
  .bar-extras k3-button-group {
    flex: none;
  }
  .bar-extras k3-icon-button {
    color: inherit;
  }
  /* Never color:inherit on k3-tooltip — plain tips need inverse-surface tokens */
  .bar-controls k3-tooltip,
  .bar-extras k3-tooltip,
  .transport k3-tooltip,
  .utility k3-tooltip,
  .extras-row k3-tooltip,
  .card-head k3-tooltip,
  .topbar k3-tooltip {
    display: inline-flex;
    position: relative;
    z-index: 6; /* above seek / bar chrome so tips are not covered */
  }
  .bar-open {
    grid-area: open;
    display: flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space150);
    min-inline-size: 0;
    padding: 0;
    padding-inline-end: var(--k3-sys-spacing-space100);
    border-radius: var(--k3-sys-shape-corner-extra-large);
    text-align: start;
  }
  .bar-open[disabled] {
    cursor: default;
  }
  .bar .artist {
    color: inherit;
    opacity: 0.8;
  }
  /* Like — filled heart + pop when toggled on */
  k3-icon-button.like[selected] {
    color: var(--k3-sys-color-error);
  }
  @keyframes k3-like-pop {
    0% {
      transform: scale(1);
    }
    35% {
      transform: scale(1.32);
    }
    100% {
      transform: scale(1);
    }
  }
  :host(:not([data-k3-reduce-motion])) k3-icon-button.like[selected] {
    animation: k3-like-pop var(--k3-sys-motion-duration-medium2, 300ms)
      var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9));
  }
  .bar-seek {
    grid-area: seek;
    display: flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space150);
    min-inline-size: 0;
    padding-inline: var(--k3-sys-spacing-space75);
  }
  .bar-seek k3-audio-seek {
    flex: 1;
  }
  .bar-seek .times {
    display: none;
    color: inherit;
    opacity: 0.85;
  }
  .bar-prev,
  .transport k3-tooltip:has(.bar-prev) {
    display: none;
  }
  @container k3-ap-bar (min-width: 680px) {
    .bar-inner {
      grid-template-columns: minmax(11rem, 16rem) auto minmax(0, 1fr);
      grid-template-areas: 'open controls seek';
      column-gap: var(--k3-sys-spacing-space200);
      padding: var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space200) var(--k3-sys-spacing-space100)
        var(--k3-sys-spacing-space100);
    }
    .bar-seek .times {
      display: inline;
    }
    .bar-prev,
    .transport k3-tooltip:has(.bar-prev) {
      display: inline-flex;
    }
  }

  /* ── Variantes FULL / PHONE / sheet plein écran ──────────────────────── */
  .full {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    isolation: isolate;
    container: k3-ap-full / inline-size;
    border-radius: var(--k3-sys-shape-corner-extra-extra-large, 3rem);
    background: var(--k3-sys-color-surface-container-low);
    transition: background-color var(--_color-swap);
    min-block-size: 40rem;
  }
  .ambient {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;
  }
  .ambient i {
    position: absolute;
    border-radius: 50%;
    filter: blur(4rem);
    opacity: 0.6;
    transition: background-color var(--_color-swap);
    animation: k3-ap-drift 26s ease-in-out infinite alternate;
  }
  .ambient i:nth-child(1) {
    inline-size: 60%;
    aspect-ratio: 1;
    inset-inline-start: -14%;
    inset-block-start: -18%;
    background: var(--k3-sys-color-primary-container);
  }
  .ambient i:nth-child(2) {
    inline-size: 46%;
    aspect-ratio: 1;
    inset-inline-end: -12%;
    inset-block-start: 20%;
    background: var(--k3-sys-color-tertiary-container);
    opacity: 0.5;
    animation-duration: 32s;
  }
  .ambient i:nth-child(3) {
    inline-size: 50%;
    aspect-ratio: 1;
    inset-inline-start: 18%;
    inset-block-end: -32%;
    background: var(--k3-sys-color-secondary-container);
    opacity: 0.45;
    animation-duration: 38s;
  }
  @keyframes k3-ap-drift {
    to {
      transform: translate(6%, 8%) scale(1.12);
    }
  }
  .topbar {
    display: flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space150);
    padding: var(--k3-sys-spacing-space200) var(--k3-sys-spacing-space200) var(--k3-sys-spacing-space100);
  }
  .topbar-label {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-inline-size: 0;
  }
  .overline {
    font-size: var(--k3-sys-typescale-label-small-size);
    line-height: var(--k3-sys-typescale-label-small-line-height);
    font-weight: var(--k3-sys-typescale-label-small-emphasized-weight, 600);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--k3-sys-color-primary);
  }
  .context {
    font-size: var(--k3-sys-typescale-body-medium-size);
    color: var(--k3-sys-color-on-surface-variant);
    font-variant-numeric: tabular-nums;
  }
  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--k3-sys-spacing-space200);
    min-block-size: 0;
    padding: var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space200) var(--k3-sys-spacing-space300);
  }
  .now {
    display: flex;
    flex-direction: column;
    gap: var(--k3-sys-spacing-space250);
    inline-size: 100%;
    max-inline-size: 34rem;
    margin-inline: auto;
    container: k3-ap-now / size;
  }
  .now .cover {
    align-self: center;
    /* Floor on cqb — 52cqb can be ~0 while the size container settles → cover vanished */
    inline-size: min(100%, 22.5rem, max(8rem, 52cqb));
    max-block-size: max(8rem, min(22.5rem, 52cqb));
  }
  .now-meta {
    display: flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space150);
  }
  .now .title {
    font-size: var(--k3-sys-typescale-headline-large-size);
    line-height: var(--k3-sys-typescale-headline-large-line-height);
    font-weight: var(--k3-sys-typescale-headline-large-emphasized-weight, 600);
    letter-spacing: var(--k3-sys-typescale-headline-large-tracking);
  }
  .now .artist {
    font-size: var(--k3-sys-typescale-body-large-size);
    line-height: var(--k3-sys-typescale-body-large-line-height);
    margin-block-start: var(--k3-sys-spacing-space50);
  }
  .seek-block {
    display: flex;
    flex-direction: column;
    gap: var(--k3-sys-spacing-space25);
    min-inline-size: 0;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--k3-sys-spacing-space100);
    min-block-size: 26rem;
    min-inline-size: 0;
    padding: var(--k3-sys-spacing-space100);
    border-radius: var(--k3-sys-shape-corner-extra-large-increased, 2rem);
    background: var(--k3-sys-color-surface-container);
    transition: background-color var(--_color-swap);
  }
  .panel-head {
    display: none;
  }
  .tabs {
    inline-size: 100%;
  }
  .pane {
    flex: 1;
    min-block-size: 0;
    border-radius: var(--k3-sys-shape-corner-extra-large);
  }
  .pane[hidden] {
    display: none;
  }
  .queue {
    display: block;
  }
  .q-thumb {
    display: block;
    inline-size: 3.5rem;
    block-size: 3.5rem;
    overflow: hidden;
    border-radius: var(--k3-sys-shape-corner-medium);
    background: var(--k3-sys-color-surface-container-high);
  }
  .q-thumb img {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  .q-thumb.is-current {
    border-radius: 50%;
  }
  .q-thumb.is-current img {
    animation: k3-ap-spin 14s linear infinite paused;
  }
  :host([playing]) .q-thumb.is-current img {
    animation-play-state: running;
  }
  .q-thumb .ms {
    display: grid;
    place-items: center;
    inline-size: 100%;
    block-size: 100%;
  }
  .q-dur {
    font-variant-numeric: tabular-nums;
    font-size: var(--k3-sys-typescale-label-medium-size, 0.75rem);
    opacity: 0.9;
  }
  .q-trail {
    display: inline-flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space100);
    font-size: var(--k3-sys-typescale-label-medium-size);
    font-variant-numeric: tabular-nums;
  }
  .eq {
    display: inline-flex;
    align-items: flex-end;
    gap: 2px;
    block-size: 1rem;
    color: var(--k3-sys-color-primary);
  }
  .eq i {
    inline-size: 3px;
    block-size: 100%;
    border-radius: 2px;
    background: currentColor;
    transform-origin: bottom;
    transform: scaleY(0.35);
    animation: k3-ap-eq 0.9s ease-in-out infinite alternate paused;
  }
  .eq i:nth-child(2) {
    animation-delay: -0.3s;
    animation-duration: 0.7s;
  }
  .eq i:nth-child(3) {
    animation-delay: -0.55s;
    animation-duration: 1.1s;
  }
  :host([playing]) .eq i {
    animation-play-state: running;
  }
  @keyframes k3-ap-eq {
    from {
      transform: scaleY(0.25);
    }
    to {
      transform: scaleY(1);
    }
  }
  .lyrics {
    display: flex;
    flex-direction: column;
    gap: var(--k3-sys-spacing-space50);
    padding: var(--k3-sys-spacing-space500, 2.5rem) var(--k3-sys-spacing-space150) 45%;
  }
  .pane--lyrics {
    mask-image: linear-gradient(to bottom, transparent 0, #000 3rem, #000 calc(100% - 4.5rem), transparent);
  }
  .lyric {
    display: block;
    inline-size: 100%;
    padding: var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space150);
    border-radius: var(--k3-sys-shape-corner-large);
    text-align: start;
    font-family: var(--k3-ref-typeface-brand, var(--k3-ref-typeface-plain));
    font-size: var(--k3-sys-typescale-headline-small-size);
    line-height: var(--k3-sys-typescale-headline-small-line-height);
    font-weight: var(--k3-sys-typescale-headline-small-emphasized-weight, 600);
    text-wrap: balance;
    color: var(--k3-sys-color-on-surface);
    opacity: 0.38;
    transform-origin: left center;
    transition:
      transform var(--_spatial-fast),
      opacity var(--_effects),
      color var(--_effects);
  }
  .lyric:hover {
    opacity: 0.7;
  }
  .lyric.is-past {
    opacity: 0.26;
  }
  .lyric.is-active {
    opacity: 1;
    color: var(--k3-sys-color-primary);
    transform: scale(1.04);
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: var(--k3-sys-spacing-space50);
    padding: var(--k3-sys-spacing-space700, 3.5rem) var(--k3-sys-spacing-space300);
    text-align: center;
    color: var(--k3-sys-color-on-surface-variant);
  }
  .empty-art {
    display: grid;
    place-items: center;
    inline-size: 4.5rem;
    block-size: 4.5rem;
    margin-block-end: var(--k3-sys-spacing-space150);
    color: var(--k3-sys-color-on-tertiary-container);
  }
  .empty-art svg {
    position: absolute;
    inline-size: 4.5rem;
    block-size: 4.5rem;
  }
  .empty-art path {
    fill: var(--k3-sys-color-tertiary-container);
  }
  .empty-art .ms {
    position: relative;
    font-size: 2rem;
  }
  .empty p {
    margin: 0;
    font-size: var(--k3-sys-typescale-title-small-size);
    font-weight: var(--k3-sys-typescale-title-small-weight);
    color: var(--k3-sys-color-on-surface);
  }
  .empty .hint {
    max-inline-size: 30ch;
    font-size: var(--k3-sys-typescale-body-medium-size);
    font-weight: var(--k3-sys-typescale-body-medium-weight);
    color: var(--k3-sys-color-on-surface-variant);
  }

  @container k3-ap-full (min-width: 860px) {
    .body {
      grid-template-columns: minmax(0, 1.1fr) minmax(20rem, 0.9fr);
      gap: var(--k3-sys-spacing-space300);
      overflow: hidden;
      padding: var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space300) var(--k3-sys-spacing-space300);
    }
    .now {
      /* safe center — plain center clips top+bottom when content overflows */
      justify-content: flex-start;
      justify-content: safe center;
      min-block-size: 0;
      /* Prefer shrinking the cover over a scrollbar in the dialog sheet */
      overflow: hidden;
      padding: var(--k3-sys-spacing-space150) var(--k3-sys-spacing-space200)
        var(--k3-sys-spacing-space400);
    }
    .now .cover {
      inline-size: min(clamp(10rem, 30cqi, 23.75rem), max(8rem, 48cqb));
      max-block-size: max(8rem, min(23.75rem, 48cqb));
    }
    .panel {
      min-block-size: 0;
    }
    .panel .pane.k3-scroll {
      /* Edge scrollbar only on the queue / lyrics pane — not on .now */
      --k3-scroll-track-inset: var(--k3-sys-shape-corner-extra-large, 1.75rem);
    }
  }

  /* Sheet dialog — no native scrollbar on the now column */
  .sheet .now {
    overflow: hidden;
  }
  .sheet .now .cover {
    inline-size: min(100%, 22.5rem, max(8rem, 42cqb));
    max-block-size: max(8rem, min(22.5rem, 42cqb));
  }

  /* Phone : vertical mockup (capture 2) — cover · meta · seek · transport · utility */
  .full.is-phone {
    position: relative;
    display: flex;
    flex-direction: column;
    block-size: 100%;
    min-block-size: 42rem;
    border-radius: var(--k3-sys-shape-corner-extra-extra-large, 1.75rem);
    background: var(--k3-sys-color-surface);
    overflow: hidden; /* clip phone sheet to the mockup radius */
    isolation: isolate;
  }
  /* Phone — no “now playing” topbar; lyrics/queue live in the bottom segmented cluster */
  .is-phone > .topbar {
    display: none;
  }
  .is-phone .body {
    /* Under the sheet (panel is a direct child of .full.is-phone) */
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-block-size: 0;
    overflow: hidden;
    padding: var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space300) var(--k3-sys-spacing-space300);
  }
  .is-phone .now {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: stretch;
    min-block-size: 0;
    max-inline-size: none;
    gap: var(--k3-sys-spacing-space200);
    padding-block: var(--k3-sys-spacing-space100);
  }
  .is-phone .now .cover {
    /* Rem-only — never cqb/% that collapse while the size container settles */
    flex: none;
    align-self: center;
    inline-size: 14rem;
    block-size: 14rem;
    min-inline-size: 14rem;
    min-block-size: 14rem;
    max-inline-size: 14rem;
    max-block-size: 14rem;
    aspect-ratio: 1;
    margin: 0 auto var(--k3-sys-spacing-space100);
  }
  @container k3-ap-now (max-height: 28rem) {
    .is-phone .now .cover {
      inline-size: 11rem;
      block-size: 11rem;
      min-inline-size: 11rem;
      min-block-size: 11rem;
      max-inline-size: 11rem;
      max-block-size: 11rem;
    }
  }
  .is-phone .now-meta {
    flex: none;
    align-items: flex-start;
    gap: var(--k3-sys-spacing-space100);
  }
  .is-phone .now .title {
    font-size: var(--k3-sys-typescale-headline-small-size, 1.5rem);
    line-height: var(--k3-sys-typescale-headline-small-line-height, 2rem);
    font-weight: var(--k3-sys-typescale-headline-small-emphasized-weight, 600);
  }
  .is-phone .now .artist {
    font-size: var(--k3-sys-typescale-body-large-size);
  }
  .is-phone .seek-block {
    flex: none;
    width: 100%;
  }
  .is-phone .controls {
    flex: none;
    justify-content: center;
    gap: var(--k3-sys-spacing-space200);
  }
  .is-phone .utility {
    flex: none;
    inline-size: 100%;
    justify-content: center;
    padding-block: var(--k3-sys-spacing-space50) var(--k3-sys-spacing-space150);
  }
  .is-phone .utility .extras-row,
  .is-phone .utility k3-button-group {
    max-inline-size: 100%;
  }
  .utility .extras-row {
    inline-size: 100%;
  }
  .bar-extras .extras-row {
    /* Flatten so vol-toolbar anchors to .bar-extras */
    display: contents;
  }
  .is-phone .ambient i {
    opacity: 0.35;
    filter: blur(5rem);
  }
  .is-phone .ambient i:nth-child(1) {
    inset-block-start: 28%;
    inset-inline-start: 10%;
    inline-size: 70%;
  }
  .is-phone .ambient i:nth-child(2),
  .is-phone .ambient i:nth-child(3) {
    opacity: 0.22;
  }
  /* Phone sheet — sibling of .body, above cover · transport · extras */
  .is-phone > .panel {
    position: absolute;
    z-index: 100;
    inset-inline: 0;
    inset-block-end: 0;
    inset-block-start: auto;
    block-size: 92%;
    min-block-size: 0;
    padding: var(--k3-sys-spacing-space50) var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space150);
    border-radius: var(--k3-sys-shape-corner-extra-large-increased, 2rem)
      var(--k3-sys-shape-corner-extra-large-increased, 2rem) 0 0;
    box-shadow: var(--k3-sys-elevation-level3);
    background: var(--k3-sys-color-surface-container);
    transform: translateY(105%);
    visibility: hidden;
    pointer-events: none;
    transition:
      transform var(--_spatial),
      visibility 0s linear var(--_spatial),
      background-color var(--_color-swap);
  }
  .is-phone > .panel.is-open {
    transform: none;
    visibility: visible;
    pointer-events: auto;
    transition:
      transform var(--_spatial),
      visibility 0s linear 0s,
      background-color var(--_color-swap);
  }
  .is-phone > .panel.is-dragging {
    transition: none !important;
    visibility: visible;
    pointer-events: auto;
  }
  .is-phone:has(> .panel.is-open) .body,
  .is-phone:has(> .panel.is-dragging) .body {
    pointer-events: none;
  }
  .is-phone .panel-head {
    position: relative;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    block-size: 2.5rem;
    touch-action: none;
    cursor: grab;
  }
  .is-phone .panel-head:active {
    cursor: grabbing;
  }
  .grip {
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 0.625rem;
    inline-size: 2.25rem;
    block-size: 0.25rem;
    border-radius: 2px;
    background: var(--k3-sys-color-outline);
    opacity: 0.6;
    transform: translateX(-50%);
    pointer-events: none;
  }

  /* Sticky dock — rail + floating chrome both sides */
  :host([data-sticky-dock]) {
    position: fixed !important;
    inset-inline-start: calc(
      var(--k3-shell-rail-inline-size, 0px) + var(--k3-floating-chrome-inset-inline-start, 0px) +
        var(--k3-sys-spacing-space200, 1rem)
    ) !important;
    inset-inline-end: calc(
      var(--k3-floating-chrome-inset-inline-end, 0px) + var(--k3-sys-spacing-space200, 1rem)
    ) !important;
    inset-block-end: calc(
      var(--k3-nav-chrome-inset-block-end, 0px) + var(--k3-sys-spacing-space200, 1rem)
    ) !important;
    inset-block-start: auto !important;
    z-index: 1150 !important;
    inline-size: auto !important;
    max-inline-size: none !important;
    margin: 0 !important;
    pointer-events: auto;
    transition:
      inset-inline-start var(--k3-sys-motion-duration-spatial-fast, 350ms)
        var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)),
      inset-inline-end var(--k3-sys-motion-duration-spatial-fast, 350ms)
        var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)),
      inset-block-end var(--k3-sys-motion-duration-spatial-fast, 350ms)
        var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)) !important;
  }

  /* Expanded from card — dialog-like layer above shell chrome */
  :host([data-sheet-open]) {
    position: fixed !important;
    inset: 0 !important;
    z-index: 1200 !important;
    inline-size: auto !important;
    max-inline-size: none !important;
    min-block-size: 0 !important;
    margin: 0 !important;
    pointer-events: none;
  }
  :host([data-sheet-open]) .card,
  :host([data-sheet-open]) .bar {
    position: absolute !important;
    inline-size: 0 !important;
    block-size: 0 !important;
    overflow: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    visibility: hidden !important;
  }
  :host([data-sheet-open]) .scrim,
  :host([data-sheet-open]) .sheet {
    pointer-events: auto;
  }

  /* Sheet plein écran (expanded) — custom dialog + scrim */
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 1;
    background: color-mix(in srgb, var(--k3-sys-color-scrim, #000) 40%, transparent);
    animation: k3-ap-fade var(--_effects);
    cursor: pointer;
  }
  .sheet {
    position: fixed;
    z-index: 2;
    inset: 0;
    border-radius: 0;
    min-block-size: 0;
    padding-block: env(safe-area-inset-top, 0px) env(safe-area-inset-bottom, 0px);
    box-shadow: var(--k3-sys-elevation-level5);
  }
  @media (min-width: 880px) and (min-height: 600px) {
    .sheet {
      inset: var(--k3-sys-spacing-space400);
      margin: auto;
      max-inline-size: 75rem;
      max-block-size: 53.75rem;
      border-radius: var(--k3-sys-shape-corner-extra-extra-large, 3rem);
    }
  }
  @keyframes k3-ap-fade {
    from {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
    }
  }
`;

/* ═══════════════════════════════════════════════════════════════════════════
 * k3-audio-player
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Lecteur playlist M3 Expressive (mp3 / ogg / wav).
 * La sourdine musique est indépendante de `k3-sound-fx`.
 */
export class K3AudioPlayer extends K3Element {
  static override styles = [
    hostReset,
    stateLayerStyles,
    focusRingStyles,
    edgeScrollbarStyles,
    playerStyles,
    volumeToolbarStyles,
  ];

  /** Tableau JSON de {@link AudioTrack}. */
  @property({ type: Array }) tracks: AudioTrack[] = [];
  @property({ type: Number, attribute: 'track-index' }) trackIndex = 0;
  @property({ type: Number }) volume = AudioPlayerSpecs.defaultVolume;
  @property({ type: Boolean, reflect: true }) muted = false;
  @property({ type: Boolean, attribute: 'auto-play' }) autoPlay = false;
  /** Répète le titre (alias de `repeat="one"`). */
  @property({ type: Boolean }) loop = false;
  /** Répète la playlist (alias de `repeat="all"`). */
  @property({ type: Boolean, attribute: 'loop-playlist' }) loopPlaylist = false;
  @property({ reflect: true }) repeat: AudioRepeatMode = 'off';
  @property({ type: Boolean, reflect: true }) shuffle = false;
  @property({
    reflect: true,
    converter: {
      fromAttribute: (v: string | null) => resolveAudioPlayerVariant(v),
      toAttribute: (v: AudioPlayerVariantAlias) => resolveAudioPlayerVariant(v),
    },
  })
  variant: AudioPlayerVariant = 'card';
  /** Sheet dialog ouverte (card + `expandable` uniquement). */
  @property({ type: Boolean, reflect: true }) expanded = false;
  /** Autorise la sheet plein écran depuis la variante `card`. */
  @property({ type: Boolean, reflect: true }) expandable = false;
  /**
   * Saut arrière en secondes (0 = masqué). Opt-in · full / dialog+scrim seulement.
   * Valeurs typiques : 15 · 30.
   */
  @property({ type: Number, attribute: 'skip-back' }) skipBack = 0;
  /**
   * Saut avant en secondes (0 = masqué). Opt-in · full / dialog+scrim seulement.
   * Valeurs typiques : 15 · 30.
   */
  @property({ type: Number, attribute: 'skip-forward' }) skipForward = 0;
  /** Bouton partager — opt-in · full / dialog+scrim seulement. */
  @property({ type: Boolean, reflect: true, attribute: 'show-share' }) showShare = false;
  /** Bouton télécharger — opt-in · full / dialog+scrim seulement. */
  @property({ type: Boolean, reflect: true, attribute: 'show-download' }) showDownload = false;
  /** Style du seek : `wave` (défaut) · `oscillation`. */
  @property({ reflect: true, attribute: 'seek-style' }) seekStyle: AudioSeekStyle = 'wave';
  /** `on` : palette dérivée de la pochette (MCU) · `off` : thème global. */
  @property({ attribute: 'dynamic-color', reflect: true }) dynamicColor: 'on' | 'off' = 'on';
  /**
   * Raccourcis (Espace/K · ←/→ · N/P · M · L/S/R). Ne tirent que si cet attr
   * est posé, le host est visible (pas dans `[hidden]`), et ce player est le
   * premier visible avec `hotkeys` — les pages playground cachées ne volent pas.
   */
  @property({ type: Boolean, reflect: true }) hotkeys = false;
  /**
   * Stage sticky/overlay inside a relative parent instead of `position:fixed`
   * (playground demos).
   */
  @property({ type: Boolean, reflect: true }) staged = false;
  /**
   * Demo-only: click sticky bar → restore `toolbar` (playground).
   * Production sticky stays pinned; leave this off.
   */
  @property({ type: Boolean, reflect: true, attribute: 'dock-toggle' }) dockToggle = false;
  /** Reflété pour le style (`:host([playing])`). */
  @property({ type: Boolean, reflect: true }) playing = false;

  @state() private currentTime = 0;
  @state() private duration = 0;
  @state() private musicMuted = false;
  @state() private loading = false;
  @state() private liked = new Set<string>();
  @state() private tab: PanelTab = 'queue';
  @state() private panelOpen = false;
  /** Toolbar playlist panel (expands upward). */
  @state() private barQueueOpen = false;
  @state() private speed = 1;
  @state() private order: number[] = [];
  @state() private lyricIdx = -1;
  /** Durées découvertes via metadata (src → seconds). */
  @state() private durationBySrc = new Map<string, number>();
  /** Android-style volume popover open (card / compact). */
  @state() private volumeOpen = false;
  /** Drop playlist + paroles from the connected group when the row overflows. */
  @state() private mediaExtrasCompact = false;

  @query('audio') private audioEl!: HTMLAudioElement;
  @query('[part="volume-open"]') private volTriggerEl?: HTMLElement;

  private uid = `k3ap${++UID}`;
  private shape: MaterialShapeName = AudioPlayerSpecs.coverShapes[0];
  private coverD: string = MATERIAL_SHAPE_SVG[AudioPlayerSpecs.coverShapes[0]];
  private morphAbort?: AbortController;
  private rot = 0;
  private raf = 0;
  private last = 0;
  private timeRaf = 0;
  private lyrics: LyricLine[] = [];
  private userScrollUntil = 0;
  private themeToken = 0;
  private idleJobs: IdleHandle[] = [];
  private pendingResume = false;
  private volumeDismiss: OutsideDismissController | null = null;
  private panelDrag: DragController | null = null;
  private extrasRo: ResizeObserver | null = null;
  private extrasFitRaf = 0;
  /** Title / artist AOSP marquees (button-smart). */
  private metaMarqueeHandles: TextMarqueeHandle[] = [];
  private metaRo: ResizeObserver | null = null;
  private metaMarqueeRaf = 0;
  private onThemeChange = (): void => void this.applyDynamicColor();
  private onDocKey = (e: KeyboardEvent): void => this.handleHotkey(e);
  private portal = new LayerPortal();
  /** Sticky dock — keep end inset clear of FAB / STT. */
  private floatingChromeInset: FloatingChromeInsetObserver | null = null;

  get currentTrack(): AudioTrack | undefined {
    return this.tracks[this.trackIndex];
  }

  get resolvedVariant(): AudioPlayerVariant {
    return resolveAudioPlayerVariant(this.variant);
  }

  private get repeatMode(): AudioRepeatMode {
    if (this.repeat !== 'off') return this.repeat;
    if (this.loop) return 'one';
    if (this.loopPlaylist) return 'all';
    return 'off';
  }

  private get canExpand(): boolean {
    /* Sheet dialog = card only. Toolbar docks to sticky — never opens a sheet. */
    return this.expandable && this.resolvedVariant === 'card';
  }

  /** True when this player should respond to media hotkeys right now. */
  private isHotkeyTarget(): boolean {
    if (!this.hotkeys || !this.isConnected) return false;
    if (this.closest('[hidden]')) return false;
    if (typeof this.checkVisibility === 'function') {
      try {
        if (
          !this.checkVisibility({
            checkOpacity: true,
            checkVisibilityCSS: true,
          })
        ) {
          return false;
        }
      } catch {
        /* older engines */
      }
    }
    const nodes = document.querySelectorAll('k3-audio-player[hotkeys]');
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.closest('[hidden]')) continue;
      if (typeof node.checkVisibility === 'function') {
        try {
          if (
            !node.checkVisibility({
              checkOpacity: true,
              checkVisibilityCSS: true,
            })
          ) {
            continue;
          }
        } catch {
          /* ignore */
        }
      }
      return node === this;
    }
    return false;
  }

  /* ── Cycle de vie ─────────────────────────────────────────────────────── */

  override connectedCallback(): void {
    super.connectedCallback();
    void ensureAudioPlayerDeps();
    this.setAttribute('role', AudioPlayerSpecs.accessibility.role);
    if (!this.hasAttribute('aria-label')) this.setAttribute('aria-label', tr('ariaLabel', 'Audio player', 'Lecteur audio'));
    this.musicMuted = this.muted || readMusicMuted();
    this.muted = this.musicMuted;
    document.addEventListener('k3-theme-change', this.onThemeChange);
    document.addEventListener('keydown', this.onDocKey);
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', this.onThemeChange);
    }
  }

  override disconnectedCallback(): void {
    if (this.portal.isElevating) {
      super.disconnectedCallback();
      return;
    }
    document.removeEventListener('k3-theme-change', this.onThemeChange);
    document.removeEventListener('keydown', this.onDocKey);
    if (typeof matchMedia === 'function') {
      matchMedia('(prefers-color-scheme: dark)').removeEventListener?.('change', this.onThemeChange);
    }
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.timeRaf) {
      cancelAnimationFrame(this.timeRaf);
      this.timeRaf = 0;
    }
    this.themeToken++;
    for (const h of this.idleJobs) cancelIdle(h);
    this.idleJobs.length = 0;
    this.closeVolumePopover();
    this.teardownPanelDrag();
    this.teardownExtrasFit();
    this.teardownMetaMarquees();
    this.morphAbort?.abort();
    this.setScrollLock(false);
    this.removeAttribute('data-sheet-open');
    this.removeAttribute('data-sticky-dock');
    this.floatingChromeInset?.disconnect();
    this.floatingChromeInset = null;
    this.portal.clearHome();
    super.disconnectedCallback();
  }

  /** Idle work that must not outlive the host (MCU, duration probe). */
  private runIdle(fn: () => void): void {
    const handle = scheduleIdle(() => {
      const i = this.idleJobs.indexOf(handle);
      if (i >= 0) this.idleJobs.splice(i, 1);
      if (!this.isConnected) return;
      fn();
    });
    this.idleJobs.push(handle);
  }

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('tracks') || changed.has('shuffle')) this.rebuildOrder();
    if (changed.has('tracks') || changed.has('trackIndex')) {
      this.trackIndex = Math.min(Math.max(0, this.trackIndex), Math.max(0, this.tracks.length - 1));
      this.lyrics = parseLrc(this.currentTrack?.lyrics);
      this.lyricIdx = -1;
    }
  }

  override firstUpdated(): void {
    this.applyVolume();
    this.loadCurrent(false);
    this.syncDockLayer();
    this.syncPanelDrag();
    this.syncExtrasFit();
    this.syncMetaMarquees();
    /* Duration probe after first paint — MCU theme is scheduled from onTrackVisuals */
    this.runIdle(() => this.probeTrackDurations());
    if (this.autoPlay && !this.musicMuted) void this.play();
  }

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('tracks') || changed.has('trackIndex')) {
      const resume = this.pendingResume || this.playing;
      this.pendingResume = false;
      this.loadCurrent(resume);
      const animate = changed.has('trackIndex') && changed.get('trackIndex') !== undefined;
      this.onTrackVisuals(animate);
      if (changed.has('tracks')) this.runIdle(() => this.probeTrackDurations());
    }
    if (changed.has('volume') || changed.has('muted')) {
      this.musicMuted = this.muted;
      this.applyVolume();
    }
    if (changed.has('expanded') || changed.has('variant') || changed.has('staged')) {
      this.syncDockLayer();
    }
    if (changed.has('expanded')) {
      this.setScrollLock(this.expanded);
      if (this.expanded) this.animateSheetIn();
      if (changed.get('expanded') !== undefined) this.emit('k3-expand', { expanded: this.expanded });
    }
    if (changed.has('variant') && changed.get('variant') !== undefined) {
      const sticky = this.resolvedVariant === 'sticky';
      this.emit('k3-sticky', { sticky });
    }
    if (changed.has('dynamicColor')) void this.applyDynamicColor();
    if (changed.has('tab')) {
      const idx = this.tab === 'queue' ? 0 : 1;
      this.renderRoot.querySelectorAll('k3-button-segmented.tabs').forEach((node) => {
        const seg = node as HTMLElement & {
          getSelectedIndices(): number[];
          setSelectedIndices(indices: number[]): void;
        };
        if (seg.getSelectedIndices()[0] !== idx) seg.setSelectedIndices([idx]);
      });
    }
    if (changed.has('playing')) this.wake();
    if (
      changed.has('variant') ||
      changed.has('panelOpen') ||
      changed.has('expanded') ||
      changed.has('tracks')
    ) {
      this.syncPanelDrag();
    }
    if (
      changed.has('variant') ||
      changed.has('mediaExtrasCompact') ||
      changed.has('expanded')
    ) {
      this.syncExtrasFit();
    }
    if (
      changed.has('tracks') ||
      changed.has('trackIndex') ||
      changed.has('variant') ||
      changed.has('expanded')
    ) {
      this.scheduleMetaMarquees();
    }
    // Toute nouvelle pochette rendue reçoit la forme courante.
    this.paintCover();
  }

  private teardownMetaMarquees(): void {
    if (this.metaMarqueeRaf) {
      cancelAnimationFrame(this.metaMarqueeRaf);
      this.metaMarqueeRaf = 0;
    }
    this.metaRo?.disconnect();
    this.metaRo = null;
    for (const h of this.metaMarqueeHandles) h.stop();
    this.metaMarqueeHandles = [];
  }

  private scheduleMetaMarquees(): void {
    if (this.metaMarqueeRaf) cancelAnimationFrame(this.metaMarqueeRaf);
    this.metaMarqueeRaf = requestAnimationFrame(() => {
      this.metaMarqueeRaf = requestAnimationFrame(() => {
        this.metaMarqueeRaf = 0;
        this.syncMetaMarquees();
      });
    });
  }

  /** Bind / refresh AOSP marquees on every title & artist line in the tree. */
  private syncMetaMarquees(rebind = true): void {
    const root = this.renderRoot;
    if (!root) return;

    const marquees = [...root.querySelectorAll<HTMLElement>('.meta-marquee')];
    if (!rebind && this.metaMarqueeHandles.length === marquees.length) {
      this.metaMarqueeHandles.forEach((h) => h.refresh());
      return;
    }

    for (const h of this.metaMarqueeHandles) h.stop();
    this.metaMarqueeHandles = [];
    this.metaRo?.disconnect();
    this.metaRo = null;

    marquees.forEach((el) => {
      const handle = attachTextMarquee(el);
      this.metaMarqueeHandles.push(handle);
      handle.refresh();
    });

    if (typeof ResizeObserver === 'undefined') return;
    this.metaRo = new ResizeObserver(() => {
      if (this.metaMarqueeRaf) cancelAnimationFrame(this.metaMarqueeRaf);
      this.metaMarqueeRaf = requestAnimationFrame(() => {
        this.metaMarqueeRaf = 0;
        this.syncMetaMarquees(false);
      });
    });
    root.querySelectorAll<HTMLElement>('.meta').forEach((meta) => {
      this.metaRo?.observe(meta);
    });
  }

  private teardownExtrasFit(): void {
    this.extrasRo?.disconnect();
    this.extrasRo = null;
    if (this.extrasFitRaf) {
      cancelAnimationFrame(this.extrasFitRaf);
      this.extrasFitRaf = 0;
    }
  }

  /** Measure connected media group — drop queue/lyrics when the row overflows. */
  private syncExtrasFit(): void {
    this.teardownExtrasFit();
    const row = this.renderRoot?.querySelector<HTMLElement>('.extras-row');
    if (!row || typeof ResizeObserver !== 'function') return;

    const measure = (): void => {
      const group = row.querySelector<HTMLElement>('k3-button-group');
      if (!group) return;
      const overflow = group.scrollWidth > row.clientWidth + 2;
      if (overflow && !this.mediaExtrasCompact) this.mediaExtrasCompact = true;
      else if (!overflow && this.mediaExtrasCompact) this.mediaExtrasCompact = false;
    };

    this.extrasRo = new ResizeObserver(() => {
      if (this.extrasFitRaf) cancelAnimationFrame(this.extrasFitRaf);
      this.extrasFitRaf = requestAnimationFrame(() => {
        this.extrasFitRaf = 0;
        /* Compact = 4 buttons; full = 5 (~40dp × 5 ≈ 14rem) — restore when room */
        if (this.mediaExtrasCompact) {
          if (row.clientWidth >= 15 * 16) this.mediaExtrasCompact = false;
          else return;
        }
        measure();
      });
    });
    this.extrasRo.observe(row);
    requestAnimationFrame(measure);
  }

  private teardownPanelDrag(): void {
    this.panelDrag?.destroy();
    this.panelDrag = null;
  }

  /** Phone bottom sheet — drag the handle/header down to dismiss. */
  private syncPanelDrag(): void {
    this.teardownPanelDrag();
    if (this.resolvedVariant !== 'phone') return;
    const panel = this.renderRoot.querySelector<HTMLElement>('.panel');
    const head = panel?.querySelector<HTMLElement>('.panel-head');
    if (!panel || !head) return;

    this.panelDrag = attachDrag(head, {
      axis: 'y',
      threshold: 6,
      preventScroll: true,
      touchAction: 'none',
      disabled: () => !this.panelOpen,
      minY: 0,
      maxY: () => panel.offsetHeight || 0,
      canStart: (e: Event) => {
        const path = e.composedPath();
        for (const n of path) {
          if (!(n instanceof Element)) continue;
          if (
            n.closest(
              'k3-icon-button, button, a, input, textarea, select, k3-button-segmented, k3-slider',
            )
          ) {
            return false;
          }
        }
        return true;
      },
      onActivate: () => {
        panel.classList.add('is-dragging');
        panel.style.transition = 'none';
      },
      onMove: (d: { active: boolean; dy: number }) => {
        if (!d.active) return;
        const y = Math.max(0, d.dy);
        panel.style.transform = `translateY(${y}px)`;
      },
      onEnd: (d: { dy: number; velocityY: number }) => {
        panel.classList.remove('is-dragging');
        const h = panel.offsetHeight || 1;
        const offset = Math.max(0, d.dy);
        const dismiss = shouldDismissDrag({
          offset,
          size: h,
          velocity: d.velocityY,
        });
        if (dismiss) {
          panel.style.transition = '';
          panel.style.transform = '';
          clearAxisTranslate(panel);
          this.panelOpen = false;
          return;
        }
        /* Snap open */
        panel.style.transition = '';
        panel.style.transform = '';
        clearAxisTranslate(panel);
      },
    });
  }

  /* ── API publique ─────────────────────────────────────────────────────── */

  async play(): Promise<void> {
    if (!this.audioEl || !this.currentTrack) return;
    if (this.musicMuted) this.setMusicMuted(false);
    try {
      const p = this.audioEl.play();
      if (p && typeof (p as Promise<void>).then === 'function') await p;
      this.playing = true;
      this.emit('k3-play', { index: this.trackIndex, track: this.currentTrack });
    } catch {
      this.playing = false;
    }
  }

  pause(): void {
    try {
      this.audioEl?.pause();
    } catch {
      /* jsdom */
    }
    this.playing = false;
    this.emit('k3-pause', { index: this.trackIndex });
  }

  toggle(): void {
    if (this.playing) this.pause();
    else void this.play();
  }

  stop(): void {
    if (!this.audioEl) return;
    try {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    } catch {
      /* jsdom */
    }
    this.playing = false;
    this.currentTime = 0;
    this.emit('k3-stop', { index: this.trackIndex });
  }

  next(auto = false): void {
    if (!this.tracks.length) return;
    if (auto && this.repeatMode === 'one') {
      this.seek(0);
      void this.play();
      return;
    }
    const resume = auto || this.playing;
    const pos = this.order.indexOf(this.trackIndex);
    if (pos < this.order.length - 1) {
      this.goTo(this.order[pos + 1]!, resume);
      return;
    }
    /* Fin de file : boucle si repeat=all, arrêt en lecture auto, sinon retour au début. */
    if (this.repeatMode === 'all') this.goTo(this.order[0]!, resume);
    else if (auto) this.stop();
    else this.goTo(this.order[0]!, resume);
  }

  prev(): void {
    if (!this.tracks.length) return;
    if (this.audioEl && this.audioEl.currentTime > 3) {
      this.seek(0);
      return;
    }
    const pos = this.order.indexOf(this.trackIndex);
    if (pos <= 0) {
      if (this.repeatMode === 'all') this.goTo(this.order[this.order.length - 1]!, true);
      else this.seek(0);
      return;
    }
    this.goTo(this.order[pos - 1]!, true);
  }

  /** Joue le titre `index` (index dans `tracks`). */
  playIndex(index: number): void {
    if (index === this.trackIndex) {
      this.toggle();
      return;
    }
    this.goTo(index, true);
  }

  seek(seconds: number): void {
    if (!this.audioEl) return;
    const d = this.audioEl.duration || this.currentTrack?.duration || seconds;
    try {
      this.audioEl.currentTime = Math.max(0, Math.min(d, seconds));
    } catch {
      /* jsdom */
    }
    this.currentTime = this.audioEl.currentTime || 0;
    this.syncSeekbars();
  }

  /** Relative seek (e.g. −15 / +30). */
  skipBy(deltaSeconds: number): void {
    const now = this.audioEl?.currentTime ?? this.currentTime;
    this.seek(now + deltaSeconds);
  }

  /**
   * Share current track — cancelable `k3-share`, then Web Share API when available.
   * Playground demos call `preventDefault()` (copyright) and show a snackbar instead.
   */
  async shareTrack(): Promise<void> {
    const track = this.currentTrack;
    if (!track) return;
    if (!this.emit('k3-share', { index: this.trackIndex, track }, true)) return;
    const data: ShareData = {
      title: track.title ?? tr('ariaLabel', 'Audio player', 'Lecteur audio'),
      text: [track.artist, track.album].filter(Boolean).join(' · '),
      url: track.src,
    };
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(data);
      }
    } catch {
      /* user cancel / unsupported */
    }
  }

  /**
   * Download current track — cancelable `k3-download`, then anchor download.
   * Playground demos call `preventDefault()` (copyright) and show a snackbar instead.
   */
  downloadTrack(): void {
    const track = this.currentTrack;
    if (!track) return;
    if (!this.emit('k3-download', { index: this.trackIndex, track }, true)) return;
    try {
      const a = document.createElement('a');
      a.href = track.src;
      const ext = /\.\w{2,5}(?:$|\?)/.exec(track.src)?.[0]?.replace('?', '') ?? '.mp3';
      const base = (track.title || 'track').replace(/[^\w\-]+/g, '_').slice(0, 80);
      a.download = `${base}${ext.startsWith('.') ? ext : `.${ext}`}`;
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* jsdom / blocked */
    }
  }

  /** Coupe / rétablit la musique seulement (pas les effets d'interaction). */
  setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    this.muted = muted;
    writeMusicMuted(muted);
    this.applyVolume();
    if (muted) this.pause();
    this.emit('k3-change', { musicMuted: muted });
  }

  /** Ajoute des titres à la file. */
  addTracks(tracks: AudioTrack[], playFirst = false): void {
    const start = this.tracks.length;
    this.tracks = [...this.tracks, ...tracks];
    if (playFirst && tracks.length) this.goTo(start, true);
  }

  /** Retire un titre de la file (snackbar avec Annuler). */
  removeTrack(index: number): void {
    if (this.tracks.length <= 1 || index < 0 || index >= this.tracks.length) return;
    const removed = this.tracks[index]!;
    const wasCurrent = index === this.trackIndex;
    const wasPlaying = this.playing;
    const next = [...this.tracks];
    next.splice(index, 1);
    let ti = this.trackIndex;
    if (index < ti) ti -= 1;
    else if (wasCurrent) ti = Math.min(index, next.length - 1);
    this.pendingResume = wasCurrent && wasPlaying;
    this.tracks = next;
    this.trackIndex = ti;
    void showSnackbar({
      message: tr('removed', '“{title}” removed from queue', '« {title} » retiré de la file', {
        title: removed.title ?? '',
      }),
      action: tr('undo', 'Undo', 'Annuler'),
      duration: 'long',
      onAction: () => {
        const restored = [...this.tracks];
        restored.splice(index, 0, removed);
        const cur = this.trackIndex >= index ? this.trackIndex + 1 : this.trackIndex;
        this.tracks = restored;
        this.trackIndex = cur;
      },
    });
  }

  /* ── Interne : navigation ─────────────────────────────────────────────── */

  private goTo(index: number, resume: boolean): void {
    if (index === this.trackIndex) {
      if (resume) void this.play();
      return;
    }
    this.pendingResume = resume;
    this.trackIndex = index;
    this.emit('k3-change', { index, track: this.tracks[index] });
  }

  private rebuildOrder(): void {
    const n = this.tracks.length;
    const base = [...Array(n).keys()];
    if (!this.shuffle || n < 2) {
      this.order = base;
      return;
    }
    const rest = base.filter((i) => i !== this.trackIndex);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    this.order = [this.trackIndex, ...rest];
  }

  private applyVolume(): void {
    if (!this.audioEl) return;
    this.audioEl.volume = this.musicMuted ? 0 : Math.min(1, Math.max(0, this.volume));
    this.audioEl.muted = this.musicMuted;
  }

  private loadCurrent(resume: boolean): void {
    const track = this.currentTrack;
    if (!this.audioEl || !track) return;
    this.audioEl.loop = false;
    this.loading = resume;
    queueMicrotask(() => {
      void this.updateComplete.then(() => {
        try {
          this.audioEl?.load();
        } catch {
          /* jsdom */
        }
        this.applyVolume();
        this.audioEl.playbackRate = this.speed;
        this.currentTime = 0;
        this.duration = this.trackDurationOf(track);
        if (resume) void this.play();
        else this.loading = false;
      });
    });
  }

  private onTimeUpdate(): void {
    if (!this.audioEl || this.timeRaf) return;
    this.timeRaf = requestAnimationFrame(() => {
      this.timeRaf = 0;
      if (!this.audioEl) return;
      this.currentTime = this.audioEl.currentTime;
      const d = this.audioEl.duration;
      const fallback = this.trackDurationOf(this.currentTrack);
      this.duration = Number.isFinite(d) && d > 0 ? d : fallback;
      /* Cache once — avoid Map+render churn every timeupdate */
      if (
        Number.isFinite(d) &&
        d > 0 &&
        this.currentTrack &&
        !this.durationBySrc.has(this.currentTrack.src) &&
        !(typeof this.currentTrack.duration === 'number' && this.currentTrack.duration > 0)
      ) {
        this.rememberDuration(this.currentTrack.src, d);
      }
      this.updateLyrics();
    });
  }

  private onEnded(): void {
    this.emit('k3-ended', { index: this.trackIndex });
    this.next(true);
  }

  /* ── Interne : visuels ────────────────────────────────────────────────── */

  private shapeFor(track: AudioTrack | undefined): MaterialShapeName {
    if (track?.shape && track.shape in MATERIAL_SHAPE_SVG) return track.shape;
    const list = AudioPlayerSpecs.coverShapes;
    return list[this.trackIndex % list.length]!;
  }

  private onTrackVisuals(animate: boolean): void {
    /* MCU is heavy — never block first paint / track change morph */
    if (this.dynamicColor === 'on') {
      this.runIdle(() => void this.applyDynamicColor());
    } else {
      this.clearDynamicColor();
    }
    this.morphTo(this.shapeFor(this.currentTrack), animate);
    if (animate && !prefersReducedMotion()) {
      this.renderRoot.querySelectorAll<SVGElement>('.cover:not(.cover--mini) image').forEach((img) => {
        img.animate(
          [
            { opacity: 0.2, transform: 'scale(1.12)' },
            { opacity: 1, transform: 'scale(1)' },
          ],
          {
            duration: springs.expressive.spatial.slow.durationMs,
            easing: springs.expressive.spatial.slow.easing,
          },
        );
      });
    }
  }

  /** Durée affichée : champ track → cache metadata → 0. */
  private trackDurationOf(t: AudioTrack | undefined): number {
    if (!t) return 0;
    if (typeof t.duration === 'number' && t.duration > 0) return t.duration;
    return this.durationBySrc.get(t.src) ?? 0;
  }

  private rememberDuration(src: string, seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const rounded = Math.round(seconds);
    const prev = this.durationBySrc.get(src);
    if (prev !== undefined && Math.abs(prev - rounded) < 1) return;
    const next = new Map(this.durationBySrc);
    next.set(src, rounded);
    this.durationBySrc = next;
  }

  /** Prefetch duration metadata for queue rows (preload=metadata only). */
  private probeTrackDurations(): void {
    for (const t of this.tracks) {
      if (!t?.src || this.trackDurationOf(t) > 0) continue;
      const a = new Audio();
      a.preload = 'metadata';
      const src = t.src;
      a.addEventListener(
        'loadedmetadata',
        () => {
          this.rememberDuration(src, a.duration);
          a.removeAttribute('src');
          try {
            a.load();
          } catch {
            /* ignore */
          }
        },
        { once: true },
      );
      a.src = src;
    }
  }

  private morphTo(target: MaterialShapeName, animate = true): void {
    const from = this.shape;
    this.shape = target;
    this.morphAbort?.abort();
    if (!animate || from === target || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      this.coverD = MATERIAL_SHAPE_SVG[target];
      this.paintCover();
      return;
    }
    const ctrl = new AbortController();
    this.morphAbort = ctrl;
    void animateMaterialShapeMorph({
      from,
      to: target,
      duration: springs.expressive.spatial.slow.durationMs,
      signal: ctrl.signal,
      onFrame: (d: string) => {
        this.coverD = d;
        this.paintCover();
      },
    });
  }

  private cycleShape(): void {
    const list = AudioPlayerSpecs.coverShapes as readonly MaterialShapeName[];
    const i = list.indexOf(this.shape);
    this.morphTo(list[(i + 1) % list.length]!);
  }

  /** Applique `d` + rotation sur toutes les pochettes morphées (sans re-render Lit). */
  private paintCover(): void {
    const t = `translate(.5 .5) rotate(${this.rot.toFixed(2)}) scale(.96) translate(-.5 -.5)`;
    this.renderRoot?.querySelectorAll<SVGPathElement>('path.clip-shape').forEach((p) => {
      p.setAttribute('d', this.coverD);
      p.setAttribute('transform', t);
    });
  }

  private wake(): void {
    if (this.raf || typeof requestAnimationFrame !== 'function') return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.playing) {
      this.raf = 0;
      return;
    }
    if (!prefersReducedMotion()) {
      this.rot = (this.rot + dt * 9) % 360;
      this.paintCover();
    }
    this.syncSeekbars();
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Position fluide des seekbars à chaque frame (sans re-render du lecteur). */
  private syncSeekbars(): void {
    const t = this.audioEl?.currentTime ?? this.currentTime;
    this.renderRoot?.querySelectorAll<K3AudioSeek>('k3-audio-seek').forEach((s) => {
      if (!s.dragging) s.value = t;
    });
  }

  private async applyDynamicColor(): Promise<void> {
    const token = ++this.themeToken;
    const track = this.currentTrack;
    if (this.dynamicColor === 'off' || !track) {
      this.clearDynamicColor();
      return;
    }
    let seed = track.seed ?? null;
    if (!seed && track.artwork) seed = await seedFromArtwork(track.artwork);
    if (token !== this.themeToken || !this.isConnected) return;
    if (!seed) {
      this.clearDynamicColor();
      return;
    }
    const root = document.documentElement.dataset;
    try {
      const vars = await scopedSchemeVars(
        seed,
        isDarkContext(),
        root.k3ColorVariant ?? 'expressive',
        root.k3Contrast ?? 'default',
      );
      if (token !== this.themeToken || !this.isConnected) return;
      for (const [k, v] of Object.entries(vars)) this.style.setProperty(k, v);
    } catch {
      if (this.isConnected) this.clearDynamicColor();
      return;
    }
    this.repaintSeekbars();
  }

  private clearDynamicColor(): void {
    for (const key of COLOR_ROLES) {
      for (const k of Object.keys(sysColorCssVars(key, '#000000'))) this.style.removeProperty(k);
    }
    this.repaintSeekbars();
  }

  /** Les seekbars sont peintes en canvas : on les redessine après un changement de palette. */
  private repaintSeekbars(): void {
    if (!this.isConnected) return;
    const paint = () => {
      if (!this.isConnected) return;
      this.renderRoot?.querySelectorAll<K3AudioSeek>('k3-audio-seek').forEach((s) => s.repaint());
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(paint);
    else paint();
  }

  private updateLyrics(): void {
    if (!this.lyrics.length) return;
    const i = activeLyric(this.lyrics, this.currentTime);
    if (i === this.lyricIdx) return;
    this.lyricIdx = i;
    void this.updateComplete.then(() => {
      const pane = this.renderRoot.querySelector<HTMLElement>('.pane--lyrics');
      const el = this.renderRoot.querySelector<HTMLElement>(`.lyric[data-i="${Math.max(0, i)}"]`);
      if (!pane || !el || pane.hidden || performance.now() < this.userScrollUntil) return;
      pane.scrollTo({
        top: el.offsetTop - pane.clientHeight * 0.32,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    });
  }

  private setScrollLock(on: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.toggleAttribute('data-k3-audio-sheet-open', on);
    document.documentElement.style.overflow = on ? 'hidden' : '';
  }

  /**
   * Elevate host to body for:
   * - card sheet dialog (scrim above chrome)
   * - sticky dock (fixed bottom bar above chrome)
   */
  private syncDockLayer(): void {
    const sheet = this.expanded && this.canExpand;
    const dock = this.resolvedVariant === 'sticky' && !this.staged && !sheet;
    if (sheet) {
      this.setAttribute('data-sheet-open', '');
      this.removeAttribute('data-sticky-dock');
      this.stopFloatingChromeInset();
      this.portal.elevate(this);
      return;
    }
    this.removeAttribute('data-sheet-open');
    if (dock) {
      this.setAttribute('data-sticky-dock', '');
      this.startFloatingChromeInset();
      this.portal.elevate(this);
      return;
    }
    this.removeAttribute('data-sticky-dock');
    this.stopFloatingChromeInset();
    this.portal.restore(this);
  }

  private startFloatingChromeInset(): void {
    if (this.floatingChromeInset) {
      this.floatingChromeInset.sync();
      return;
    }
    this.floatingChromeInset = observeFloatingChromeInset();
  }

  private stopFloatingChromeInset(): void {
    this.floatingChromeInset?.disconnect();
    this.floatingChromeInset = null;
  }

  /** Toolbar ↔ sticky (sticky→toolbar only when `dock-toggle`, demo). */
  private toggleDock(): void {
    const v = this.resolvedVariant;
    if (v === 'toolbar') {
      this.expanded = false;
      this.variant = 'sticky';
      return;
    }
    if (v === 'sticky' && this.dockToggle) {
      this.expanded = false;
      this.variant = 'toolbar';
    }
  }

  private animateSheetIn(): void {
    void this.updateComplete.then(() => {
      const sheet = this.renderRoot.querySelector<HTMLElement>('.sheet');
      const scrim = this.renderRoot.querySelector<HTMLElement>('.scrim');
      if (!sheet) return;
      sheet.querySelector<HTMLElement>('.collapse')?.focus({ preventScroll: true });
      if (prefersReducedMotion()) return;
      if (typeof sheet.animate !== 'function') return;
      const m = springs.expressive.spatial.default;
      scrim?.animate?.([{ opacity: 0 }, { opacity: 1 }], {
        duration: Math.min(220, m.durationMs),
        easing: 'ease-out',
      });
      sheet.animate(
        [
          { transform: 'translateY(8%) scale(0.96)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: m.durationMs, easing: m.easing },
      );
    });
  }

  private handleHotkey(e: KeyboardEvent): void {
    /* Escape collapses UI even without hotkeys — but only for the visible target */
    if (e.key === 'Escape') {
      if (!this.isHotkeyTarget() && !this.expanded && !this.panelOpen && !this.barQueueOpen) return;
      if (this.closest('[hidden]')) return;
      if (this.barQueueOpen) {
        this.barQueueOpen = false;
        return;
      }
      if (this.panelOpen) {
        this.panelOpen = false;
        return;
      }
      if (this.expanded) {
        this.expanded = false;
        return;
      }
    }
    if (!this.isHotkeyTarget() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.composedPath()[0] as HTMLElement | undefined;
    if (t?.closest?.('input,textarea,select,[contenteditable="true"],[role="slider"]')) return;
    if (t?.localName === 'k3-slider' || t?.localName === 'k3-audio-seek') return;
    const key = e.key.toLowerCase();
    if (key === ' ' && t?.closest?.('button,a,k3-icon-button,k3-button')) return;
    const map: Record<string, () => void> = {
      ' ': () => this.toggle(),
      k: () => this.toggle(),
      arrowright: () => this.seek((this.audioEl?.currentTime ?? 0) + 5),
      arrowleft: () => this.seek((this.audioEl?.currentTime ?? 0) - 5),
      n: () => this.next(),
      p: () => this.prev(),
      m: () => this.setMusicMuted(!this.musicMuted),
      l: () => this.toggleLike(),
      s: () => (this.shuffle = !this.shuffle),
      r: () => this.cycleRepeat(),
    };
    const fn = map[key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  private toggleLike(): void {
    const t = this.currentTrack;
    if (!t) return;
    const next = new Set(this.liked);
    const on = !next.has(t.src);
    if (on) next.add(t.src);
    else next.delete(t.src);
    this.liked = next;
    this.emit('k3-like', { index: this.trackIndex, track: t, liked: on });
  }

  private cycleRepeat(): void {
    const modes = AudioPlayerSpecs.repeatModes;
    this.loop = false;
    this.loopPlaylist = false;
    this.repeat = modes[(modes.indexOf(this.repeatMode) + 1) % modes.length]!;
  }

  private cycleSpeed(): void {
    const s = AudioPlayerSpecs.speeds as readonly number[];
    this.speed = s[(s.indexOf(this.speed) + 1) % s.length]!;
    if (this.audioEl) this.audioEl.playbackRate = this.speed;
  }

  private onVolumeInput(e: Event): void {
    const v = Number((e as CustomEvent<{ value?: number }>).detail?.value) / 100;
    if (!Number.isFinite(v)) return;
    this.volume = Math.min(1, Math.max(0, v));
    if (this.musicMuted && this.volume > 0) {
      this.musicMuted = false;
      this.muted = false;
      writeMusicMuted(false);
    }
    if (!this.musicMuted && this.volume === 0) {
      this.musicMuted = true;
      this.muted = true;
      writeMusicMuted(true);
    }
    this.applyVolume();
  }

  private onSeekInput(e: Event): void {
    const v = (e as CustomEvent<{ value: number }>).detail.value;
    this.currentTime = v;
  }

  private onSeekChange(e: Event): void {
    this.seek((e as CustomEvent<{ value: number }>).detail.value);
  }

  /* ── Rendu : briques ──────────────────────────────────────────────────── */

  private renderAudio(track: AudioTrack | undefined) {
    return html`<audio
      part="audio"
      preload="metadata"
      @timeupdate=${() => this.onTimeUpdate()}
      @loadedmetadata=${() => this.onTimeUpdate()}
      @ended=${() => this.onEnded()}
      @play=${() => (this.playing = true)}
      @pause=${() => (this.playing = false)}
      @playing=${() => (this.loading = false)}
      @canplay=${() => (this.loading = false)}
      @waiting=${() => (this.loading = this.playing)}
      @error=${() => (this.loading = false)}
    >
      ${track
        ? html`<source src=${track.src} type=${track.type ?? guessType(track.src)} />
            ${track.srcAlt
              ? html`<source src=${track.srcAlt} type=${track.typeAlt ?? guessType(track.srcAlt)} />`
              : nothing}`
        : nothing}
    </audio>`;
  }

  /** Pochette clipée par une forme Material (morph + rotation pendant la lecture). */
  private renderCover(kind: 'lg' | 'md' | 'mini', key: string) {
    const track = this.currentTrack;
    const art = track?.artwork;
    const id = `${this.uid}-${key}`;
    const mini = kind === 'mini';
    const d = mini ? MATERIAL_SHAPE_SVG[AudioPlayerSpecs.miniShape] : this.coverD;
    const content = svg`
      <defs>
        <clipPath id=${id} clipPathUnits="objectBoundingBox">
          <path class=${mini ? '' : 'clip-shape'} d=${d}></path>
        </clipPath>
      </defs>
      <g clip-path=${`url(#${id})`}>
        <rect class="fill-rect" width="1" height="1"></rect>
        ${art ? svg`<image href=${art} width="1" height="1" preserveAspectRatio="xMidYMid slice"></image>` : nothing}
      </g>`;
    const fallback = art ? nothing : html`<span class="fallback">${icon('music_note')}</span>`;
    if (mini) {
      return html`<span class="cover cover--mini" part="artwork"
        ><svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">${content}</svg>${fallback}</span
      >`;
    }
    return html`<button
      type="button"
      class="cover cover--${kind} k3-focus-ring"
      part="artwork"
      aria-label=${tr('shape', 'Change cover shape', 'Changer la forme de la pochette')}
      @click=${() => this.cycleShape()}
    >
      ${kind === 'lg' ? html`<span class="cover-glow" aria-hidden="true"></span>` : nothing}
      <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${content}</svg>
      ${fallback}
    </button>`;
  }

  private renderMetaLine(kind: 'title' | 'artist', text: string) {
    return html`<div
      class=${kind}
      part=${kind}
      title=${text}
      aria-label=${text}
    >
      <div class="meta-marquee" data-line=${kind}>
        <div class="meta-track">
          <span class="meta-label">${text}</span>
          <span class="meta-label ghost" aria-hidden="true">${text}</span>
        </div>
      </div>
    </div>`;
  }

  private renderMeta() {
    const track = this.currentTrack;
    const artist = [track?.artist, this.resolvedVariant === 'full' || this.expanded ? track?.album : undefined]
      .filter(Boolean)
      .join(' · ');
    const title = track?.title ?? tr('noTrack', 'No track', 'Aucun titre');
    return html`<div class="meta" part="meta" aria-live="polite">
      ${this.renderMetaLine('title', title)}
      ${artist ? this.renderMetaLine('artist', artist) : nothing}
    </div>`;
  }

  /** Wrap a control in a plain k3-tooltip. */
  private tip(
    content: string,
    child: unknown,
    position: 'top' | 'bottom' | 'top-end' | 'bottom-end' | 'start' | 'end' = 'top',
  ) {
    return html`<k3-tooltip content=${content} position=${position}>${child}</k3-tooltip>`;
  }

  private volumeGlyph(): string {
    const v = this.musicMuted ? 0 : this.volume;
    return v === 0 ? 'volume_off' : v < 0.45 ? 'volume_down' : 'volume_up';
  }

  private closeVolumePopover(): void {
    this.volumeDismiss?.detach();
    this.volumeDismiss = null;
    if (this.volumeOpen) this.volumeOpen = false;
  }

  private openVolumePopover(): void {
    this.volumeOpen = true;
    void this.updateComplete.then(() => {
      this.volumeDismiss?.detach();
      const host =
        (this.renderRoot?.querySelector('.extras-row[data-vol-open], .utility[data-vol-open], .bar-extras[data-vol-open]') as
          | HTMLElement
          | null) ??
        this.volTriggerEl ??
        this;
      this.volumeDismiss = attachOutsideDismiss(host, {
        isActive: () => this.volumeOpen,
        onDismiss: () => this.closeVolumePopover(),
      });
    });
  }

  private toggleVolumePopover(): void {
    if (this.volumeOpen) this.closeVolumePopover();
    else this.openVolumePopover();
  }

  /**
   * Icon-only `k3-button` for connected button-groups (same pattern as playground
   * star/heart/mood). Standalone chrome keeps `k3-icon-button`.
   */
  private groupIconButton(
    opts: {
      part: string;
      size: 'sm' | 'md';
      label: string;
      glyph: string;
      glyphClass?: string;
      selected?: boolean;
      expanded?: boolean;
      onClick: () => void;
    },
  ) {
    return this.tip(
      opts.label,
      html`<k3-button
        part=${opts.part}
        variant="tonal"
        size=${opts.size}
        .selected=${!!opts.selected}
        aria-label=${opts.label}
        aria-expanded=${opts.expanded === undefined ? nothing : opts.expanded ? 'true' : 'false'}
        @k3-click=${opts.onClick}
        >${icon(opts.glyph, 'icon', opts.glyphClass ?? '')}</k3-button
      >`,
    );
  }

  /** Speaker trigger — connected group child (`k3-button` + icon slot). */
  private renderVolumeButton(size: 'sm' | 'md' = 'sm') {
    const openLabel = tr('volume', 'Volume', 'Volume');
    return this.groupIconButton({
      part: 'volume-open',
      size,
      label: openLabel,
      glyph: this.volumeGlyph(),
      selected: this.volumeOpen,
      expanded: this.volumeOpen,
      onClick: () => this.toggleVolumePopover(),
    });
  }

  /** Android-style mute + slider — sibling of the button-group, centered above. */
  private renderVolumeToolbar() {
    if (!this.volumeOpen) return nothing;
    const openLabel = tr('volume', 'Volume', 'Volume');
    const muteLabel = this.musicMuted
      ? tr('unmute', 'Unmute music', 'Réactiver la musique')
      : tr('mute', 'Mute music', 'Couper la musique');
    const v = this.musicMuted ? 0 : this.volume;
    return html`<div class="vol-toolbar" part="volume-toolbar" role="dialog" aria-label=${openLabel}>
      <k3-icon-button
        part="mute"
        variant="standard"
        size="xs"
        toggle
        .selected=${this.musicMuted}
        label=${muteLabel}
        @k3-click=${() => this.setMusicMuted(!this.musicMuted)}
        >${icon(this.volumeGlyph())}</k3-icon-button
      >
      <k3-slider
        part="volume"
        size="xs"
        min="0"
        max="100"
        step="1"
        value-indicator
        .value=${Math.round(v * 100)}
        label=${openLabel}
        @k3-input=${(e: Event) => this.onVolumeInput(e)}
        @k3-change=${(e: Event) => this.onVolumeInput(e)}
      ></k3-slider>
    </div>`;
  }

  private openQueuePanel(): void {
    this.tab = 'queue';
    this.panelOpen = true;
  }

  private get isBarChrome(): boolean {
    const v = this.resolvedVariant;
    return v === 'toolbar' || v === 'sticky';
  }

  private get panelSurfaceOpen(): boolean {
    if (this.isBarChrome) return this.barQueueOpen;
    return this.panelOpen;
  }

  /** One control for queue + lyrics — sheet / bar panel owns the À suivre · Paroles segmented. */
  private togglePanelSurface(): void {
    if (this.isBarChrome) {
      this.barQueueOpen = !this.barQueueOpen;
      if (this.barQueueOpen && this.tab === 'lyrics') {
        this.lyricIdx = -2;
        this.updateLyrics();
      }
      return;
    }
    if (this.canExpand && !this.expanded) this.expanded = true;
    if (this.panelOpen) this.panelOpen = false;
    else this.openQueuePanel();
  }

  /**
   * Connected media extras:
   * repeat · shuffle · like · [queue/lyrics] · [share] · [download] · volume · [speed].
   * Share / download only when `extended` (full / sheet). Speed only full / sheet.
   * Compact never shows queue/lyrics. Overflow drops queue/lyrics via `mediaExtrasCompact`.
   */
  private renderMediaExtras(
    size: 'sm' | 'md' = 'sm',
    includeSpeed = false,
    extended = false,
  ) {
    const label = tr('mediaExtras', 'Playback options', 'Options de lecture');
    const likeOn = !!this.currentTrack && this.liked.has(this.currentTrack.src);
    const panelOpen = this.panelSurfaceOpen;
    const hidePanelBtn =
      this.resolvedVariant === 'compact' || this.mediaExtrasCompact;
    const panelBtn = hidePanelBtn
      ? nothing
      : this.groupIconButton({
          part: 'playlist',
          size,
          label: panelOpen
            ? tr('hidePlaylist', 'Hide queue & lyrics', 'Masquer la file et les paroles')
            : tr('playlist', 'Queue & lyrics', 'File d’attente et paroles'),
          glyph: 'queue_music',
          selected: panelOpen,
          expanded: panelOpen,
          onClick: () => this.togglePanelSurface(),
        });
    const shareBtn =
      extended && this.showShare
        ? this.groupIconButton({
            part: 'share',
            size,
            label: tr('share', 'Share', 'Partager'),
            glyph: 'share',
            onClick: () => void this.shareTrack(),
          })
        : nothing;
    const downloadBtn =
      extended && this.showDownload
        ? this.groupIconButton({
            part: 'download',
            size,
            label: tr('download', 'Download', 'Télécharger'),
            glyph: 'download',
            onClick: () => this.downloadTrack(),
          })
        : nothing;
    const speedLabel = tr('speed', 'Playback speed: {v}×', 'Vitesse de lecture : {v}×', {
      v: this.speed.toLocaleString(i18n.locale),
    });
    const speedBtn = includeSpeed
      ? this.tip(
          speedLabel,
          html`<k3-button
            part="speed"
            class="speed"
            variant="tonal"
            size=${size}
            aria-label=${speedLabel}
            @k3-click=${() => this.cycleSpeed()}
            >${this.speed.toLocaleString(i18n.locale)}×</k3-button
          >`,
        )
      : nothing;
    return html`<div class="extras-row" part="extras" ?data-vol-open=${this.volumeOpen}>
      <k3-button-group
        part="media-seg"
        variant="connected"
        selection="none"
        size=${size}
        shape="round"
        sync
        label=${label}
      >
        ${this.groupIconButton({
          part: 'repeat',
          size,
          label: {
            off: tr('repeatOff', 'Repeat: off', 'Répéter : désactivé'),
            all: tr('repeatAll', 'Repeat: all', 'Répéter : toute la file'),
            one: tr('repeatOne', 'Repeat: one', 'Répéter : ce titre'),
          }[this.repeatMode],
          glyph: this.repeatMode === 'one' ? 'repeat_one' : 'repeat',
          selected: this.repeatMode !== 'off',
          onClick: () => this.cycleRepeat(),
        })}
        ${this.groupIconButton({
          part: 'shuffle',
          size,
          label: this.shuffle
            ? tr('shuffleOn', 'Shuffle: on', 'Aléatoire : activé')
            : tr('shuffleOff', 'Shuffle: off', 'Aléatoire : désactivé'),
          glyph: 'shuffle',
          selected: this.shuffle,
          onClick: () => (this.shuffle = !this.shuffle),
        })}
        ${this.groupIconButton({
          part: 'like',
          size,
          label: likeOn
            ? tr('unlike', 'Unlike', 'Je n’aime plus')
            : tr('like', 'Like', "J'aime"),
          glyph: 'favorite',
          glyphClass: likeOn ? 'fill' : '',
          selected: likeOn,
          onClick: () => this.toggleLike(),
        })}
        ${panelBtn}
        ${shareBtn}
        ${downloadBtn}
        ${this.renderVolumeButton(size)}
        ${speedBtn}
      </k3-button-group>
      ${this.renderVolumeToolbar()}
    </div>`;
  }

  private renderSeek(thickness: number, handle: number) {
    const max = Math.max(0.001, this.duration || this.currentTrack?.duration || 0.001);
    const style: AudioSeekStyle =
      this.seekStyle === 'oscillation' ? 'oscillation' : 'wave';
    const src = this.currentTrack?.src ?? '';
    return html`<k3-audio-seek
      part="seek"
      mode=${style}
      src=${style === 'oscillation' ? src : ''}
      .value=${this.currentTime}
      .max=${max}
      .playing=${this.playing}
      .thickness=${thickness}
      .handle=${handle}
      label=${tr('seek', 'Seek', 'Position')}
      value-text=${`${formatTime(this.currentTime)} / ${formatTime(max)}`}
      @k3-input=${(e: Event) => this.onSeekInput(e)}
      @k3-change=${(e: Event) => this.onSeekChange(e)}
    ></k3-audio-seek>`;
  }

  private renderTimes(inline = false) {
    const dur = this.duration || this.currentTrack?.duration || 0;
    return inline
      ? html`<span class="times" part="times">${formatTime(this.currentTime)} / ${formatTime(dur)}</span>`
      : html`<div class="times" part="times">
          <span>${formatTime(this.currentTime)}</span><span>${formatTime(dur)}</span>
        </div>`;
  }

  /**
   * Transport — Noph homepage pattern:
   * `k3-button-group` standard + `selection="none"` (keeps filled play),
   * prev/next tonal narrow (vertical pills), play filled wide (horizontal),
   * press = corner morph + neighbor width morph; playing = selected squircle.
   * Skip ±N only on full.
   */
  private renderTransport(kind: 'bar' | 'card' | 'compact' | 'full' | 'phone') {
    const cfg = {
      bar: { side: 'sm', sideW: 'narrow', sideV: 'tonal', play: 'sm', playW: 'wide' },
      /* Same size on prev / play / next — play stays wide, sides narrow */
      compact: { side: 'md', sideW: 'narrow', sideV: 'tonal', play: 'md', playW: 'wide' },
      card: { side: 'md', sideW: 'narrow', sideV: 'tonal', play: 'md', playW: 'wide' },
      full: { side: 'md', sideW: 'narrow', sideV: 'tonal', play: 'md', playW: 'wide' },
      /* One step above card (md → lg) for all three */
      phone: { side: 'lg', sideW: 'narrow', sideV: 'tonal', play: 'lg', playW: 'wide' },
    }[kind];
    const track = this.currentTrack;
    const playLabel = this.playing ? tr('pause', 'Pause', 'Pause') : tr('play', 'Play', 'Lecture');
    const prevLabel = tr('prev', 'Previous', 'Précédent');
    const nextLabel = tr('next', 'Next', 'Suivant');
    const backSec = kind === 'full' && this.skipBack > 0 ? Math.round(this.skipBack) : 0;
    const fwdSec = kind === 'full' && this.skipForward > 0 ? Math.round(this.skipForward) : 0;
    const backLabel = tr('skipBack', 'Back {n} seconds', 'Reculer de {n} s', { n: backSec });
    const fwdLabel = tr('skipForward', 'Forward {n} seconds', 'Avancer de {n} s', { n: fwdSec });
    return html`<k3-button-group
      class="transport"
      part="transport"
      variant="standard"
      selection="none"
      shape="round"
      label=${tr('transport', 'Playback controls', 'Contrôles de lecture')}
    >
      ${this.tip(
        prevLabel,
        html`<k3-icon-button
          class=${kind === 'bar' ? 'bar-prev' : ''}
          part="prev"
          variant=${cfg.sideV}
          size=${cfg.side}
          width=${cfg.sideW}
          shape="round"
          label=${prevLabel}
          ?disabled=${!this.tracks.length}
          @k3-click=${() => this.prev()}
          >${icon('skip_previous')}</k3-icon-button
        >`,
      )}
      ${backSec
        ? this.tip(
            backLabel,
            html`<k3-icon-button
              part="skip-back"
              variant=${cfg.sideV}
              size=${cfg.side}
              width=${cfg.sideW}
              shape="round"
              label=${backLabel}
              ?disabled=${!track}
              @k3-click=${() => this.skipBy(-backSec)}
              >${skipSecIcon(backSec, 'back')}</k3-icon-button
            >`,
          )
        : nothing}
      ${this.tip(
        playLabel,
        html`<k3-icon-button
          class="play"
          part="play"
          variant="filled"
          size=${cfg.play}
          width=${cfg.playW}
          shape="round"
          .selected=${this.playing}
          label=${playLabel}
          ?disabled=${!track}
          @k3-click=${() => this.toggle()}
        >
          ${this.loading
            ? html`<k3-loading-indicator aria-hidden="true"></k3-loading-indicator>`
            : icon(this.playing ? 'pause' : 'play_arrow', undefined, 'fill')}
        </k3-icon-button>`,
      )}
      ${fwdSec
        ? this.tip(
            fwdLabel,
            html`<k3-icon-button
              part="skip-forward"
              variant=${cfg.sideV}
              size=${cfg.side}
              width=${cfg.sideW}
              shape="round"
              label=${fwdLabel}
              ?disabled=${!track}
              @k3-click=${() => this.skipBy(fwdSec)}
              >${skipSecIcon(fwdSec, 'forward')}</k3-icon-button
            >`,
          )
        : nothing}
      ${this.tip(
        nextLabel,
        html`<k3-icon-button
          part="next"
          variant=${cfg.sideV}
          size=${cfg.side}
          width=${cfg.sideW}
          shape="round"
          label=${nextLabel}
          ?disabled=${!this.tracks.length}
          @k3-click=${() => this.next()}
          >${icon('skip_next')}</k3-icon-button
        >`,
      )}
    </k3-button-group>`;
  }

  private renderQueue() {
    const indices = this.shuffle ? this.order : [...this.tracks.keys()];
    return html`<k3-list class="queue" part="queue" variant="segmented" label=${tr('queue', 'Up next', 'À suivre')}>
      ${repeat(
        indices,
        (i) => `${this.tracks[i]?.src}#${i}`,
        (i) => {
          const t = this.tracks[i]!;
          const cur = i === this.trackIndex;
          const dur = this.trackDurationOf(t);
          /* lines=three : titre + supporting (artiste · durée, clamp 2) */
          const supporting =
            t.artist && dur > 0
              ? html`${t.artist}<br /><span class="q-dur">${formatTime(dur)}</span>`
              : t.artist
                ? t.artist
                : dur > 0
                  ? html`<span class="q-dur">${formatTime(dur)}</span>`
                  : nothing;
          return html`<k3-list-item
            interactive
            leading="image"
            lines="three"
            ?selected=${cur}
            @k3-click=${() => this.playIndex(i)}
          >
            <span slot="leading" class=${classMap({ 'q-thumb': true, 'is-current': cur })}
              >${t.artwork
                ? html`<img
                    src=${t.artwork}
                    alt=""
                    draggable="false"
                    loading="lazy"
                    decoding="async"
                    width="56"
                    height="56"
                  />`
                : icon('music_note')}</span
            >
            <span slot="headline">${t.title ?? tr('noTrack', 'No track', 'Aucun titre')}</span>
            ${supporting !== nothing ? html`<span slot="supporting">${supporting}</span>` : nothing}
            <span slot="trailing" class="q-trail">
              ${cur ? html`<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>` : nothing}
              <k3-icon-button
                variant="standard"
                size="xs"
                label=${tr('remove', 'Remove “{title}” from queue', 'Retirer « {title} » de la file', {
                  title: t.title ?? '',
                })}
                @click=${(e: Event) => e.stopPropagation()}
                @k3-click=${(e: Event) => {
                  e.stopPropagation();
                  this.removeTrack(i);
                }}
                >${icon('close')}</k3-icon-button
              >
            </span>
          </k3-list-item>`;
        },
      )}
    </k3-list>`;
  }

  private renderLyrics() {
    if (!this.lyrics.length) {
      return html`<div class="empty">
        <span class="empty-art" aria-hidden="true"
          ><svg viewBox="0 0 1 1"><path d=${MATERIAL_SHAPE_SVG.Cookie9Sided}></path></svg>${icon('lyrics')}</span
        >
        <p>${tr('noLyrics', 'No lyrics for this track.', 'Pas de paroles pour ce titre.')}</p>
        <p class="hint">
          ${tr('noLyricsHint', 'Add an LRC “lyrics” field to show synced lyrics.', 'Ajoute un champ « lyrics » au format LRC pour les afficher en synchro.')}
        </p>
      </div>`;
    }
    return html`<div class="lyrics" part="lyrics">
      ${this.lyrics.map(
        (l, i) => html`<button
          type="button"
          class=${classMap({
            lyric: true,
            'k3-focus-ring': true,
            'k3-state-layer': true,
            'is-active': i === this.lyricIdx,
            'is-past': i < this.lyricIdx,
          })}
          data-i=${i}
          @click=${() => {
            this.seek(l.time);
            if (!this.playing) void this.play();
          }}
        >
          ${l.text || '♪'}
        </button>`,
      )}
    </div>`;
  }

  private renderPanelTabs() {
    const segments = JSON.stringify([
      { label: tr('queue', 'Up next', 'À suivre'), icon: 'queue_music', value: 'queue' },
      { label: tr('lyrics', 'Lyrics', 'Paroles'), icon: 'lyrics', value: 'lyrics' },
    ]);
    return html`<k3-button-segmented
      class="tabs"
      segments=${segments}
      selected-indices=${JSON.stringify([this.tab === 'queue' ? 0 : 1])}
      aria-label=${tr('panel', 'Side panel', 'Panneau latéral')}
      @k3-change=${(e: Event) => {
        const d = (e as CustomEvent<{ values?: string[]; indices?: number[] }>).detail;
        const v = d?.values?.[0] ?? (d?.indices?.[0] === 1 ? 'lyrics' : 'queue');
        this.tab = v === 'lyrics' ? 'lyrics' : 'queue';
        if (this.tab === 'lyrics') {
          this.lyricIdx = -2;
          this.updateLyrics();
        }
      }}
    ></k3-button-segmented>`;
  }

  private renderPanel(phone: boolean) {
    return html`<aside
      class=${classMap({ panel: true, 'is-open': this.panelOpen })}
      part="panel"
      ?inert=${phone && !this.panelOpen}
      aria-hidden=${phone && !this.panelOpen ? 'true' : 'false'}
    >
      ${phone
        ? html`<div class="panel-head">
            <span class="grip" aria-hidden="true"></span>
            <k3-icon-button
              variant="standard"
              size="sm"
              label=${tr('closePanel', 'Close panel', 'Fermer le panneau')}
              @k3-click=${() => (this.panelOpen = false)}
              >${icon('close')}</k3-icon-button
            >
          </div>`
        : nothing}
      ${this.renderPanelTabs()}
      <div class="pane k3-scroll" ?hidden=${this.tab !== 'queue'}>${this.renderQueue()}</div>
      <div
        class="pane pane--lyrics k3-scroll"
        ?hidden=${this.tab !== 'lyrics'}
        @wheel=${() => (this.userScrollUntil = performance.now() + 4000)}
        @touchmove=${() => (this.userScrollUntil = performance.now() + 4000)}
      >
        ${this.renderLyrics()}
      </div>
    </aside>`;
  }

  /* ── Rendu : gabarits ─────────────────────────────────────────────────── */

  private renderCard() {
    const compact = this.resolvedVariant === 'compact';
    return html`<k3-card class="card" variant="elevated" part="container">
      <div class="card-body">
        ${this.renderCover('md', 'card')}
        <div class="card-head">
          ${this.renderMeta()}
          ${this.canExpand
            ? this.tip(
                tr('expand', 'Open player', 'Ouvrir le lecteur'),
                html`<k3-icon-button
                  variant="standard"
                  size="sm"
                  label=${tr('expand', 'Open player', 'Ouvrir le lecteur')}
                  @k3-click=${() => (this.expanded = true)}
                  >${icon('open_in_full')}</k3-icon-button
                >`,
              )
            : nothing}
        </div>
        <div class="seek-block">${this.renderSeek(compact ? 4 : 6, compact ? 24 : 28)} ${this.renderTimes()}</div>
        <div class="controls">
          ${this.renderTransport(compact ? 'compact' : 'card')}
        </div>
        ${this.renderMediaExtras('sm')}
        ${compact ? nothing : html`<div class="utility">${this.renderSpeedChip()}</div>`}
      </div>
    </k3-card>`;
  }

  private renderSpeedChip(withTip = true) {
    const label = tr('speed', 'Playback speed: {v}×', 'Vitesse de lecture : {v}×', {
      v: this.speed.toLocaleString(i18n.locale),
    });
    const btn = html`<k3-button
      class="speed"
      part="speed"
      variant="tonal"
      size=${withTip ? 'xs' : 'sm'}
      aria-label=${label}
      @k3-click=${() => this.cycleSpeed()}
      >${this.speed.toLocaleString(i18n.locale)}×</k3-button
    >`;
    return withTip ? this.tip(label, btn) : btn;
  }

  private renderBar() {
    const v = this.resolvedVariant;
    const canToggle =
      v === 'toolbar' || (v === 'sticky' && this.dockToggle);
    const label =
      v === 'sticky' && this.dockToggle
        ? tr('unpinSticky', 'Return player to demo', 'Remettre le lecteur dans la démo')
        : v === 'toolbar'
          ? tr('pinSticky', 'Pin player to bottom', 'Épingler le lecteur en bas')
          : nothing;
    return html`<div class=${classMap({ bar: true, 'has-queue': this.barQueueOpen })} part="container">
      ${this.barQueueOpen
        ? html`<div
            class="bar-queue"
            part="bar-queue"
            role="region"
            aria-label=${this.tab === 'lyrics'
              ? tr('lyrics', 'Lyrics', 'Paroles')
              : tr('queue', 'Up next', 'À suivre')}
          >
            ${this.renderPanelTabs()}
            <div class="bar-queue-inner k3-scroll">
              ${this.tab === 'lyrics' ? this.renderLyrics() : this.renderQueue()}
            </div>
          </div>`
        : nothing}
      <div class="bar-inner">
        <button
          type="button"
          class="bar-open k3-focus-ring"
          ?disabled=${!canToggle}
          aria-label=${label}
          @click=${() => this.toggleDock()}
        >
          ${this.renderCover('mini', 'bar')} ${this.renderMeta()}
        </button>
        <div class="bar-controls">
          ${this.renderTransport('bar')}
          <div class="bar-extras">${this.renderMediaExtras('sm')}</div>
        </div>
        <div class="bar-seek">${this.renderSeek(4, 20)} ${this.renderTimes(true)}</div>
      </div>
    </div>`;
  }

  /** Grand lecteur (variante `full`, `phone` ou sheet plein écran). */
  private renderFull(mode: 'full' | 'phone' | 'sheet') {
    const phone = mode === 'phone';
    const pos = this.order.indexOf(this.trackIndex) + 1;
    return html`<section
      class=${classMap({ full: true, 'is-phone': phone, sheet: mode === 'sheet' })}
      part=${mode === 'sheet' ? 'sheet' : 'container'}
      role=${mode === 'sheet' ? 'dialog' : nothing}
      aria-modal=${mode === 'sheet' ? 'true' : nothing}
      aria-label=${mode === 'sheet' ? tr('ariaLabel', 'Audio player', 'Lecteur audio') : nothing}
    >
      <div class="ambient" aria-hidden="true"><i></i><i></i><i></i></div>
      ${phone
        ? nothing
        : html`<header class="topbar">
            ${mode === 'sheet'
              ? this.tip(
                  tr('collapse', 'Collapse player', 'Réduire le lecteur'),
                  html`<k3-icon-button
                    class="collapse"
                    variant="tonal"
                    size="md"
                    label=${tr('collapse', 'Collapse player', 'Réduire le lecteur')}
                    @k3-click=${() => (this.expanded = false)}
                    >${icon('keyboard_arrow_down')}</k3-icon-button
                  >`,
                )
              : nothing}
            <div class="topbar-label">
              <span class="overline">${tr('nowPlaying', 'Now playing', 'Lecture en cours')}</span>
              <span class="context"
                >${tr('position', 'Track {n} of {total}', 'Titre {n} sur {total}', {
                  n: pos,
                  total: this.tracks.length,
                })}</span
              >
            </div>
          </header>`}
      <div class="body">
        <div class="now">
          ${this.renderCover('lg', mode)}
          <div class="now-meta">${this.renderMeta()}</div>
          <div class="seek-block">${this.renderSeek(6, 32)} ${this.renderTimes()}</div>
          <div class="controls">${this.renderTransport(phone ? 'phone' : 'full')}</div>
          <div class="utility">
            ${this.renderMediaExtras('sm', !phone, mode === 'full' || mode === 'sheet')}
          </div>
        </div>
        ${phone ? nothing : this.renderPanel(false)}
      </div>
      ${phone ? this.renderPanel(true) : nothing}
    </section>`;
  }

  override render() {
    const track = this.currentTrack;
    const v = this.resolvedVariant;
    let main;
    if (v === 'toolbar' || v === 'sticky') main = this.renderBar();
    else if (v === 'phone') main = this.renderFull('phone');
    else if (v === 'full') main = this.renderFull('full');
    else main = this.renderCard();
    const sheet =
      this.expanded && this.canExpand
        ? html`<div class="scrim" @click=${() => (this.expanded = false)}></div>
            ${this.renderFull('sheet')}`
        : nothing;
    return html`${this.renderAudio(track)}${main}${sheet}`;
  }
}

export default K3AudioPlayer;

if (!customElements.get('k3-audio-player')) {
  customElements.define('k3-audio-player', K3AudioPlayer);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-audio-player': K3AudioPlayer;
    'k3-audio-seek': K3AudioSeek;
  }
}
