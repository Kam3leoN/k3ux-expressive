import { css } from 'lit';

export const heartBurstStyles = css`
  :host {
    /* Hug the slotted target — beat playground stage width:100% stretch */
    display: inline-flex;
    position: relative;
    vertical-align: middle;
    width: fit-content !important;
    max-width: 100%;
    overflow: visible;
    /* Host / chrome never steal hits — only the slotted surface */
    pointer-events: none;
  }

  /* Block surfaces: cards, full-width targets */
  :host([block]) {
    display: block;
    width: 100% !important;
  }

  .wrap,
  .layer {
    pointer-events: none;
  }

  /* Border box of the target = sole hit area */
  ::slotted(*) {
    pointer-events: auto;
  }

  .wrap {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .layer {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    z-index: 2;
  }

  .particle {
    position: absolute;
    left: 0;
    top: 0;
    width: var(--k3-heart-burst-particle-size, 1.25rem);
    height: var(--k3-heart-burst-particle-size, 1.25rem);
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--k3-heart-burst-color, #ff4b4b);
    filter: drop-shadow(0 1px 3px color-mix(in srgb, currentColor 45%, transparent));
    will-change: transform, opacity;
    pointer-events: none;
  }

  .particle svg {
    display: block;
    width: 100%;
    height: 100%;
    fill: currentColor;
  }

  @media (prefers-reduced-motion: reduce) {
    .particle {
      display: none;
    }
  }
`;
