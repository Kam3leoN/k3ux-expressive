import { css } from 'lit';

export const chartStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
    min-block-size: var(--k3-chart-min-block-size, 12rem);
    border-radius: var(--k3-chart-radius, var(--k3-sys-shape-corner-large, 1rem));
    background: var(--k3-chart-bg, transparent);
    color: var(--k3-sys-color-on-surface, inherit);
  }

  .frame {
    position: relative;
    width: 100%;
    height: var(--k3-chart-height, 17.5rem);
  }

  canvas {
    display: block;
    width: 100% !important;
    height: 100% !important;
  }
`;
