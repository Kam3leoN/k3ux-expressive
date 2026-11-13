import { css } from 'lit';

export const wheelPickerStyles = css`
  :host {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: var(--k3-sys-spacing-space300, 1.5rem);
    font-family: var(--k3-ref-typeface-brand, system-ui, sans-serif);
    color: var(--k3-sys-color-on-surface);
  }

  .preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--k3-sys-spacing-space50, 0.25rem);
    padding: var(--k3-sys-spacing-space100, 0.5rem) var(--k3-sys-spacing-space200, 1rem);
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-sys-color-surface-container-high);
    min-height: 2.5rem;
  }

  :host([saved]) .preview {
    background: var(--k3-sys-color-primary-container);
    color: var(--k3-sys-color-on-primary-container);
  }

  .preview-char {
    font-size: var(--k3-sys-typescale-title-large-size, 1.375rem);
    font-weight: 600;
    min-width: 1ch;
    text-align: center;
  }

  .wheels {
    display: flex;
    align-items: center;
    gap: var(--k3-sys-spacing-space200, 1rem);
  }

  .column {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--k3-sys-spacing-space100, 0.5rem);
    opacity: 0;
    transform: translateY(0.5rem);
  }

  .column--mounted {
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 280ms ease,
      transform 280ms ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .column {
      opacity: 1;
      transform: none;
      transition: none;
    }

    .display--animating .letter--slide-out-up,
    .display--animating .letter--slide-out-down,
    .display--animating .letter--slide-in-up,
    .display--animating .letter--slide-in-down {
      animation: none !important;
    }
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: 0;
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-sys-color-surface-container);
    color: var(--k3-sys-color-on-surface-variant);
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }

  .btn:hover {
    background: var(--k3-sys-color-surface-container-high);
  }

  .btn:focus-visible {
    outline: 2px solid var(--k3-sys-color-primary);
    outline-offset: 2px;
  }

  .display {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: var(--k3-sys-shape-corner-medium, 0.75rem);
    background: var(--k3-sys-color-primary-container);
    color: var(--k3-sys-color-on-primary-container);
    overflow: hidden;
  }

  .letter {
    font-size: var(--k3-sys-typescale-headline-small-size, 1.5rem);
    font-weight: 600;
    line-height: 1;
  }

  .display .letter:not(.letter--current) {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .letter--current.letter--hidden {
    visibility: hidden;
  }

  .letter--slide-out-up {
    animation: k3-wp-out-up 260ms ease forwards;
  }

  .letter--slide-out-down {
    animation: k3-wp-out-down 260ms ease forwards;
  }

  .letter--slide-in-up {
    animation: k3-wp-in-up 260ms ease forwards;
  }

  .letter--slide-in-down {
    animation: k3-wp-in-down 260ms ease forwards;
  }

  @keyframes k3-wp-out-up {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(-100%);
      opacity: 0;
    }
  }

  @keyframes k3-wp-out-down {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100%);
      opacity: 0;
    }
  }

  @keyframes k3-wp-in-up {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes k3-wp-in-down {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .submit {
    min-width: 8rem;
    padding: var(--k3-sys-spacing-space150, 0.75rem) var(--k3-sys-spacing-space300, 1.5rem);
    border: 0;
    border-radius: var(--k3-sys-shape-corner-full, 999px);
    background: var(--k3-sys-color-primary);
    color: var(--k3-sys-color-on-primary);
    font-size: var(--k3-sys-typescale-label-large-size, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }

  .submit--saved {
    background: var(--k3-sys-color-tertiary-container);
    color: var(--k3-sys-color-on-tertiary-container);
  }

  .submit:focus-visible {
    outline: 2px solid var(--k3-sys-color-primary);
    outline-offset: 2px;
  }

  .ripple {
    position: absolute;
    border-radius: 50%;
    background: color-mix(in srgb, var(--k3-sys-color-on-primary) 18%, transparent);
    pointer-events: none;
    transform: scale(0);
    animation: k3-wp-ripple 560ms ease-out forwards;
  }

  @keyframes k3-wp-ripple {
    to {
      transform: scale(1);
      opacity: 0;
    }
  }
`;
