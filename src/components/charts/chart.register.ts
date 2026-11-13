import {
  Chart,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  PieController,
  DoughnutController,
  ArcElement,
  RadarController,
  PolarAreaController,
  BubbleController,
  ScatterController,
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  Filler,
  Legend,
  Title,
  Tooltip,
  Colors,
} from 'chart.js';

let registered = false;

/**
 * Chart engine — the only module that talks to the drawing library.
 * Registers controllers / elements / scales / plugins once (tree-shakeable).
 */
export function ensureChartEngine(): typeof Chart {
  if (!registered) {
    Chart.register(
      BarController,
      BarElement,
      LineController,
      LineElement,
      PointElement,
      PieController,
      DoughnutController,
      ArcElement,
      RadarController,
      PolarAreaController,
      BubbleController,
      ScatterController,
      CategoryScale,
      LinearScale,
      RadialLinearScale,
      Filler,
      Legend,
      Title,
      Tooltip,
      Colors,
    );
    registered = true;
  }
  return Chart;
}

/** @deprecated Use `ensureChartEngine` */
export const ensureChartJsRegistered = ensureChartEngine;

export { Chart };
export type {
  ChartConfiguration,
  ChartData,
  ChartDataset,
  ChartOptions,
  ChartType,
  Plugin,
  UpdateMode,
} from 'chart.js';
