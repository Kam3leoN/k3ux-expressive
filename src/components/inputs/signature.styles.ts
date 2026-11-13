import { css } from 'lit';

/**
 * Styles for `k3-signature` — outlined canvas surface + clear action.
 *
 * @see ./signature.specs.ts
 */
export const signatureStyles = css`
  :host {
    display: block;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    --k3-signature-min-height: 10rem; /* 160 */
    --k3-signature-radius: var(--k3-sys-shape-corner-medium, 0.75rem);
    --k3-signature-outline: var(--k3-sys-color-outline-variant);
    --k3-signature-surface: var(--k3-sys-color-surface-container-lowest);
    --k3-signature-hint: var(--k3-sys-color-on-surface-variant);
    color: var(--k3-sys-color-on-surface);
  }

  :host([hidden]) {
    display: none !important;
  }

  :host([disabled]) {
    opacity: 0.38;
    pointer-events: none;
  }

  .root {
    display: flex;
    flex-direction: column;
    gap: var(--k3-sys-spacing-space100, 0.5rem);
  }

  .surface {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    min-height: var(--k3-signature-min-height);
    border-radius: var(--k3-signature-radius);
    border: 1px solid var(--k3-signature-outline);
    background: var(--k3-signature-surface);
    overflow: hidden;
    touch-action: none;
  }

  :host(:focus-within) .surface {
    outline: 2px solid var(--k3-sys-color-primary);
    outline-offset: 2px;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    min-height: var(--k3-signature-min-height);
    vertical-align: top;
    cursor: crosshair;
    touch-action: none;
  }

  :host([disabled]) canvas,
  :host([readonly]) canvas {
    cursor: default;
  }

  .hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    padding: var(--k3-sys-spacing-space200, 1rem);
    pointer-events: none;
    color: var(--k3-signature-hint);
    font-size: var(--k3-sys-typescale-body-medium-size, 0.875rem);
    line-height: var(--k3-sys-typescale-body-medium-line-height, 1.25rem);
    text-align: center;
    user-select: none;
  }

  .hint[hidden] {
    display: none !important;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--k3-sys-spacing-space100, 0.5rem);
  }

  .actions[hidden] {
    display: none !important;
  }

  .initials {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem; /* 6 */
  }

  .initials-input {
    box-sizing: border-box;
    width: 4.5rem;
    min-height: 2.5rem; /* 40 */
    margin: 0;
    padding: 0 0.75rem;
    border: 1px solid var(--k3-sys-color-outline-variant);
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-sys-color-surface-container-highest);
    color: var(--k3-sys-color-on-surface);
    font: inherit;
    font-size: var(--k3-sys-typescale-label-large-size, 0.875rem);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-align: center;
    text-transform: uppercase;
    -webkit-appearance: none;
    appearance: none;
  }

  .initials-input::placeholder {
    color: var(--k3-sys-color-on-surface-variant);
    letter-spacing: normal;
    font-weight: 500;
    text-transform: none;
  }

  .initials-input:focus-visible {
    outline: 2px solid var(--k3-sys-color-primary);
    outline-offset: 2px;
  }

  .btn-clear,
  .btn-initials {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    margin: 0;
    padding: 0.5rem 0.875rem;
    border: none;
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-sys-color-secondary-container);
    color: var(--k3-sys-color-on-secondary-container);
    font: inherit;
    font-size: var(--k3-sys-typescale-label-large-size, 0.875rem);
    font-weight: var(--k3-sys-typescale-label-large-weight, 500);
    line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .btn-initials {
    min-width: 2.5rem;
    min-height: 2.5rem;
    padding: 0.5rem;
    background: var(--k3-sys-color-primary);
    color: var(--k3-sys-color-on-primary);
  }

  .btn-clear:hover,
  .btn-initials:hover {
    box-shadow: var(--k3-sys-elevation-level1, none);
  }

  .btn-clear:focus-visible,
  .btn-initials:focus-visible,
  .initials-input:focus-visible {
    outline: 2px solid var(--k3-sys-color-primary);
    outline-offset: 2px;
  }

  .btn-clear:disabled,
  .btn-initials:disabled {
    opacity: 0.38;
    cursor: default;
    box-shadow: none;
  }

  .btn-clear .ms,
  .btn-initials .ms {
    font-family: 'Material Symbols Rounded', 'Material Symbols Outlined', sans-serif;
    font-size: 1.125rem;
    line-height: 1;
    font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24;
    font-feature-settings: 'liga';
  }
`;
