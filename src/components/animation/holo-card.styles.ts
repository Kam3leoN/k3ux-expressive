import { css, unsafeCSS } from 'lit';

/* Prism foil textures, generated in SVG (no image to ship) */
const SPARKLES =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 9 0 0 0 -6'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='2 0 0 0 -.5 2 0 0 0 -.5 2 0 0 0 -.5 0 0 0 0 .3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export const holoCardStyles = css`
  :host {
    /* Driven by holo-card.ts (rest values) */
    --k3-holo-rotate-x: 0deg;
    --k3-holo-rotate-y: 0deg;
    --k3-holo-pointer-x: 50%;
    --k3-holo-pointer-y: 50%;
    --k3-holo-pointer-from-center: 0;
    --k3-holo-pointer-from-left: 0.5;
    --k3-holo-pointer-from-top: 0.5;
    --k3-holo-background-x: 50%;
    --k3-holo-background-y: 50%;
    --k3-holo-opacity: 0;

    display: inline-block;
    position: relative;
    vertical-align: top;
    perspective: var(--k3-holo-card-perspective, 600px);
    /* Finger: horizontal drags tilt, vertical ones still scroll the page */
    touch-action: var(--k3-holo-card-touch-action, pan-y);
    transition: transform var(--k3-sys-motion-duration-medium4, 400ms)
      var(--k3-sys-motion-easing-standard-decelerate, cubic-bezier(0, 0, 0, 1));
    user-select: none;
    -webkit-user-select: none;
  }

  :host([data-active]) {
    z-index: 1;
    transform: scale(var(--k3-holo-card-hover-scale, 1.05));
  }

  .card {
    position: relative;
    display: block;
    overflow: hidden;
    isolation: isolate; /* blend modes stay inside the card */
    border-radius: var(--k3-holo-card-radius, var(--k3-sys-shape-corner-medium, 0.75rem));
    transform: rotateX(var(--k3-holo-rotate-x)) rotateY(var(--k3-holo-rotate-y));
    will-change: transform;
    box-shadow: var(--k3-sys-elevation-level2, 0 2px 6px rgb(0 0 0 / 0.3));
    transition: box-shadow var(--k3-sys-motion-duration-medium4, 400ms) ease;
  }

  :host([data-active]) .card {
    box-shadow:
      0 0 0 1px rgb(255 255 255 / 0.15),
      0 0 30px 2px var(--k3-holo-card-glow, rgb(102 214 255 / 0.25)),
      var(--k3-sys-elevation-level4, 0 8px 24px rgb(0 0 0 / 0.4));
  }

  ::slotted(*) {
    display: block;
    width: 100%;
    max-width: none;
    height: auto;
    pointer-events: none;
    -webkit-user-drag: none;
  }

  .shine,
  .glare {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: calc(var(--k3-holo-opacity) * var(--k3-holo-card-intensity, 1));
  }

  /* Optional sub-layers: an external effect turns them on with content: '' */
  .shine::before,
  .shine::after,
  .glare::after {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  /* ── Built-in effect: prism ─────────────────────────────────────────── */

  :host([effect='prism']) .shine {
    opacity: calc(
      var(--k3-holo-opacity) * var(--k3-holo-card-intensity, 1) * (0.55 + 0.45 * var(--k3-holo-pointer-from-center))
    );
    mix-blend-mode: color-dodge;
    background-image:
      ${unsafeCSS(SPARKLES)},
      ${unsafeCSS(GRAIN)},
      repeating-linear-gradient(
        var(--k3-holo-card-bands-angle, 115deg),
        hsl(350 100% 60% / 0.4) 0%,
        hsl(40 100% 58% / 0.4) 2.25%,
        hsl(95 90% 55% / 0.4) 4.5%,
        hsl(165 95% 55% / 0.4) 6.75%,
        hsl(205 100% 60% / 0.4) 9%,
        hsl(255 100% 68% / 0.4) 11.25%,
        hsl(305 100% 64% / 0.4) 13.5%,
        hsl(350 100% 60% / 0.4) 15.75%
      );
    background-size:
      220px 220px,
      180px 180px,
      300% 300%;
    background-position:
      center,
      center,
      calc(50% + (var(--k3-holo-background-x) - 50%) * 1.5) calc(50% + (var(--k3-holo-background-y) - 50%) * 1.5);
    background-blend-mode: overlay, overlay, normal;
    filter: brightness(0.8) contrast(1.35) saturate(1.4);
    /* Brighter around the pointer */
    -webkit-mask-image: radial-gradient(
      farthest-corner circle at var(--k3-holo-pointer-x) var(--k3-holo-pointer-y),
      #000 5%,
      rgb(0 0 0 / 0.2) 100%
    );
    mask-image: radial-gradient(
      farthest-corner circle at var(--k3-holo-pointer-x) var(--k3-holo-pointer-y),
      #000 5%,
      rgb(0 0 0 / 0.2) 100%
    );
  }

  :host([effect='prism']) .glare {
    mix-blend-mode: overlay;
    background-image: radial-gradient(
      farthest-corner circle at var(--k3-holo-pointer-x) var(--k3-holo-pointer-y),
      rgb(255 255 255 / 0.75) 0%,
      rgb(255 255 255 / 0.35) 25%,
      rgb(0 0 0 / 0.4) 90%
    );
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      transition: none;
    }
    :host([data-active]) {
      transform: none;
    }
  }

  /* Forced colors: no decorative light over the artwork */
  @media (forced-colors: active) {
    .shine,
    .glare {
      display: none;
    }
  }
`;
