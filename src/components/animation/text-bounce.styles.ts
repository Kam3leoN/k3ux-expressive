import { css } from 'lit';

export const textBounceStyles = css`
  :host {
    display: inline-block;
    line-height: 1.2;
  }

  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }
  .stage {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0;
    margin: 0;
    font: inherit;
    letter-spacing: 0.06em;
    text-transform: inherit;
    color: inherit;
  }

  .char {
    /* Own box so rotate/bounce pivot on the glyph’s true center */
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    will-change: transform;
    transform-origin: center center;
    transform-box: border-box;
    backface-visibility: hidden;
  }

  .char--space {
    width: 0.35em;
  }

  @media (prefers-reduced-motion: reduce) {
    .char {
      will-change: auto;
    }
  }
`;
