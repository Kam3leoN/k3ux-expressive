import { html, nothing, type PropertyValues } from 'lit';
import { property, query, queryAll, state } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion, isRtl } from 'k3ui';
import { sanitizeHTMLDetailed, type SanitizeOptions } from 'k3ui';
import { hostReset } from '../_shared.js';
import {
  MarqueeSpecs,
  marqueeOffset,
  marqueeItemStations,
  crossedMarqueeStation,
  positiveMod,
  type MarqueeDirection,
  type MarqueeMode,
  type MarqueeStart,
  type MarqueeVariant,
} from './marquee.specs.js';
import { marqueeStyles } from './marquee.styles.js';

export {
  MarqueeSpecs,
  durationFromSpeed,
  marqueeOffset,
  marqueeItemStations,
  crossedMarqueeStation,
  positiveMod,
  type MarqueeMode,
  type MarqueeDirection,
  type MarqueeStart,
  type MarqueeVariant,
} from './marquee.specs.js';

/** Options for text vs sanitized HTML content. */
export interface MarqueeContentOptions {
  /** Treat strings as HTML — sanitized with an allowlist (no script, no handlers, safe URLs). */
  html?: boolean;
}

type PauseReason = 'api' | 'hover' | 'focus';

/**
 * Marquee — continuous or classic scrolling of any content (text, logos, chips…),
 * modelled on MarqueeJS: speed in px/s, four directions, auto clones, pause on
 * hover / focus, automatic pause off-screen and in hidden tabs.
 *
 * - `mode="infinite"` (default): seamless loop. `start="filled"` covers the track
 *   from the first frame; `start="edge"` makes the content enter from the far edge.
 * - `mode="classic"`: one copy crosses the whole viewport, from edge to edge.
 * - `pause-at-items`: dwell when each item’s start reaches the near edge, then scroll
 *   until the next item’s start arrives (`item-pause` seconds).
 *
 * ```html
 * <k3-marquee speed="80" pause-on-hover>
 *   <span>Breaking · </span><span>News · </span>
 * </k3-marquee>
 * <k3-marquee pause-at-items item-pause="1.5" speed="60" gap="48">
 *   <span>One</span><span>Two</span><span>Three</span>
 * </k3-marquee>
 * ```
 *
 * @fires k3-pause — `{ source }` when paused by the API / a control
 * @fires k3-play — `{ source }` when resumed by the API / a control
 * @fires k3-item-pause — `{ index, offset }` when an item dwell starts
 * @csspart viewport — clipping area (edge fade)
 * @csspart track — moving strip
 * @csspart set — one copy of the content
 * @cssprop --k3-marquee-gap — space between items and copies (from `gap`)
 * @cssprop --k3-marquee-fade — edge fade length (0% to disable)
 * @cssprop --k3-marquee-height — height for `up` / `down`
 */
export class K3Marquee extends K3Element {
  static override styles = [hostReset, marqueeStyles];

  /** `infinite` (seamless loop) or `classic` (edge-to-edge pass). */
  @property({ reflect: true }) mode: MarqueeMode = MarqueeSpecs.mode;
  /** Scroll direction. */
  @property({ reflect: true }) direction: MarqueeDirection = MarqueeSpecs.direction;
  /** Infinite mode: `filled` (already covered) or `edge` (enters from the far edge). */
  @property({ reflect: true, attribute: 'start' }) startFrom: MarqueeStart = MarqueeSpecs.start;
  /** Speed in px/s (MarqueeJS). When unset, `duration` sets the loop time. */
  @property({ type: Number }) speed: number | null = null;
  /** Seconds per loop when `speed` is not set. */
  @property({ type: Number }) duration = MarqueeSpecs.duration;
  /** Space between items and copies (px). */
  @property({ type: Number }) gap = MarqueeSpecs.gap;
  /** Pause while the pointer is over the marquee. */
  @property({ type: Boolean, attribute: 'pause-on-hover', reflect: true })
  pauseOnHover = MarqueeSpecs.pauseOnHover;
  /** Pause while focus is inside (keyboard users can read / activate links). */
  @property({ type: Boolean, attribute: 'pause-on-focus' }) pauseOnFocus = MarqueeSpecs.pauseOnFocus;
  /**
   * Pause when each slotted item’s start reaches the near edge, then resume until
   * the next item’s start arrives (news-ticker / station style).
   */
  @property({ type: Boolean, attribute: 'pause-at-items', reflect: true })
  pauseAtItems = MarqueeSpecs.pauseAtItems;
  /** Dwell duration at each item when `pause-at-items` is on (seconds). */
  @property({ type: Number, attribute: 'item-pause' }) itemPause = MarqueeSpecs.itemPause;
  /** Start moving on connect. */
  @property({ type: Boolean, reflect: true }) autoplay = MarqueeSpecs.autoplay;
  /** Paused by the API or a control (hover / focus pauses are temporary and not reflected). */
  @property({ type: Boolean, reflect: true }) paused = false;
  /** Copies of the content: `auto` (enough to fill) or a number (max 15). */
  @property({ attribute: 'clone-count' }) cloneCount: 'auto' | number | string = 'auto';
  /** Text shown between copies (e.g. `•`). */
  @property() separator = '';

  /** Text size — a number (px) or a CSS length (`26`, `1.5rem`, `clamp(…)` not allowed). */
  @property({ attribute: 'text-size' }) textSize: string | number | null = null;
  /** Text font family (`"Google Sans", system-ui, sans-serif`). */
  @property({ attribute: 'text-font' }) textFont: string | null = null;
  /** Text weight (100–900, `normal`, `bold`). */
  @property({ attribute: 'text-weight' }) textWeight: string | number | null = null;
  /** Grab the content (mouse, pen, finger) to move it; scrolling resumes on release. */
  @property({ type: Boolean, reflect: true }) drag = false;
  /** Pause while the page scrolls, resume shortly after. */
  @property({ type: Boolean, attribute: 'pause-on-scroll' }) pauseOnScroll = false;
  /** Band surface: `plain` · `tonal` · `filled` · `outlined`. */
  @property({ reflect: true }) variant: MarqueeVariant = MarqueeSpecs.variant;
  /**
   * HTML you do not control (CMS, API, users) — sanitized with an allowlist before
   * it replaces the content: no script / style / iframe / svg, no event handlers,
   * no `style` / `id`, only safe URLs. Fires `k3-sanitize` when something is removed.
   */
  @property({ attribute: false }) html: string | null = null;
  /** Sanitizer limits for `html` / `{ html: true }` content. */
  @property({ attribute: false }) sanitizeOptions: SanitizeOptions = {};

  @state() private hasLabel = false;
  @state() private copies = 1;
  @state() private reduced = false;

  @query('.viewport') private viewportEl?: HTMLElement;
  @query('.track') private trackEl?: HTMLElement;
  @queryAll('.set') private setEls!: NodeListOf<HTMLElement>;

  private distance = 0;
  private lastTime = 0;
  private frame = 0;
  private hovered = false;
  private focused = false;
  private onScreen = true;
  private viewportSize = 0;
  private setSize = 0;
  private period = 0;
  private trackSize = 0;
  private stations: number[] = [];
  private prevLocal = 0;
  private dwellUntil = 0;
  private skipStation: number | null = null;
  private ro?: ResizeObserver;
  private io?: IntersectionObserver;
  private mql?: MediaQueryList;
  private mo?: MutationObserver;
  private contentFrame = 0;
  private dragging = false;
  private dragPointer = -1;
  private dragLast = 0;
  private dragMoved = 0;
  private scrolling = false;
  private scrollTimer = 0;
  private loopCount = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    if (!this.autoplay && !this.hasAttribute('paused')) this.paused = true;
    this.reduced = prefersReducedMotion();
    if (typeof matchMedia === 'function') {
      this.mql = matchMedia('(prefers-reduced-motion: reduce)');
      this.mql.addEventListener?.('change', this.onMotionPref);
    }
    this.addEventListener('pointerenter', this.onPointerEnter);
    this.addEventListener('pointerleave', this.onPointerLeave);
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('scroll', this.onPageScroll, { capture: true, passive: true });
    watchDirection(this);
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        this.onScreen = entries.some((e) => e.isIntersecting);
        this.syncLoop();
      });
      this.io.observe(this);
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.recalculate());
      this.ro.observe(this);
    }
    /* Text / attribute edits inside items (translations, live data) do not fire
       slotchange — refresh the copies when the content itself changes. */
    if (typeof MutationObserver !== 'undefined') {
      this.mo = new MutationObserver(() => this.onContentMutation());
      this.mo.observe(this, { subtree: true, childList: true, characterData: true, attributes: true });
    }
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.ro?.disconnect();
    this.io?.disconnect();
    this.mo?.disconnect();
    cancelAnimationFrame(this.contentFrame);
    this.mql?.removeEventListener?.('change', this.onMotionPref);
    this.removeEventListener('pointerenter', this.onPointerEnter);
    this.removeEventListener('pointerleave', this.onPointerLeave);
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('focusout', this.onFocusOut);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('scroll', this.onPageScroll, { capture: true });
    clearTimeout(this.scrollTimer);
    unwatchDirection(this);
    super.disconnectedCallback();
  }

  /* ── Public API (MarqueeJS names + previous k3 names) ─────────────────── */

  /** Resume scrolling (previous API). */
  play(): void {
    this.resume();
  }

  /** Pause scrolling (previous API — keeps the position). */
  stop(): void {
    this.pause();
  }

  /** Start / resume scrolling. */
  start(): void {
    this.resume();
  }

  pause(source: PauseReason = 'api'): void {
    if (this.paused) return;
    this.paused = true;
    this.emit('k3-pause', { source });
  }

  resume(source: PauseReason = 'api'): void {
    if (!this.paused) return;
    this.paused = false;
    this.emit('k3-play', { source });
  }

  toggle(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  /** Back to the starting position (edge or filled). */
  restart(): void {
    this.distance = 0;
    this.lastTime = 0;
    this.loopCount = 0;
    this.dwellUntil = 0;
    this.skipStation = null;
    this.prevLocal = this.scrollLocal(0);
    this.applyTransform();
    if (this.pauseAtItems && this.stations.length) this.beginItemDwell(0, this.stations[0]!);
  }

  /** Re-measure (after fonts / images load or layout changes). */
  recalculate(): void {
    const viewport = this.viewportEl;
    const track = this.trackEl;
    const sets = this.setEls;
    const first = sets?.[0];
    if (!viewport || !track || !first) return;
    /* The track is laid out LTR whatever the page direction (stable geometry);
       the content keeps its own reading direction. */
    viewport.dataset.contentDir = isRtl(this) ? 'rtl' : 'ltr';
    const vertical = this.isVertical;
    const size = (el: HTMLElement) => (vertical ? el.offsetHeight : el.offsetWidth);
    const pos = (el: HTMLElement) => (vertical ? el.offsetTop : el.offsetLeft);
    this.viewportSize = vertical ? viewport.clientHeight : viewport.clientWidth;
    this.setSize = size(first);
    this.trackSize = size(track);
    const second = sets[1];
    this.period = second ? Math.abs(pos(second) - pos(first)) : this.setSize + Math.max(0, this.gap);
    this.measureStations();
    const wanted = this.wantedCopies();
    if (wanted !== this.copies) this.copies = wanted;
    this.applyTransform();
  }

  /** Append an item: element, text, or HTML with `{ html: true }` (sanitized). */
  addContent(content: string | Node, options: MarqueeContentOptions = {}): void {
    this.append(this.toNode(content, options));
  }

  /** Replace the items (the `label` slot is kept). Strings are text unless `{ html: true }`. */
  replaceContent(items: ReadonlyArray<string | Node>, options: MarqueeContentOptions = {}): void {
    const kept = Array.from(this.children).filter((el) => el.hasAttribute('slot'));
    this.replaceChildren(...kept, ...items.map((item) => this.toNode(item, options)));
  }

  /** Text of each item, in order (the label is not an item). */
  getContentList(): string[] {
    return Array.from(this.children)
      .filter((el) => !el.hasAttribute('slot'))
      .map((el) => el.textContent?.trim() ?? '');
  }

  /** Text → `<span>`; HTML → sanitized fragment wrapped in one item `<span>`. */
  private toNode(content: string | Node, options: MarqueeContentOptions): Node {
    if (typeof content !== 'string') return content;
    const item = document.createElement('span');
    if (options.html) item.append(this.sanitize(content));
    else item.textContent = content;
    return item;
  }

  private sanitize(html: string): DocumentFragment {
    const { fragment, removed } = sanitizeHTMLDetailed(html, this.sanitizeOptions);
    if (removed.length) this.emit('k3-sanitize', { removed });
    return fragment;
  }

  /** True while the marquee is actually moving. */
  get running(): boolean {
    return (
      !this.paused &&
      !this.hovered &&
      !this.focused &&
      !this.dragging &&
      !this.scrolling &&
      !this.reduced &&
      this.onScreen &&
      !document.hidden
    );
  }

  /* ── Internals ──────────────────────────────────────────────────────── */

  private get isVertical(): boolean {
    return this.direction === 'up' || this.direction === 'down';
  }

  private get pxPerSecond(): number {
    if (this.speed != null && this.speed > 0) return this.speed;
    const lap = this.mode === 'classic' ? this.viewportSize + this.setSize : this.period;
    return lap > 0 ? lap / Math.max(0.1, this.duration) : 0;
  }

  private wantedCopies(): number {
    if (this.mode === 'classic') return 1;
    const explicit = Number(this.cloneCount);
    if (this.cloneCount !== 'auto' && Number.isFinite(explicit)) {
      return 1 + Math.min(MarqueeSpecs.maxClones, Math.max(0, Math.round(explicit)));
    }
    if (this.period <= 0) return 2;
    return 1 + Math.min(MarqueeSpecs.maxClones, Math.max(1, Math.ceil(this.viewportSize / this.period)));
  }

  private onPointerEnter = (e: PointerEvent): void => {
    if (!this.pauseOnHover || e.pointerType === 'touch') return;
    this.hovered = true;
    this.syncLoop();
  };

  private onPointerLeave = (): void => {
    if (!this.hovered) return;
    this.hovered = false;
    this.syncLoop();
  };

  private onFocusIn = (): void => {
    if (!this.pauseOnFocus) return;
    this.focused = true;
    this.syncLoop();
  };

  private onFocusOut = (e: FocusEvent): void => {
    if (e.relatedTarget instanceof Node && this.contains(e.relatedTarget)) return;
    this.focused = false;
    this.syncLoop();
  };

  private onVisibility = (): void => this.syncLoop();

  private onMotionPref = (): void => {
    this.reduced = prefersReducedMotion();
  };

  private onContentMutation(): void {
    if (this.contentFrame || typeof requestAnimationFrame !== 'function') return;
    this.contentFrame = requestAnimationFrame(() => {
      this.contentFrame = 0;
      this.fillClones();
      this.recalculate();
    });
  }

  private onSlotChange = (): void => {
    this.fillClones();
    requestAnimationFrame(() => this.recalculate());
  };

  /** Copies are deep clones of the slotted content — hidden from assistive tech, not focusable. */
  private fillClones(): void {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot:not([name])');
    const nodes = slot?.assignedNodes({ flatten: true }) ?? [];
    this.renderRoot.querySelectorAll<HTMLElement>('.set.clone').forEach((set) => {
      set.replaceChildren(...nodes.map((n) => n.cloneNode(true)));
    });
  }

  private updateStateAttr(): void {
    const viewport = this.viewportEl;
    if (!viewport) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const dwelling = this.pauseAtItems && this.dwellUntil > now;
    viewport.dataset.state = this.reduced
      ? 'reduced'
      : !this.running
        ? 'paused'
        : dwelling
          ? 'dwelling'
          : 'playing';
  }

  private syncLoop(): void {
    this.updateStateAttr();
    if (this.running && !this.frame && typeof requestAnimationFrame === 'function') {
      this.lastTime = 0;
      this.frame = requestAnimationFrame(this.tick);
    } else if (!this.running && this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  /** Progress along the looping axis used for item stations (after edge entry). */
  private scrollLocal(distance = this.distance): number {
    if (this.mode === 'classic') {
      const lap = this.viewportSize + this.setSize;
      return lap > 0 ? positiveMod(distance, lap) : 0;
    }
    if (this.period <= 0) return 0;
    if (this.startFrom === 'edge') {
      if (distance < this.viewportSize) return -1; /* still entering — no stations yet */
      return positiveMod(distance - this.viewportSize, this.period);
    }
    return positiveMod(distance, this.period);
  }

  /** Item start offsets inside one set (prefer a clone — real nodes, not a slot). */
  private measureStations(): void {
    if (!this.pauseAtItems || this.mode !== 'infinite') {
      this.stations = [];
      return;
    }
    const sets = this.setEls;
    const measureSet =
      [...(sets ?? [])].find((s) => s.classList.contains('clone') && s.childElementCount > 0) ??
      sets?.[0];
    if (!measureSet || this.period <= 0) {
      this.stations = [];
      return;
    }
    const vertical = this.isVertical;
    const setRect = measureSet.getBoundingClientRect();
    const kids = Array.from(measureSet.children).filter((n): n is HTMLElement => n instanceof HTMLElement);
    const offsets = kids.map((el) => {
      const r = el.getBoundingClientRect();
      return vertical ? r.top - setRect.top : r.left - setRect.left;
    });
    this.stations = marqueeItemStations(offsets, this.period);
    /* First paint at a station (filled @ 0): dwell immediately so item 0 is readable. */
    if (this.stations.length && this.dwellUntil === 0 && this.distance === 0 && this.startFrom !== 'edge') {
      const at = this.stations[0]!;
      if (at <= 0.5) this.beginItemDwell(0, at);
    }
  }

  private beginItemDwell(index: number, offset: number): void {
    const ms = Math.max(0, this.itemPause) * 1000;
    this.dwellUntil = (typeof performance !== 'undefined' ? performance.now() : Date.now()) + ms;
    this.skipStation = offset;
    this.prevLocal = offset;
    this.emit('k3-item-pause', { index, offset });
    this.updateStateAttr();
  }

  private tick = (time: number): void => {
    this.frame = 0;
    if (!this.running) {
      this.updateStateAttr();
      return;
    }

    /* Station dwell — hold position, keep the rAF alive for the timer */
    if (this.pauseAtItems && this.dwellUntil > time) {
      this.lastTime = time;
      this.updateStateAttr();
      this.frame = requestAnimationFrame(this.tick);
      return;
    }

    const prevLocal = this.prevLocal;
    if (this.lastTime) {
      /* Time-based: same speed at 30, 60 or 120 Hz; big gaps (tab switch) are clamped */
      const dt = Math.min(0.1, (time - this.lastTime) / 1000);
      this.distance += this.pxPerSecond * dt;
    }
    this.lastTime = time;

    /* Item stations — infinite mode only (item start ↔ near edge). */
    if (this.pauseAtItems && this.mode === 'infinite' && this.stations.length && this.period > 0) {
      const local = this.scrollLocal();
      if (local >= 0) {
        /* Just finished edge entry → first item is on the near edge */
        if (prevLocal < 0) {
          const first = this.stations[0]!;
          if (first <= local + 0.5 && first !== this.skipStation) {
            const cycles = Math.floor(Math.max(0, this.distance - this.viewportSize) / this.period);
            this.distance = this.viewportSize + cycles * this.period + first;
            this.beginItemDwell(0, first);
            this.applyTransform();
            this.frame = requestAnimationFrame(this.tick);
            return;
          }
        }
        const from = prevLocal < 0 ? 0 : prevLocal;
        const hit = crossedMarqueeStation(from, local, this.stations, this.period);
        if (hit != null && hit !== this.skipStation) {
          /* Snap so the item start sits on the near edge */
          if (this.startFrom === 'edge') {
            const cycles = Math.floor(Math.max(0, this.distance - this.viewportSize) / this.period);
            this.distance = this.viewportSize + cycles * this.period + hit;
          } else {
            const cycles = Math.floor(this.distance / this.period);
            this.distance = cycles * this.period + hit;
          }
          const index = Math.max(0, this.stations.indexOf(hit));
          this.beginItemDwell(index, hit);
          this.applyTransform();
          this.frame = requestAnimationFrame(this.tick);
          return;
        }
        if (hit == null) this.skipStation = null;
        this.prevLocal = local;
      } else {
        this.prevLocal = local;
      }
    }

    this.applyTransform();
    this.emitLoops();
    this.updateStateAttr();
    this.frame = requestAnimationFrame(this.tick);
  };

  /** `k3-loop` once per completed lap (`count` = laps since start / restart). */
  private emitLoops(): void {
    const lap = this.mode === 'classic' ? this.viewportSize + this.setSize : this.period;
    if (lap <= 0) return;
    const entry = this.mode === 'infinite' && this.startFrom === 'edge' ? this.viewportSize : 0;
    const count = Math.floor((this.distance - entry) / lap);
    if (count > this.loopCount) {
      this.loopCount = count;
      this.emit('k3-loop', { count });
    }
  }

  /* ── Drag (mouse, pen, touch) ─────────────────────────────────────────── */

  private onDragStart = (e: PointerEvent): void => {
    if (!this.drag || this.reduced || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const viewport = this.viewportEl;
    if (!viewport) return;
    this.dragging = true;
    this.dragPointer = e.pointerId;
    this.dragLast = this.isVertical ? e.clientY : e.clientX;
    this.dragMoved = 0;
    viewport.setPointerCapture?.(e.pointerId);
    viewport.dataset.dragging = '';
    this.syncLoop();
  };

  private onDragMove = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.dragPointer) return;
    const at = this.isVertical ? e.clientY : e.clientX;
    const delta = at - this.dragLast;
    this.dragLast = at;
    this.dragMoved += Math.abs(delta);
    /* Pulling the content along its travel direction advances it */
    const forward = this.direction === 'left' || this.direction === 'up' ? -delta : delta;
    this.distance += forward;
    this.applyTransform();
  };

  private onDragEnd = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.dragPointer) return;
    this.dragging = false;
    this.dragPointer = -1;
    const viewport = this.viewportEl;
    if (viewport) {
      if (viewport.hasPointerCapture?.(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
      delete viewport.dataset.dragging;
    }
    /* Item stations restart from where the user left the content */
    this.dwellUntil = 0;
    this.skipStation = null;
    this.prevLocal = this.scrollLocal();
    this.lastTime = 0;
    this.syncLoop();
  };

  /** A drag is not a click: links inside are not followed after moving the content. */
  private onClickCapture = (e: MouseEvent): void => {
    if (this.dragMoved > 5) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.dragMoved = 0;
  };

  private onPageScroll = (): void => {
    if (!this.pauseOnScroll) return;
    this.scrolling = true;
    this.syncLoop();
    clearTimeout(this.scrollTimer);
    this.scrollTimer = window.setTimeout(() => {
      this.scrolling = false;
      this.syncLoop();
    }, 180);
  };

  private onLabelSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this.hasLabel = slot.assignedNodes({ flatten: true }).some(
      (n) => n.nodeType === Node.ELEMENT_NODE || (n.textContent ?? '').trim() !== '',
    );
  };

  private applyTransform(): void {
    const track = this.trackEl;
    if (!track) return;
    if (this.reduced) {
      track.style.transform = '';
      return;
    }
    const value = marqueeOffset(this.distance, {
      mode: this.mode,
      start: this.startFrom,
      viewport: this.viewportSize,
      period: this.period,
      setSize: this.setSize,
    });
    /* left / up move towards the start edge. right / down are mirrored, and the
       reversed track is anchored to the far edge (viewport − track). */
    const mirrored = this.direction === 'right' || this.direction === 'down';
    const v = mirrored ? this.viewportSize - this.trackSize - value : value;
    track.style.transform = this.isVertical ? `translate3d(0, ${v}px, 0)` : `translate3d(${v}px, 0, 0)`;
  }

  override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('gap')) this.style.setProperty('--k3-marquee-gap', `${Math.max(0, this.gap)}px`);
    if (changed.has('textSize')) {
      const size = cssLength(this.textSize);
      setVar(this, '--k3-marquee-font-size', size);
      /* A fixed inherited line-height (px) would clip bigger text — use a ratio */
      setVar(this, '--k3-marquee-line-height', size ? '1.3' : null);
    }
    if (changed.has('textFont')) setVar(this, '--k3-marquee-font-family', cssFontFamily(this.textFont));
    if (changed.has('textWeight')) setVar(this, '--k3-marquee-font-weight', cssFontWeight(this.textWeight));
    if (changed.has('html') && this.html != null) {
      const kept = Array.from(this.children).filter((el) => el.hasAttribute('slot'));
      this.replaceChildren(...kept, this.sanitize(this.html));
    }
    if (changed.has('mode') || changed.has('startFrom') || changed.has('direction')) {
      this.distance = 0;
      this.dwellUntil = 0;
      this.skipStation = null;
      this.prevLocal = 0;
    }
    if (changed.has('pauseAtItems') && !this.pauseAtItems) {
      this.dwellUntil = 0;
      this.stations = [];
      this.skipStation = null;
    }
  }

  private observedSet: HTMLElement | null = null;

  override updated(changed: PropertyValues): void {
    super.updated(changed);
    /* Items can grow after the first measure (images, web fonts): watch the content too */
    const set = this.setEls?.[0] ?? null;
    if (set && set !== this.observedSet) {
      if (this.observedSet) this.ro?.unobserve(this.observedSet);
      this.ro?.observe(set);
      this.observedSet = set;
    }
    if (changed.has('copies') || changed.has('separator') || changed.has('mode')) this.fillClones();
    if (
      changed.has('copies') ||
      changed.has('gap') ||
      changed.has('mode') ||
      changed.has('direction') ||
      changed.has('separator') ||
      changed.has('cloneCount') ||
      changed.has('pauseAtItems')
    ) {
      requestAnimationFrame(() => this.recalculate());
    }
    this.syncLoop();
  }

  override render() {
    const axis = this.isVertical ? 'y' : 'x';
    const sep = this.separator
      ? html`<span class="sep" aria-hidden="true">${this.separator}</span>`
      : nothing;
    return html`
      <div class="band" part="band">
      <div class="label" part="label" ?hidden=${!this.hasLabel}>
        <slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
      </div>
      <div
        class="viewport"
        part="viewport"
        data-axis=${axis}
        data-direction=${this.direction}
        data-state="paused"
        @pointerdown=${this.onDragStart}
        @pointermove=${this.onDragMove}
        @pointerup=${this.onDragEnd}
        @pointercancel=${this.onDragEnd}
        @click=${{ handleEvent: this.onClickCapture, capture: true }}
      >
        <div class="track" part="track">
          <div class="set" part="set"><slot @slotchange=${this.onSlotChange}></slot></div>
          ${Array.from(
            { length: Math.max(0, this.copies - 1) },
            () => html`${sep}<div class="set clone" part="set" aria-hidden="true" inert></div>`,
          )}
        </div>
      </div>
      </div>
    `;
  }
}

/* ── Text style values (validated: anything else falls back to inherit) ── */

function setVar(el: HTMLElement, name: string, value: string | null): void {
  if (value) el.style.setProperty(name, value);
  else el.style.removeProperty(name);
}

/** `26` → `26px`; `1.5rem`, `120%`… kept; anything else (functions, var(), url()) refused. */
export function cssLength(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const v = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(v)) return `${v}px`;
  if (/^\d+(\.\d+)?(px|rem|em|%|vw|vh|vmin|vmax|pt|ch|ex|lh)$/i.test(v)) return v.toLowerCase();
  return null;
}

/** Font family list: names, quotes, commas, hyphens only (no `;`, `{`, `url(`…). */
export function cssFontFamily(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v || v.length > 200) return null;
  return /^[\p{L}\p{N}\s"',._-]+$/u.test(v) ? v : null;
}

/** 1–1000, `normal`, `bold`, `lighter`, `bolder`. */
export function cssFontWeight(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const v = String(raw).trim().toLowerCase();
  if (/^(normal|bold|lighter|bolder)$/.test(v)) return v;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? String(n) : null;
}

/* ── Page direction: one observer for every marquee ────────────────────── */

const directionWatchers = new Set<K3Marquee>();
let directionObserver: MutationObserver | null = null;

/** Re-measure when the page flips LTR ↔ RTL (`dir` on <html> or <body>). */
function watchDirection(el: K3Marquee): void {
  directionWatchers.add(el);
  if (directionObserver || typeof MutationObserver === 'undefined') return;
  directionObserver = new MutationObserver(() => {
    directionWatchers.forEach((m) => requestAnimationFrame(() => m.recalculate()));
  });
  directionObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] });
  if (document.body) directionObserver.observe(document.body, { attributes: true, attributeFilter: ['dir'] });
}

function unwatchDirection(el: K3Marquee): void {
  directionWatchers.delete(el);
  if (directionWatchers.size === 0) {
    directionObserver?.disconnect();
    directionObserver = null;
  }
}

export default K3Marquee;

if (!customElements.get('k3-marquee')) {
  customElements.define('k3-marquee', K3Marquee);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-marquee': K3Marquee;
  }
}
