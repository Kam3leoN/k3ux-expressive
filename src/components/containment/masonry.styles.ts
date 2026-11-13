import { css } from 'lit';

export const masonryStyles = css`
  :host {
    display: block;
    position: relative;
    width: 100%;
  }

  .viewport {
    position: relative;
    width: 100%;
    min-block-size: 1px;
  }

  .item {
    position: absolute;
    box-sizing: border-box;
    transition:
      inset var(--k3-sys-motion-duration-medium2, 300ms) var(--k3-sys-motion-easing-emphasized, ease),
      width var(--k3-sys-motion-duration-medium2, 300ms) var(--k3-sys-motion-easing-emphasized, ease),
      opacity var(--k3-sys-motion-duration-short4, 200ms) linear;
  }

  .item[hidden],
  .item[data-hidden] {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }

  .sizer {
    position: absolute;
    visibility: hidden;
    height: 0;
    overflow: hidden;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .item {
      transition: none;
    }
  }
`;
