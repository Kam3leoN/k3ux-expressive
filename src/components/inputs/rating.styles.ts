import { css } from 'lit';

/**
 * Rating chrome — Sober-style track + clipped indicator + range input.
 * One glyph; copies via `drop-shadow` (color inherits from `color`).
 */
export const ratingStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    box-sizing: border-box;
    --k3-rating-active: var(--k3-sys-color-primary);
    --k3-rating-inactive: var(--k3-sys-color-outline-variant);
    --k3-rating-icon: 32px;
    --k3-rating-max: 5;
    color: var(--k3-rating-active);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  :host([color='secondary']) {
    --k3-rating-active: var(--k3-sys-color-secondary);
  }
  :host([color='tertiary']) {
    --k3-rating-active: var(--k3-sys-color-tertiary);
  }
  :host([color='error']) {
    --k3-rating-active: var(--k3-sys-color-error);
  }

  :host([size='xs']) {
    --k3-rating-icon: 20px;
  }
  :host([size='sm']) {
    --k3-rating-icon: 24px;
  }
  :host([size='md']) {
    --k3-rating-icon: 32px;
  }
  :host([size='lg']) {
    --k3-rating-icon: 40px;
  }
  :host([size='xl']) {
    --k3-rating-icon: 48px;
  }

  :host([disabled]) {
    opacity: 0.38;
    pointer-events: none;
  }

  :host([readonly]) .native {
    pointer-events: none;
  }

  .wrap {
    position: relative;
    display: block;
    width: calc(var(--k3-rating-icon) * var(--k3-rating-max));
    height: var(--k3-rating-icon);
    font-size: var(--k3-rating-icon);
    line-height: 0;
  }

  .track,
  .indicator {
    position: absolute;
    inset: 0 auto 0 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    overflow: hidden;
    pointer-events: none;
  }

  .track {
    color: var(--k3-rating-inactive);
  }

  .indicator {
    color: var(--k3-rating-active);
    width: var(--k3-rating-fill, 0%);
  }

  .icon {
    display: block;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    color: inherit;
    /* Copies = drop-shadow chain; omitted color uses the color property. */
    filter: var(--k3-rating-copies, none);
  }

  .glyph {
    display: grid;
    place-items: center;
    width: 1em;
    height: 1em;
    font-family: var(
      --k3-sys-icon-font,
      'Material Symbols Rounded',
      'Material Symbols Outlined',
      sans-serif
    );
    font-size: 1em;
    font-weight: normal;
    font-style: normal;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    white-space: nowrap;
    font-feature-settings: 'liga';
    font-variation-settings:
      'FILL' var(--k3-rating-fill-axis, 0),
      'wght' var(--k3-sys-icon-wght, 400),
      'GRAD' var(--k3-sys-icon-grad, 0),
      'opsz' var(--k3-sys-icon-opsz, 24);
    color: inherit;
  }

  /* Empty + active both use FILL 1 — empty is muted via inactive color, not outline. */
  .track .glyph,
  .indicator .glyph {
    --k3-rating-fill-axis: 1;
  }

  .glyph[data-k3-icon]::before {
    content: attr(data-k3-icon);
    font-family: inherit;
    font-size: inherit;
    font-variation-settings: inherit;
    font-feature-settings: 'liga';
    line-height: 1;
    speak: never;
  }

  .icon ::slotted(svg),
  .icon ::slotted(img),
  .icon ::slotted(span) {
    display: block;
    width: 1em;
    height: 1em;
    font-size: 1em;
  }

  .native {
    appearance: none;
    -webkit-appearance: none;
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    margin: 0;
    padding: 0;
    width: 100%;
    height: max(100%, 48px);
    opacity: 0;
    cursor: pointer;
    z-index: 1;
  }

  :host([readonly]) .native,
  :host([disabled]) .native {
    cursor: default;
  }

  .native:focus {
    outline: none;
  }

  .wrap:has(.native:focus-visible) {
    outline: 2px solid var(--k3-sys-color-secondary);
    outline-offset: 4px;
    border-radius: var(--k3-sys-shape-corner-extra-small, 4px);
  }

  @media (hover: hover) and (pointer: fine) {
    :host(:not([readonly]):not([disabled])) .wrap[data-preview] .indicator {
      width: var(--k3-rating-preview, var(--k3-rating-fill, 0%));
    }
  }
`;
