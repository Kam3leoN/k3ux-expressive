import { css } from 'lit';

/**
 * Invisible by default — the engine draws on a fixed canvas appended to
 * `document.body`. With `use-host-canvas` the host is the stage: sparkles
 * follow the pointer inside its box only.
 */
export const sparkleMouseStyles = css`
  :host {
    display: contents;
  }

  :host([use-host-canvas]) {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    min-block-size: 12rem;
    overflow: hidden;
    border-radius: var(--k3-sys-shape-corner-large, 1rem);
    background: var(--k3-sparkle-mouse-stage-bg, var(--k3-sys-color-surface-container, #f3edf7));
  }

  canvas.stage {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
`;
