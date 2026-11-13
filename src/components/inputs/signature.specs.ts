/**
 * Signature pad — canvas capture (ported from K3ui v1 / SignaturePad).
 */

export const SignatureSpecs = {
  defaultPenColor: '', // empty → resolve --k3-sys-color-on-surface
  defaultBackgroundColor: 'rgba(0,0,0,0)',
  defaultMinWidth: 0.5,
  defaultMaxWidth: 2.5,
  defaultDotSize: 0,
  defaultMinDistance: 5,
  defaultThrottle: 16,
  defaultVelocityFilterWeight: 0.7,
  defaultCompositeOperation: 'source-over' as GlobalCompositeOperation,
  /** Fallback when theme token is unavailable. */
  fallbackPenColor: '#1c1b1f',
  /** Minimum CSS height of the drawing surface (dp). */
  minHeightDp: 160,
  /** Max initials characters stamped on the pad. */
  initialsMaxLength: 4,
  behaviors: {
    showClear: true,
    showHint: true,
    showInitials: true,
  },
  accessibility: {
    role: 'img',
    ariaLabel: 'Signature pad',
    clearLabel: 'Clear signature',
    initialsLabel: 'Initials',
    initialsApplyLabel: 'Apply initials',
  },
} as const;
