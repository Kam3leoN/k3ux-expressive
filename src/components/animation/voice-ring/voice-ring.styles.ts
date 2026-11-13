import { css } from 'lit';

export const voiceRingStyles = css`
  :host {
    display: inline-block;
    position: relative;
    width: var(--k3-voice-ring-size, 240px);
    height: var(--k3-voice-ring-size, 240px);
    line-height: 0;
    vertical-align: middle;
    user-select: none;
    -webkit-user-select: none;
  }

  :host([hidden]) {
    display: none !important;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }
`;
