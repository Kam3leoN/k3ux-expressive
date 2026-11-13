import { css, unsafeCSS } from 'lit';

/* Gold coin cursor, hotspot in the middle */
const COIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='13' fill='%23b8862b'/%3E%3Ccircle cx='16' cy='16' r='11' fill='%23f2d27a'/%3E%3Ccircle cx='16' cy='16' r='8' fill='none' stroke='%23c99a3a' stroke-width='1.5'/%3E%3Cpath d='M11 11.5a7 7 0 0 1 6-3' fill='none' stroke='%23fff7d6' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E\") 16 16";

export const scratchCardStyles = css`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    isolation: isolate;
    border-radius: var(--k3-scratch-card-radius, var(--k3-sys-shape-corner-medium, 0.75rem));
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  /* Nothing shows before the cover is painted */
  :host(:not([data-ready])) .content {
    visibility: hidden;
  }

  .content {
    display: block;
  }

  ::slotted(img),
  ::slotted(picture),
  ::slotted(svg),
  ::slotted(video) {
    display: block;
    width: 100%;
    max-width: none;
    height: auto;
  }

  .cover {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    /* The finger scratches instead of scrolling the page */
    touch-action: none;
    cursor: var(--k3-scratch-card-cursor, ${unsafeCSS(COIN)}, crosshair);
    transition: opacity var(--k3-scratch-card-reveal-duration, 0ms) var(--k3-sys-motion-easing-standard, ease-out);
  }

  :host([revealed]) .cover {
    opacity: 0;
    pointer-events: none;
  }

  /* Keyboard / screen-reader way to reveal: shown on focus only */
  .reveal {
    position: absolute;
    inset-block-end: var(--k3-sys-spacing-space150, 0.75rem);
    inset-inline-start: 50%;
    z-index: 2;
    min-block-size: 48px;
    padding-inline: var(--k3-sys-spacing-space200, 1rem);
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-sys-color-inverse-surface, #313033);
    color: var(--k3-sys-color-inverse-on-surface, #f4eff4);
    font: var(--k3-sys-typescale-label-large-weight, 500) var(--k3-sys-typescale-label-large-size, 0.875rem) /
      var(--k3-sys-typescale-label-large-line-height, 1.25rem) var(--k3-ref-typeface-plain, sans-serif);
    white-space: nowrap;
    translate: -50% 0;
  }

  :host(:dir(rtl)) .reveal {
    translate: 50% 0;
  }

  .reveal:not(:focus-visible) {
    min-block-size: 0;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .reveal:focus-visible {
    outline: 2px solid var(--k3-sys-color-inverse-primary, #d0bcff);
    outline-offset: 2px;
  }

  .reveal[hidden] {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .cover {
      transition: none;
    }
  }

  @media (forced-colors: active) {
    .reveal:focus-visible {
      outline-color: Highlight;
    }
  }
`;
