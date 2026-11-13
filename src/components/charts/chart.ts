import { html } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type {
  Chart as ChartInstance,
  ChartData,
  ChartOptions,
  ChartType,
  UpdateMode,
} from './chart.register.js';
import { K3Element, prefersReducedMotion } from 'k3ui';
import { i18n } from 'k3ui';
import { hostReset } from '../_shared.js';
import { ensureChartEngine } from './chart.register.js';
import { buildDefaultOptions, mergeChartOptions } from './chart.theme.js';
import { chartStyles } from './chart.styles.js';

export const ChartSpecs = {
  height: 280,
  type: 'bar' as ChartType,
} as const;

export type K3ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'doughnut'
  | 'radar'
  | 'polarArea'
  | 'bubble'
  | 'scatter';

/**
 * K3ui canvas chart (bars, lines, radar, pie / doughnut, polar, bubble, scatter).
 *
 * ```html
 * <k3-chart type="bar" .data=${data} height="280"></k3-chart>
 * ```
 *
 * Without a `height` attribute the frame follows `--k3-chart-height` (default 280px)
 * so the space can be reserved in CSS before the element upgrades.
 */
export class K3Chart extends K3Element {
  static override styles = [hostReset, chartStyles];

  /** Chart type. */
  @property({ reflect: true }) type: K3ChartType = ChartSpecs.type as K3ChartType;
  /** Labels and datasets. */
  @property({ attribute: false }) data: ChartData = { labels: [], datasets: [] };
  /** Partial options (merged over the K3 theme defaults). */
  @property({ attribute: false }) options: ChartOptions | null = null;
  /**
   * Frame height in CSS px. Unset: `--k3-chart-height` (default 280px) — size
   * charts in CSS that way and the space is reserved even before upgrade.
   */
  @property({ type: Number }) height?: number;
  /** Update mode when data / options change. */
  @property({ attribute: 'update-mode' }) updateMode: UpdateMode | 'default' = 'default';
  /** Accessible name (defaults to i18n). */
  @property() label = '';

  @query('canvas') private canvas?: HTMLCanvasElement;

  private chart: ChartInstance | null = null;
  private ro?: ResizeObserver;
  private pendingType = '';
  private ready = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'img');
    this.syncAriaLabel();
  }

  override firstUpdated(): void {
    this.ro = new ResizeObserver(() => this.chart?.resize());
    this.ro.observe(this);
    void this.createChart();
  }

  override disconnectedCallback(): void {
    this.destroyChart();
    this.ro?.disconnect();
    this.ro = undefined;
    super.disconnectedCallback();
  }

  override updated(changed: Map<string, unknown>): void {
    if (changed.has('label')) this.syncAriaLabel();
    if (!this.ready) return;
    if (changed.has('type') && this.pendingType !== this.type) {
      void this.createChart();
      return;
    }
    if (changed.has('data') || changed.has('options') || changed.has('height')) {
      this.applyConfig(changed.has('data') || changed.has('options'));
    }
  }

  /** Underlying chart instance (or null). */
  getChart(): ChartInstance | null {
    return this.chart;
  }

  /** Force a chart update with optional mode (not Lit's `update`). */
  refresh(mode?: UpdateMode): void {
    if (!this.chart) return;
    const m = mode ?? (this.updateMode === 'default' ? undefined : this.updateMode);
    this.chart.update(m);
  }

  /** PNG data URL of the current chart. */
  toBase64Image(type = 'image/png', quality?: number): string {
    return this.chart?.toBase64Image(type, quality) ?? '';
  }

  private syncAriaLabel(): void {
    const text =
      this.label.trim() ||
      i18n.t('chart.ariaLabel', 'Chart');
    this.setAttribute('aria-label', text);
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private async createChart(): Promise<void> {
    const canvas = this.canvas;
    if (!canvas) return;
    this.destroyChart();
    const Chart = ensureChartEngine();
    const type = this.type as ChartType;
    this.pendingType = this.type;
    const opts = mergeChartOptions(buildDefaultOptions(this, type), this.options ?? undefined);
    if (prefersReducedMotion()) {
      opts.animation = false;
    }
    try {
      this.chart = new Chart(canvas, {
        type,
        data: structuredClone(this.data) as ChartData,
        options: opts,
      });
      this.ready = true;
    } catch (err) {
      this.ready = false;
      console.error('[k3-chart] failed to create chart', err);
    }
  }

  private applyConfig(updateData: boolean): void {
    if (!this.chart) {
      void this.createChart();
      return;
    }
    const type = this.type as ChartType;
    const opts = mergeChartOptions(buildDefaultOptions(this, type), this.options ?? undefined);
    if (prefersReducedMotion()) opts.animation = false;
    this.chart.options = opts;
    if (updateData) {
      this.chart.data = structuredClone(this.data) as ChartData;
    }
    this.refresh();
  }

  override render() {
    /* The height attribute wins; otherwise the frame follows --k3-chart-height */
    const h =
      this.height === undefined || !Number.isFinite(this.height)
        ? null
        : Math.max(80, this.height);
    return html`
      <div
        class="frame"
        part="frame"
        style=${styleMap(h === null ? {} : { '--k3-chart-height': `${h}px` })}
      >
        <canvas part="canvas" aria-hidden="true"></canvas>
      </div>
    `;
  }
}

export default K3Chart;

if (!customElements.get('k3-chart')) {
  customElements.define('k3-chart', K3Chart);
}

declare global {
  interface HTMLElementTagNameMap {
    'k3-chart': K3Chart;
  }
}
