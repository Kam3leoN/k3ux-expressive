import { css } from 'lit';

/**
 * Android-style volume toolbar (mute + slider pill).
 * Used by `k3-audio-player` (shadow) — playground mirrors via `.slider-lab-stage--toolbar`.
 */
export const volumeToolbarStyles = css`
  .vol-toolbar {
    position: absolute;
    inset-block-end: calc(100% + var(--k3-sys-spacing-space100, 0.5rem));
    inset-inline-start: 50%;
    inset-block-start: auto;
    inset-inline-end: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--k3-sys-spacing-space100);
    min-inline-size: 9.5rem;
    max-inline-size: min(14rem, 70vw);
    padding: var(--k3-sys-spacing-space100) var(--k3-sys-spacing-space150);
    border-radius: var(--k3-sys-shape-corner-full);
    background: var(--k3-sys-color-surface-container-high);
    color: var(--k3-sys-color-on-surface);
    box-shadow: var(--k3-sys-elevation-level3);
    transform: translateX(-50%);
    z-index: 32;
    animation: k3-vol-toolbar-in var(--k3-sys-motion-duration-spatial-fast, 350ms)
      var(--k3-sys-motion-easing-spatial-fast, cubic-bezier(0.42, 1.67, 0.21, 0.9)) both;
  }
  .vol-toolbar k3-slider {
    flex: 1 1 auto;
    min-inline-size: 5.5rem;
  }
  @keyframes k3-vol-toolbar-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(0.35rem) scale(0.94);
    }
    to {
      opacity: 1;
      transform: translateX(-50%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .vol-toolbar {
      animation: none;
    }
  }
`;
