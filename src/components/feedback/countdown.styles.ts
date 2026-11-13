import { css } from 'lit';

export const countdownStyles = css`
  :host {
    display: inline-block;
    font-family: var(--k3-ref-typeface-brand, system-ui, sans-serif);
    color: var(--k3-sys-color-on-surface);
  }

  :host([ended]) {
    color: var(--k3-sys-color-on-surface-variant);
  }

  .display {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  .display--segments {
    display: inline-flex;
    align-items: flex-end;
    gap: var(--k3-sys-spacing-space100, 0.5rem);
  }

  .segment-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--k3-sys-spacing-space50, 0.25rem);
  }

  .segment {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.5ch;
    padding: var(--k3-sys-spacing-space100, 0.5rem) var(--k3-sys-spacing-space150, 0.75rem);
    border-radius: var(--k3-sys-shape-corner-small, 0.5rem);
    background: var(--k3-sys-color-surface-container-high);
    font-size: var(--k3-sys-typescale-headline-small-size, 1.5rem);
    line-height: var(--k3-sys-typescale-headline-small-line-height, 2rem);
    font-weight: var(--k3-sys-typescale-headline-small-weight, 400);
  }

  :host([ended]) .segment {
    background: var(--k3-sys-color-surface-container);
  }

  .segment-label {
    font-size: var(--k3-sys-typescale-label-small-size, 0.6875rem);
    line-height: var(--k3-sys-typescale-label-small-line-height, 1rem);
    color: var(--k3-sys-color-on-surface-variant);
    text-transform: lowercase;
  }

  .separator {
    align-self: center;
    padding-block-end: var(--k3-sys-spacing-space100, 0.5rem);
    font-size: var(--k3-sys-typescale-title-large-size, 1.375rem);
    color: var(--k3-sys-color-on-surface-variant);
    user-select: none;
  }

  .message {
    font-size: var(--k3-sys-typescale-title-medium-size, 1rem);
    line-height: var(--k3-sys-typescale-title-medium-line-height, 1.5rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .segment {
      transition: none;
    }
  }
`;
