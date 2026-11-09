import { css } from 'lit';

export const textScrambleStyles = css`
  :host {
    display: inline-block;
    width: max-content;
    max-width: 100%;
    font: inherit;
    color: inherit;
    text-align: center;
    /* Avoid inheriting tracking that stretches monospace glyph runs */
    letter-spacing: normal;
  }

  .stage {
    display: block;
    margin: 0;
    padding: 0;
    font: inherit;
    font-variant-ligatures: none;
    letter-spacing: normal;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: normal;
    text-align: center;
    color: inherit;
  }
`;
