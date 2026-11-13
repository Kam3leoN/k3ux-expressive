import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const destroy = vi.fn();
const update = vi.fn();
const resize = vi.fn();
const toBase64Image = vi.fn(() => 'data:image/png;base64,xx');
const ChartMock = vi.fn(function ChartMock(this: {
  destroy: typeof destroy;
  update: typeof update;
  resize: typeof resize;
  toBase64Image: typeof toBase64Image;
  data: unknown;
  options: unknown;
}) {
  this.destroy = destroy;
  this.update = update;
  this.resize = resize;
  this.toBase64Image = toBase64Image;
  this.data = {};
  this.options = {};
});

vi.mock('chart.js', () => ({
  Chart: Object.assign(ChartMock, { register: vi.fn() }),
  BarController: {},
  BarElement: {},
  LineController: {},
  LineElement: {},
  PointElement: {},
  PieController: {},
  DoughnutController: {},
  ArcElement: {},
  RadarController: {},
  PolarAreaController: {},
  BubbleController: {},
  ScatterController: {},
  CategoryScale: {},
  LinearScale: {},
  RadialLinearScale: {},
  Filler: {},
  Legend: {},
  Title: {},
  Tooltip: {},
  Colors: {},
}));

describe('k3-chart', () => {
  beforeEach(async () => {
    ChartMock.mockClear();
    destroy.mockClear();
    update.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      canvas: document.createElement('canvas'),
    } as unknown as CanvasRenderingContext2D);
    await import('../../src/components/charts/chart.js');
  });

  afterEach(() => {
    document.body.querySelectorAll('k3-chart').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('registers and renders a canvas', async () => {
    const el = document.createElement('k3-chart') as HTMLElement & {
      updateComplete: Promise<unknown>;
      height: number;
    };
    el.height = 200;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(customElements.get('k3-chart')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('canvas')).toBeTruthy();
    expect(ChartMock).toHaveBeenCalled();
  });

  it('updates when data changes and destroys on disconnect', async () => {
    const el = document.createElement('k3-chart') as HTMLElement & {
      updateComplete: Promise<unknown>;
      data: unknown;
      refresh: (mode?: string) => void;
      toBase64Image: () => string;
      getChart: () => unknown;
    };
    document.body.appendChild(el);
    await el.updateComplete;
    el.data = {
      labels: ['A', 'B'],
      datasets: [{ data: [1, 2] }],
    };
    await el.updateComplete;
    expect(update).toHaveBeenCalled();
    expect(el.toBase64Image()).toContain('data:image/png');
    expect(el.getChart()).toBeTruthy();
    el.remove();
    expect(destroy).toHaveBeenCalled();
  });

  it('follows --k3-chart-height unless a height is given', async () => {
    type El = HTMLElement & { updateComplete: Promise<unknown>; height?: number };
    const free = document.createElement('k3-chart') as El;
    document.body.appendChild(free);
    await free.updateComplete;
    const frame = (el: El) => el.shadowRoot!.querySelector<HTMLElement>('.frame')!;
    /* No inline height: the frame reads the CSS variable, as the page did before upgrade */
    expect(frame(free).style.getPropertyValue('--k3-chart-height')).toBe('');
    const sized = document.createElement('k3-chart') as El;
    sized.setAttribute('height', '300');
    document.body.appendChild(sized);
    await sized.updateComplete;
    expect(frame(sized).style.getPropertyValue('--k3-chart-height')).toBe('300px');
  });

  it('keeps its space before the element upgrades (no layout jump)', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync(`${process.cwd()}/src/styles/k3ux.scss`, 'utf8');
    const rule = /k3-chart:not\(:defined\)\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('display: block');
    expect(rule).toContain('block-size: var(--k3-chart-height, 17.5rem)');
  });

  it('reflects type', async () => {
    const el = document.createElement('k3-chart') as HTMLElement & {
      updateComplete: Promise<unknown>;
      type: string;
    };
    document.body.appendChild(el);
    el.type = 'line';
    await el.updateComplete;
    expect(el.getAttribute('type')).toBe('line');
  });
});
