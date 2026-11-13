import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { K3Element, prefersReducedMotion } from 'k3ui';
import { hostReset } from '../_shared.js';
import { packMasonryItems } from './masonry-pack.js';
import { masonryStyles } from './masonry.styles.js';

export const MasonrySpecs = {
  gap: 8,
  columnWidth: 180,
} as const;

/**
 * Cascading masonry layout for slotted children (no Isotope.js dependency).
 *
 * ```html
 * <k3-masonry gap="12" column-width="200">
 *   <div>Card A</div>
 *   <div>Card B</div>
 * </k3-masonry>
 * ```
 */
export class K3Masonry extends K3Element {
  static override styles = [hostReset, masonryStyles];

  @property({ type: Number }) gap: number = MasonrySpecs.gap;
  @property({ type: Number, attribute: 'column-width' }) columnWidth: number =
    MasonrySpecs.columnWidth;
  @property({ type: Number }) columns = 0;

  private ro?: ResizeObserver;
  private mo?: MutationObserver;
  private raf = 0;
  private items: HTMLElement[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.ro = new ResizeObserver(() => this.scheduleLayout());
    this.ro.observe(this);
    this.mo = new MutationObserver(() => this.collectAndLayout());
  }

  override firstUpdated(): void {
    this.renderRoot.querySelector('slot')?.addEventListener('slotchange', () => this.collectAndLayout());
    this.collectAndLayout();
  }

  override disconnectedCallback(): void {
    this.ro?.disconnect();
    this.mo?.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('gap') || changed.has('columnWidth') || changed.has('columns')) {
      this.scheduleLayout();
    }
  }

  layout(): void {
    this.pack();
  }

  private collectAndLayout(): void {
    const slot = this.renderRoot.querySelector('slot') as HTMLSlotElement | null;
    this.items = (slot?.assignedElements({ flatten: true }) ?? []) as HTMLElement[];
    for (const el of this.items) {
      this.mo?.observe(el, {
        attributes: true,
        attributeFilter: ['hidden', 'data-hidden', 'style', 'class'],
      });
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
    const h = packMasonryItems(this, this.items, {
      gap: this.gap,
      columnWidth: this.columnWidth,
      columns: this.columns,
      animate: !prefersReducedMotion(),
    });
    this.style.minHeight = `${h}px`;
    const vp = this.renderRoot.querySelector('.viewport') as HTMLElement | null;
    if (vp) vp.style.height = `${h}px`;
  }

  override render() {
    return html`<div class="viewport" part="viewport"><slot></slot></div>`;
  }
}

export default K3Masonry;

if (!customElements.get('k3-masonry')) {
  customElements.define('k3-masonry', K3Masonry);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-masonry': K3Masonry;
  }
}
