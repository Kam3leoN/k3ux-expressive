/**
 * Spécifications `k3-wheel-picker` — colonnes rotatives de caractères.
 */

export type WheelPickerDirection = -1 | 1;

export const WheelPickerSpecs = {
  defaultLength: 3,
  defaultAllowedChars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  defaultValue: '',
  showPreview: true,
  showSubmitButton: true,
  submitText: 'Save',
  submittedText: 'Saved!',
  cycleAnimationMs: 260,
  accessibility: {
    label: 'Character picker',
    wheelsLabel: 'Selection columns',
    prevLabel: 'Previous character',
    nextLabel: 'Next character',
  },
} as const;
