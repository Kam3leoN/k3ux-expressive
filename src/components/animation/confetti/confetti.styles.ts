import { css } from 'lit';

/** Host is invisible chrome — canvas is attached to `document.body` by the engine. */
export const confettiStyles = css`
  :host {
    display: contents;
  }

  :host([use-host-canvas]) {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  canvas.ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
`;
