import { css } from 'lit';

export const marqueeStyles = css`
  :host {
    display: block;
    /* Full width even as a flex item — a classic pass must cross the whole space */
    inline-size: 100%;
    min-inline-size: 0;
    box-sizing: border-box;
    overflow: hidden;
    --k3-marquee-gap: 5rem;
    /* Edge fade (0% to disable) */
    --k3-marquee-fade: 8%;
  }

  :host([direction='up']),
  :host([direction='down']) {
    /* Vertical scrolling needs a height (MarqueeJS: containerHeight) */
    block-size: var(--k3-marquee-height, 12rem);
  }

  .viewport {
    position: relative;
    overflow: hidden;
    inline-size: 100%;
    block-size: 100%;
    /* Fade length 0 / none → no mask (full-bleed to the host edge) */
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 var(--k3-marquee-fade, 8%),
      #000 calc(100% - var(--k3-marquee-fade, 8%)),
      transparent
    );
  }

  .viewport[data-axis='y'] {
    mask-image: linear-gradient(
      to bottom,
      transparent,
      #000 var(--k3-marquee-fade, 8%),
      #000 calc(100% - var(--k3-marquee-fade, 8%)),
      transparent
    );
  }

  :host([data-fade='off']) .viewport {
    mask-image: none;
  }

  .track {
    display: flex;
    inline-size: max-content;
    gap: var(--k3-marquee-gap);
    will-change: transform;
  }

  /* Right / down: copies extend backwards; the anchor offset is set in JS */
  .viewport[data-direction='right'] .track {
    flex-direction: row-reverse;
  }

  .viewport[data-axis='y'] .track {
    flex-direction: column;
    inline-size: 100%;
    block-size: max-content;
  }

  .viewport[data-direction='down'] .track {
    flex-direction: column-reverse;
  }

  .set,
  .sep {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: var(--k3-marquee-gap);
  }

  .viewport[data-axis='y'] .set {
    flex-direction: column;
  }

  .sep {
    color: var(--k3-marquee-separator-color, currentColor);
    opacity: 0.6;
  }

  /* Reduced motion: no movement — the original content scrolls by hand instead */
  .viewport[data-state='reduced'] {
    overflow: auto;
    mask-image: none;
  }

  .viewport[data-state='reduced'] .clone,
  .viewport[data-state='reduced'] .sep {
    display: none;
  }

  /* Text version — size / font / weight (also reach the copies through inheritance) */
  :host {
    font-size: var(--k3-marquee-font-size, inherit);
    font-family: var(--k3-marquee-font-family, inherit);
    font-weight: var(--k3-marquee-font-weight, inherit);
    line-height: var(--k3-marquee-line-height, inherit);
  }

  /* Band: optional fixed label + scrolling viewport */
  .band {
    display: flex;
    align-items: center;
    gap: var(--k3-marquee-label-gap, 0.75em);
    inline-size: 100%;
    block-size: 100%;
    box-sizing: border-box;
  }
  :host([direction='up']) .band,
  :host([direction='down']) .band {
    flex-direction: column;
    align-items: stretch;
  }
  .band > .viewport {
    flex: 1 1 auto;
    min-inline-size: 0;
    min-block-size: 0;
  }
  .label {
    flex: none;
    display: inline-flex;
  }
  .label[hidden] {
    display: none;
  }
  ::slotted([slot='label']) {
    display: inline-flex;
    align-items: center;
    padding: 0.3em 0.8em;
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-marquee-label-bg, var(--k3-sys-color-primary));
    color: var(--k3-marquee-label-fg, var(--k3-sys-color-on-primary));
    font-size: 0.6em;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Templates */
  :host([variant='tonal']) .band {
    background: var(--k3-sys-color-secondary-container);
    color: var(--k3-sys-color-on-secondary-container);
  }
  :host([variant='filled']) .band {
    background: var(--k3-sys-color-primary-container);
    color: var(--k3-sys-color-on-primary-container);
  }
  :host([variant='outlined']) .band {
    border: 1px solid var(--k3-sys-color-outline-variant);
  }
  :host([variant='tonal']) .band,
  :host([variant='filled']) .band,
  :host([variant='outlined']) .band {
    padding: var(--k3-marquee-padding, 0.5em 0.75em);
    border-radius: var(--k3-marquee-radius, var(--k3-sys-shape-corner-medium, 0.75rem));
  }

  /* RTL pages: the strip geometry stays physical (left is left), so the loop is
     identical in both directions; each copy keeps the page reading direction. */
  .viewport,
  .track {
    direction: ltr;
  }
  .viewport[data-content-dir='rtl'] .set {
    direction: rtl;
  }
  :host(:dir(rtl)) .set {
    direction: rtl;
  }

  /* Drag to move */
  :host([drag]) .viewport {
    cursor: grab;
    touch-action: pan-y;
  }
  :host([drag][direction='up']) .viewport,
  :host([drag][direction='down']) .viewport {
    touch-action: pan-x;
  }
  .viewport[data-dragging] {
    cursor: grabbing;
    user-select: none;
  }
`;
