import { css } from 'lit';

export const lenticularCardStyles = css`
  :host {
    display: inline-block;
    position: relative;
    vertical-align: top;
    perspective: var(--k3-lenticular-card-perspective, 700px);
    /* Finger: swipes along the axis switch views, the page still scrolls the other way */
    touch-action: var(--k3-lenticular-card-touch-action, pan-y);
    user-select: none;
    -webkit-user-select: none;
    outline: none;
  }

  :host([axis='y']) {
    touch-action: var(--k3-lenticular-card-touch-action, pan-x);
  }

  .card {
    position: relative;
    display: block;
    overflow: hidden;
    isolation: isolate;
    border-radius: var(--k3-lenticular-card-radius, var(--k3-sys-shape-corner-medium, 0.75rem));
    transform: rotateX(var(--k3-lenticular-rotate-x, 0deg)) rotateY(var(--k3-lenticular-rotate-y, 0deg));
    will-change: transform;
    box-shadow: var(--k3-sys-elevation-level2, 0 2px 6px rgb(0 0 0 / 0.3));
  }

  :host(:focus-visible) .card {
    outline: 2px solid var(--k3-sys-color-primary, currentColor);
    outline-offset: 4px;
  }

  .frame {
    display: block;
  }

  .frame ::slotted(*) {
    display: block;
    width: 100%;
    max-width: none;
    height: auto;
    pointer-events: none;
    -webkit-user-drag: none;
  }

  /* Next views stack over the first one and appear in stripes */
  .frame + .frame {
    --r: var(--k3-lenticular-reveal, 0);
    /* Soft stripe edges mid-switch, crisp at both ends */
    --soft: calc(var(--r) * (1 - var(--r)) * 60%);
    position: absolute;
    inset: 0;
    -webkit-mask: linear-gradient(90deg, #000 calc(var(--r) * 100% - var(--soft)), transparent calc(var(--r) * 100% + var(--soft)))
      0 0 / var(--k3-lenticular-card-pitch, 4px) 100% repeat;
    mask: linear-gradient(90deg, #000 calc(var(--r) * 100% - var(--soft)), transparent calc(var(--r) * 100% + var(--soft)))
      0 0 / var(--k3-lenticular-card-pitch, 4px) 100% repeat;
  }

  :host([axis='y']) .frame + .frame {
    -webkit-mask: linear-gradient(180deg, #000 calc(var(--r) * 100% - var(--soft)), transparent calc(var(--r) * 100% + var(--soft)))
      0 0 / 100% var(--k3-lenticular-card-pitch, 4px) repeat;
    mask: linear-gradient(180deg, #000 calc(var(--r) * 100% - var(--soft)), transparent calc(var(--r) * 100% + var(--soft)))
      0 0 / 100% var(--k3-lenticular-card-pitch, 4px) repeat;
  }

  .frame + .frame ::slotted(*) {
    height: 100%;
    object-fit: cover;
  }

  /* Plastic ridges: one lens every pitch */
  .lens {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background: repeating-linear-gradient(
      90deg,
      rgb(255 255 255 / 0) 0,
      rgb(255 255 255 / 0.1) calc(var(--k3-lenticular-card-pitch, 4px) * 0.35),
      rgb(0 0 0 / 0.08) calc(var(--k3-lenticular-card-pitch, 4px) * 0.75),
      rgb(255 255 255 / 0) var(--k3-lenticular-card-pitch, 4px)
    );
    mix-blend-mode: overlay;
    opacity: calc(var(--k3-lenticular-card-ridges, 1) * (0.5 + var(--k3-lenticular-glow, 0) * 0.5));
  }

  :host([axis='y']) .lens {
    background: repeating-linear-gradient(
      180deg,
      rgb(255 255 255 / 0) 0,
      rgb(255 255 255 / 0.1) calc(var(--k3-lenticular-card-pitch, 4px) * 0.35),
      rgb(0 0 0 / 0.08) calc(var(--k3-lenticular-card-pitch, 4px) * 0.75),
      rgb(255 255 255 / 0) var(--k3-lenticular-card-pitch, 4px)
    );
  }

  /* Sheen of the plastic, sliding with the tilt */
  .card::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: linear-gradient(
      105deg,
      rgb(255 255 255 / 0) calc(var(--k3-lenticular-x, 50%) - 32%),
      rgb(255 255 255 / 0.3) var(--k3-lenticular-x, 50%),
      rgb(255 255 255 / 0) calc(var(--k3-lenticular-x, 50%) + 32%)
    );
    mix-blend-mode: soft-light;
    opacity: calc(var(--k3-lenticular-glow, 0) * var(--k3-lenticular-card-sheen, 1));
  }

  :host([axis='y']) .card::after {
    background: linear-gradient(
      195deg,
      rgb(255 255 255 / 0) calc(var(--k3-lenticular-y, 50%) - 32%),
      rgb(255 255 255 / 0.3) var(--k3-lenticular-y, 50%),
      rgb(255 255 255 / 0) calc(var(--k3-lenticular-y, 50%) + 32%)
    );
  }

  .intake {
    display: none;
  }

  .status {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  @media (forced-colors: active) {
    .lens,
    .card::after {
      display: none;
    }
    :host(:focus-visible) .card {
      outline-color: Highlight;
    }
  }
`;
