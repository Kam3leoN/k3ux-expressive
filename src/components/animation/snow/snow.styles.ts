import { css } from 'lit';

/** Host is invisible chrome — canvas is attached to `document.body` by the engine,
 *  or fills the host when `use-host-canvas` (react-snowfall parent-fill model). */
export const snowStyles = css`
  :host {
    display: contents;
  }

  :host([use-host-canvas]) {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    min-block-size: 12rem;
    pointer-events: none;
    overflow: hidden;
    border-radius: var(--k3-sys-shape-corner-large, 1rem);
    background: var(
      --k3-snow-stage-bg,
      color-mix(in srgb, var(--k3-sys-color-surface-container, #1c1b1f) 70%, #0a1628)
    );
  }

  canvas.ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
`;
