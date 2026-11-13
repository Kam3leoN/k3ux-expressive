import { css } from 'lit';

/** Host is invisible chrome — canvas root is mounted on document.body by the engine. */
export const fireworkStyles = css`
  :host {
    display: contents;
  }
`;
