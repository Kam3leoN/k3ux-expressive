/**
 * Loose ambient peer typings for `k3ui` during `tsc --noEmit`.
 * Runtime / Vitest resolve the real package via alias or file:../K3ui.
 */
declare module 'k3ui' {
  import { LitElement, type CSSResultGroup } from 'lit';

  export type Density = 'default' | 'comfortable' | 'compact';

  export class K3Element extends LitElement {
    density: Density;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    emit<T = any>(...args: any[]): any;
    hasSlot(name?: string): boolean;
    // Allow subclass access to protected helpers without mirroring the full API.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  export const prefersReducedMotion: () => boolean;
  export const isRtl: (el?: Element | null) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const i18n: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const easings: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const springs: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const haptic: any;
  export const edgeScrollbarStyles: CSSResultGroup;
  export const focusRingStyles: CSSResultGroup;
  export const stateLayerStyles: CSSResultGroup;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function sysColorCssVars(...args: any[]): Record<string, string>;
  export const COLOR_ROLES: readonly string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MATERIAL_SHAPE_SVG: any;
  export type MaterialShapeName = string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function animateMaterialShapeMorph(...args: any[]): any;

  export class LayerPortal {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function attachDrag(...args: any[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function attachOutsideDismiss(...args: any[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function clearAxisTranslate(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function shouldDismissDrag(...args: any[]): boolean;
  export type DragController = any;
  export type OutsideDismissController = any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function attachInternals(...args: any[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function setFormValue(...args: any[]): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function sanitizeHTMLDetailed(...args: any[]): any;
  export type SanitizeOptions = Record<string, unknown>;

  export const GAP_DP: number;
  export const LINEAR_WAVE_AMP: number;
  export const LINEAR_WAVE_LEN: number;
  export const STOP_DP: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function drawFlatBar(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function drawOscillationBars(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function drawStop(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function drawWavyBar(...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function indicatorAmplitudeFactor(...args: any[]): number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function loadWaveformPeaks(...args: any[]): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function oscillationBarCount(...args: any[]): number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function resamplePeaks(...args: any[]): any;
  export const SLIDER_HANDLE_GAP: number;
  export const SLIDER_HANDLE_GAP_PRESSED: number;
  export const SLIDER_HANDLE_WIDTH_PRESSED: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function attachTextMarquee(...args: any[]): any;
  export type TextMarqueeHandle = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function showSnackbar(...args: any[]): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const registry: any;
}

interface Window {
  K3UI_MANUAL?: boolean;
  K3UX_MANUAL?: boolean;
}
