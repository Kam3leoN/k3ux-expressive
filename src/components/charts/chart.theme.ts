import type { ChartOptions, ChartType } from './chart.register.js';
import { prefersReducedMotion } from 'k3ui';

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/** Default chart options tuned to K3ui system color tokens. */
export function buildDefaultOptions(
  host: HTMLElement,
  type: ChartType,
): ChartOptions {
  const onSurface = cssVar(host, '--k3-sys-color-on-surface', '#1a1c1e');
  const outline = cssVar(host, '--k3-sys-color-outline-variant', '#c1c7ce');
  const surface = cssVar(host, '--k3-sys-color-surface', '#faf9fd');
  const primary = cssVar(host, '--k3-sys-color-primary', '#00639b');

  const cartesian = type === 'bar' || type === 'line' || type === 'scatter' || type === 'bubble';
  const radial = type === 'radar' || type === 'polarArea';

  const options: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : undefined,
    plugins: {
      legend: {
        labels: {
          color: onSurface,
          boxWidth: 12,
          boxHeight: 12,
          usePointStyle: true,
        },
      },
      title: {
        color: onSurface,
      },
      tooltip: {
        backgroundColor: surface,
        titleColor: onSurface,
        bodyColor: onSurface,
        borderColor: outline,
        borderWidth: 1,
      },
    },
    color: primary,
  };

  if (cartesian) {
    options.scales = {
      x: {
        ticks: { color: onSurface },
        grid: { color: outline },
        border: { color: outline },
      },
      y: {
        ticks: { color: onSurface },
        grid: { color: outline },
        border: { color: outline },
        beginAtZero: true,
      },
    };
  }

  if (radial) {
    options.scales = {
      r: {
        ticks: { color: onSurface, backdropColor: 'transparent' },
        grid: { color: outline },
        angleLines: { color: outline },
        pointLabels: { color: onSurface },
      },
    };
  }

  return options;
}

/** Deep-merge chart option objects (arrays replaced, not concatenated). */
export function mergeChartOptions(
  base: ChartOptions,
  override?: ChartOptions | null,
): ChartOptions {
  if (!override) return base;
  return mergeDeep(base, override) as ChartOptions;
}

function mergeDeep(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    const cur = out[k];
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      cur &&
      typeof cur === 'object' &&
      !Array.isArray(cur)
    ) {
      out[k] = mergeDeep(cur as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
