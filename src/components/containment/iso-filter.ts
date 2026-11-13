import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../_shared.js';
import { packMasonryItems } from './masonry-pack.js';
import { isoFilterStyles } from './iso-filter.styles.js';

export const IsoFilterSpecs = {
  filter: '*',
  layout: 'masonry' as IsoFilterLayout,
  gap: 8,
  columnWidth: 72,
} as const;

export type IsoFilterLayout = 'masonry' | 'grid';

/**
 * Isotope-style filter over slotted items (`data-filter` / `data-category`).
 * Masonry packing is built-in (no Isotope.js dependency).
 *
 * ```html
 * <k3-iso-filter filter="*" layout="masonry" column-width="72">
 *   <div slot="filters">…filter controls…</div>
 *   <div data-filter="alkali">Li</div>
 * </k3-iso-filter>
 * ```
 *
 * @fires k3-filter-change — `{ filter }`
 */
export class K3IsoFilter extends K3Element {
  static override styles = [hostReset, ...isoFilterStyles];

  @property({ reflect: true }) filter: string = IsoFilterSpecs.filter;
  @property({ reflect: true }) layout: IsoFilterLayout = IsoFilterSpecs.layout;
  @property({ type: Number }) gap: number = IsoFilterSpecs.gap;
  @property({ type: Number, attribute: 'column-width' }) columnWidth: number =
    IsoFilterSpecs.columnWidth;

  private ro?: ResizeObserver;
  private raf = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('k3-change', this.onFilterUi);
    this.ro = new ResizeObserver(() => this.scheduleLayout());
    this.ro.observe(this);
  }

  override disconnectedCallback(): void {
    this.removeEventListener('k3-change', this.onFilterUi);
    this.ro?.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    super.disconnectedCallback();
  }

  override firstUpdated(): void {
    this.renderRoot.querySelector('slot:not([name])')?.addEventListener('slotchange', () => {
      this.applyFilter();
    });
    this.applyFilter();
  }

  override updated(changed: Map<string, unknown>): void {
    if (
      changed.has('filter') ||
      changed.has('gap') ||
      changed.has('columnWidth') ||
      changed.has('layout')
    ) {
      this.applyFilter();
    }
  }

  setFilter(value: string): void {
    this.filter = value || '*';
  }

  refresh(): void {
    this.applyFilter();
  }

  private onFilterUi = (e: Event): void => {
    const path = e.composedPath();
    const filtersHost = this.querySelector('[slot="filters"]');
    const fromFilters =
      !!filtersHost &&
      path.some((n) => n === filtersHost || (n instanceof Node && filtersHost.contains(n)));
    if (!fromFilters) return;
    const detail = (
      e as CustomEvent<{
        value?: string;
        values?: string[];
        chip?: { value?: string; selected?: boolean };
        selected?: boolean;
      }>
    ).detail;
    let next =
      detail?.values?.[0] ??
      detail?.value ??
      detail?.chip?.value?.trim() ??
      undefined;
    if (next == null) {
      const t = e.target as HTMLElement | null;
      next = t?.getAttribute('data-filter-value') || t?.getAttribute('value') || undefined;
    }
    if (next == null || next === '') return;
    if (next === this.filter) return;
    this.filter = next;
    this.emit('k3-filter-change', { filter: next });
  };

  private items(): HTMLElement[] {
    const slot = this.renderRoot.querySelector('slot:not([name])') as HTMLSlotElement | null;
    const assigned = (slot?.assignedElements({ flatten: true }) ?? []) as HTMLElement[];
    return assigned.filter(
      (el) => el.hasAttribute('data-filter') || el.hasAttribute('data-category'),
    );
  }

  private applyFilter(): void {
    const active = (this.filter || '*').trim();
    const grid = this.layout === 'grid';
    for (const el of this.items()) {
      const tokens = `${el.getAttribute('data-filter') || ''} ${el.getAttribute('data-category') || ''}`
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const show = active === '*' || tokens.includes(active);
      if (show) {
        el.removeAttribute('data-hidden');
        if (grid) el.style.display = '';
      } else {
        el.setAttribute('data-hidden', '');
        if (grid) el.style.display = 'none';
      }
    }
    this.scheduleLayout();
  }

  private scheduleLayout(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.pack();
    });
  }

  private pack(): void {
    const board = this.renderRoot.querySelector('.board') as HTMLElement | null;
    if (this.layout !== 'masonry') {
      for (const el of this.items()) {
        el.style.position = '';
        el.style.top = '';
        el.style.left = '';
        el.style.width = '';
        el.style.opacity = '';
        el.style.pointerEvents = '';
        el.style.transition = '';
      }
      if (board) board.style.height = '';
      return;
    }
    if (!board) return;
    const h = packMasonryItems(board, this.items(), {
      gap: this.gap,
      columnWidth: this.columnWidth,
      animate: !prefersReducedMotion(),
    });
    board.style.position = 'relative';
    board.style.height = `${h}px`;
  }

  override render() {
    return html`
      <div class="toolbar" part="toolbar">
        <slot name="filters"></slot>
      </div>
      <div
        class="board"
        part="board"
        data-layout=${this.layout}
        style=${this.layout === 'grid' ? `--k3-iso-filter-gap:${this.gap}px` : ''}
      >
        <slot></slot>
      </div>
    `;
  }
}

export default K3IsoFilter;

if (!customElements.get('k3-iso-filter')) {
  customElements.define('k3-iso-filter', K3IsoFilter);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-iso-filter': K3IsoFilter;
  }
}
