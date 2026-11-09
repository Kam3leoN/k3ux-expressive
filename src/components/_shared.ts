import { css } from 'lit';

/** Host reset aligned with k3ui — kept local so k3ux does not depend on private paths. */
export const hostReset = css`
  :host {
    display: inline-block;
    box-sizing: border-box;
    font-family: var(--k3-ref-typeface-plain);
    color: var(--k3-sys-color-on-surface);
    -webkit-tap-highlight-color: transparent;
  }

  :host([hidden]) {
    display: none !important;
  }

  :host([dir='rtl']) {
    direction: rtl;
  }
  :host([dir='ltr']) {
    direction: ltr;
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
  }

  button:focus-visible {
    outline: none;
  }

  ::slotted(*) {
    max-width: 100%;
  }

  [data-k3-icon]::before {
    content: attr(data-k3-icon);
    font-family: inherit;
    font-weight: inherit;
    font-style: inherit;
    font-size: inherit;
    line-height: inherit;
    letter-spacing: normal;
    text-transform: none !important;
    white-space: nowrap;
    font-feature-settings: 'liga';
    font-variation-settings: inherit;
    speak: never;
  }
`;
