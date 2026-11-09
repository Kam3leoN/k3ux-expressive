import { css } from 'lit';

export const halftoneStyles = css`
  :host {
    display: block;
    position: relative;
    overflow: hidden;
    border-radius: var(--k3-halftone-radius, inherit);
    isolation: isolate;
  }

  .content {
    display: block;
    position: relative;
    z-index: 0;
  }

  /* CSS/SVG lookalike of Figma Community “Halftone” — radial dot screen */
  .screen {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    border-radius: inherit;
    background-color: transparent;
    /* Dual lattice (row offset) ≈ print / Figma Community halftone */
    background-image:
      radial-gradient(
        circle closest-side,
        var(--k3-halftone-dot, #0a0a0a) 0%,
        var(--k3-halftone-dot, #0a0a0a) 55%,
        transparent 56%
      ),
      radial-gradient(
        circle closest-side,
        var(--k3-halftone-dot, #0a0a0a) 0%,
        var(--k3-halftone-dot, #0a0a0a) 55%,
        transparent 56%
      );
    background-size:
      var(--k3-halftone-cell, 10px) var(--k3-halftone-cell, 10px),
      var(--k3-halftone-cell, 10px) var(--k3-halftone-cell, 10px);
    background-position:
      0 0,
      calc(var(--k3-halftone-cell, 10px) / 2) calc(var(--k3-halftone-cell, 10px) / 2);
    opacity: var(--k3-halftone-opacity, 0.55);
    mix-blend-mode: var(--k3-halftone-blend, multiply);
  }

  :host([tone='light']) .screen {
    mix-blend-mode: var(--k3-halftone-blend, soft-light);
  }

  :host([animated]) .screen {
    animation: k3-halftone-drift var(--k3-halftone-duration, 12s) linear infinite;
  }

  @keyframes k3-halftone-drift {
    from {
      background-position:
        0 0,
        calc(var(--k3-halftone-cell, 10px) / 2) calc(var(--k3-halftone-cell, 10px) / 2);
    }
    to {
      background-position:
        var(--k3-halftone-cell, 10px) var(--k3-halftone-cell, 10px),
        calc(var(--k3-halftone-cell, 10px) * 1.5) calc(var(--k3-halftone-cell, 10px) * 1.5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :host([animated]) .screen {
      animation: none;
    }
  }

  /* ── Print mode: paper + one canvas per ink, composited like real inks ── */
  .print {
    position: relative;
    display: block;
    inline-size: 100%;
    border-radius: inherit;
    overflow: hidden;
    isolation: isolate;
  }
  .print canvas {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    display: block;
  }
  .print .plate {
    mix-blend-mode: multiply;
    will-change: transform;
  }
  :host([tone='light']) .print .plate {
    mix-blend-mode: screen;
  }
  /* Animated misregistration — plates drift, no re-render */
  :host([animated]) .print .plate {
    animation: k3-halftone-register var(--k3-halftone-duration, 12s) ease-in-out infinite alternate;
    animation-delay: calc(var(--k3-halftone-plate, 0) * -1.7s);
  }
  @keyframes k3-halftone-register {
    0% {
      transform: translate(0, 0);
    }
    33% {
      transform: translate(calc(var(--k3-halftone-drift, 1.5px) * 1), calc(var(--k3-halftone-drift, 1.5px) * -0.6));
    }
    66% {
      transform: translate(calc(var(--k3-halftone-drift, 1.5px) * -0.8), calc(var(--k3-halftone-drift, 1.5px) * 0.9));
    }
    100% {
      transform: translate(calc(var(--k3-halftone-drift, 1.5px) * 0.4), calc(var(--k3-halftone-drift, 1.5px) * 0.5));
    }
  }
  /* Source stays in the light DOM (alt text) but is not painted twice.
     Keep a real layout box (no 1×1 clip) so eager/decode still work; hide visually. */
  .source-hidden {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: -1;
  }
  .source-hidden ::slotted(img),
  .source-hidden ::slotted(video),
  .source-hidden ::slotted(canvas) {
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  @media (prefers-reduced-motion: reduce) {
    :host([animated]) .print .plate {
      animation: none;
    }
  }
`;
