import { html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../_shared.js';
import { textScrambleStyles } from './text-scramble.styles.js';

/** Anime.js `chars` named presets (Unicode ranges expanded at runtime). */
export const SCRAMBLE_CHAR_PRESETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  symbols: '!%#_|*+=',
  /** U+2800…U+28FF */
  braille: '',
  /** U+2580…U+259F */
  blocks: '',
  shades: '░▒▓█',
  default: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!%#_',
} as const;

export type ScrambleCharPreset = keyof typeof SCRAMBLE_CHAR_PRESETS;
export type ScrambleFrom = 'left' | 'center' | 'right' | 'random';

export const TextScrambleSpecs = {
  revealRate: 55,
  settleRate: 28,
  settleDurationMs: 280,
  loopDelayMs: 2000,
  fps: 30,
} as const;

function rangeChars(from: number, to: number): string {
  let out = '';
  for (let c = from; c <= to; c++) out += String.fromCodePoint(c);
  return out;
}

const BRAILLE = rangeChars(0x2800, 0x28ff);
const BLOCKS = rangeChars(0x2580, 0x259f);

function expandChars(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === 'braille') return BRAILLE;
  if (key === 'blocks') return BLOCKS;
  if (key === 'shades') return SCRAMBLE_CHAR_PRESETS.shades;
  if (key === 'numbers') return SCRAMBLE_CHAR_PRESETS.numbers;
  if (key === 'lowercase') return SCRAMBLE_CHAR_PRESETS.lowercase;
  if (key === 'uppercase') return SCRAMBLE_CHAR_PRESETS.uppercase;
  if (key === 'symbols') return SCRAMBLE_CHAR_PRESETS.symbols;
  if (key === 'default' || key === '') return SCRAMBLE_CHAR_PRESETS.default;
  return expandRanges(raw);
}

function expandRanges(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const a = s[i]!;
    const b = s[i + 1];
    const c = s[i + 2];
    if (b === '-' && c && a !== '-' && c !== '-') {
      const start = a.codePointAt(0)!;
      const end = c.codePointAt(0)!;
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let cp = lo; cp <= hi; cp++) out += String.fromCodePoint(cp);
      i += 2;
    } else {
      out += a;
    }
  }
  return out || SCRAMBLE_CHAR_PRESETS.default;
}

function pickRandom(pool: string): string {
  if (!pool.length) return '?';
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function revealOrder(len: number, from: ScrambleFrom): number[] {
  const idx = Array.from({ length: len }, (_, i) => i);
  if (from === 'right') return idx.reverse();
  if (from === 'random') {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    }
    return idx;
  }
  if (from === 'center') {
    const mid = (len - 1) / 2;
    return [...idx].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  }
  return idx;
}

/**
 * Scramble text reveal — Anime.js `scrambleText` vibe, no dependency.
 * Renders a single text node (no per-glyph spans) so spacing / centering stay natural.
 */
export class K3TextScramble extends K3Element {
  static override styles = [hostReset, textScrambleStyles];

  @property() text =
    'scrambleText() allows you to reveal a text via a smooth randomized character scramble transition effect.';
  /** Named preset (`braille` · `blocks` · `numbers` …) or a literal / range string. */
  @property() chars: ScrambleCharPreset | (string & {}) = 'default';
  @property({ reflect: true }) from: ScrambleFrom = 'left';
  @property({ type: Boolean, reflect: true }) loop = false;
  @property({ type: Boolean }) autoplay = true;
  @property({ type: Number, attribute: 'loop-delay' }) loopDelay =
    TextScrambleSpecs.loopDelayMs;
  @property({ type: Number, attribute: 'reveal-rate' }) revealRate =
    TextScrambleSpecs.revealRate;
  @property({ type: Number, attribute: 'settle-rate' }) settleRate =
    TextScrambleSpecs.settleRate;

  /** Visible string — one node in the DOM (avoids span-induced gaps / off-center). */
  @state() private shown = '';

  private raf = 0;
  private loopTimer = 0;
  private running = false;
  private gen = 0;
  private suppressAutoplay = false;
  private resolvePlay: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute('role')) this.setAttribute('role', 'text');
    this.shown = this.text;
  }

  override disconnectedCallback(): void {
    this.stop();
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    if (this.autoplay) void this.play();
  }

  override updated(changed: Map<string, unknown>): void {
    if (this.suppressAutoplay || !this.autoplay) return;
    if (changed.has('text') && !this.running) {
      void this.play();
      return;
    }
    if ((changed.has('chars') || changed.has('from')) && !this.running) {
      void this.play();
    }
  }

  /** Run a scramble toward `next` (or current `text`). Resolves when settled. */
  play(next?: string): Promise<void> {
    if (next != null && next !== this.text) {
      this.suppressAutoplay = true;
      this.text = next;
      this.suppressAutoplay = false;
    }
    const target = this.text;
    this.stop();
    this.shown = target;

    if (prefersReducedMotion() || !target.length) {
      this.shown = target;
      this.requestUpdate();
      return Promise.resolve();
    }

    const pool = expandChars(String(this.chars));
    const order = revealOrder(target.length, this.from);
    const gen = ++this.gen;
    this.running = true;

    const revealMs = Math.max(8, 1000 / Math.max(1, this.revealRate));
    const settleMs = Math.max(8, 1000 / Math.max(1, this.settleRate));
    const frameMs = 1000 / TextScrambleSpecs.fps;

    let revealed = 0;
    let lastReveal = performance.now();
    let lastTick = lastReveal;
    const settled = new Array<boolean>(target.length).fill(false);
    const glyphs = [...target];

    const paint = (display: string[]): void => {
      this.shown = display.join('');
      this.requestUpdate();
    };

    paint(glyphs.map((ch) => (ch === ' ' || ch === '\n' ? ch : pickRandom(pool))));

    return new Promise<void>((resolve) => {
      this.resolvePlay = resolve;
      const step = (now: number): void => {
        if (gen !== this.gen) return;

        if (now - lastReveal >= revealMs && revealed < order.length) {
          const n = Math.max(1, Math.floor((now - lastReveal) / revealMs));
          for (let k = 0; k < n && revealed < order.length; k++) {
            settled[order[revealed]!] = true;
            revealed++;
          }
          lastReveal = now;
        }

        if (now - lastTick >= frameMs) {
          lastTick = now;
          paint(
            glyphs.map((ch, i) => {
              if (ch === ' ' || ch === '\n' || settled[i]) return ch;
              return pickRandom(pool);
            }),
          );
        }

        if (revealed < order.length) {
          this.raf = requestAnimationFrame(step);
          return;
        }

        const settleEnd = now + TextScrambleSpecs.settleDurationMs;
        const settle = (t: number): void => {
          if (gen !== this.gen) return;
          if (t < settleEnd) {
            if (t - lastTick >= settleMs) {
              lastTick = t;
              paint([...glyphs]);
            }
            this.raf = requestAnimationFrame(settle);
            return;
          }
          paint([...glyphs]);
          this.running = false;
          this.resolvePlay = null;
          resolve();
          if (this.loop) {
            this.loopTimer = window.setTimeout(() => {
              if (gen === this.gen) void this.play();
            }, Math.max(0, this.loopDelay));
          }
        };
        this.raf = requestAnimationFrame(settle);
      };

      this.raf = requestAnimationFrame(step);
    });
  }

  stop(): void {
    this.gen++;
    this.running = false;
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = 0;
    }
    const done = this.resolvePlay;
    this.resolvePlay = null;
    done?.();
  }

  restart(): void {
    void this.play();
  }

  override render() {
    return html`<p class="stage" aria-label=${this.text}>${this.shown || this.text}</p>`;
  }
}

export default K3TextScramble;

if (!customElements.get('k3-text-scramble')) {
  customElements.define('k3-text-scramble', K3TextScramble);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-text-scramble': K3TextScramble;
  }
}
