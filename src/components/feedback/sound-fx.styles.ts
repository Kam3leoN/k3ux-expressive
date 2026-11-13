import { css } from 'lit';

export const soundFxStyles = css`
  :host {
    display: inline-flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space100, 0.5rem);
  }

  :host([hidden]) {
    display: none !important;
  }

  .mute {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.5rem;
    min-height: 2.5rem;
    padding: 0;
    border: none;
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-sys-color-secondary-container);
    color: var(--k3-sys-color-on-secondary-container);
    cursor: pointer;
  }

  .mute:focus-visible {
    outline: 2px solid var(--k3-sys-color-primary);
    outline-offset: 2px;
  }

  .mute .ms {
    font-family: var(
      --k3-sys-icon-font-family,
      'Material Symbols Rounded',
      'Material Symbols Outlined',
      sans-serif
    );
    font-size: 1.25rem;
    line-height: 1;
    font-weight: var(--k3-sys-icon-weight, 400);
    font-style: normal;
    font-feature-settings: 'liga';
    font-variation-settings:
      'FILL' var(--k3-sys-icon-fill, 0),
      'wght' var(--k3-sys-icon-weight, 400),
      'GRAD' var(--k3-sys-icon-grade, 0),
      'opsz' var(--k3-sys-icon-optical-size, 24);
    display: inline-grid;
    place-items: center;
    width: 1em;
    height: 1em;
    overflow: hidden;
    letter-spacing: normal;
    text-transform: none !important;
    speak: never;
  }

  .label {
    font: var(--k3-sys-typescale-label-large-font, 0.875rem/1.25rem system-ui);
    color: var(--k3-sys-color-on-surface-variant);
  }
`;
