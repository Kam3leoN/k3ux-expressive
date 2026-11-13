import { css } from 'lit';
import { edgeScrollbarStyles } from 'k3ui';

export const isoFilterStyles = [
  edgeScrollbarStyles,
  css`
    :host {
      display: block;
      width: 100%;
    }

    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--k3-sys-spacing-space100, 0.5rem);
      margin-block-end: var(--k3-sys-spacing-space300, 1rem);
    }

    .board {
      display: block;
      position: relative;
      width: 100%;
      min-block-size: 1px;
    }

    .board[data-layout='grid'] {
      display: grid;
      grid-template-columns: repeat(
        auto-fill,
        minmax(var(--k3-iso-filter-min, 4.5rem), 1fr)
      );
      gap: var(--k3-iso-filter-gap, 0.5rem);
    }

    ::slotted([data-filter]),
    ::slotted([data-category]) {
      box-sizing: border-box;
    }

    .board[data-layout='masonry'] ::slotted([data-hidden]) {
      opacity: 0 !important;
      pointer-events: none !important;
    }

    .board[data-layout='grid'] ::slotted([data-hidden]) {
      display: none !important;
    }
  `,
];
