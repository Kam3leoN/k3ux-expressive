/**
 * Vitest peer surface — re-export k3ui public API with MANUAL boot
 * so companion tests do not auto-register the full catalog.
 */
(globalThis as typeof globalThis & { window?: Window }).window ??= globalThis as unknown as Window;
(window as Window & { K3UI_MANUAL?: boolean }).K3UI_MANUAL = true;

export * from '../../K3ui/src/index.js';
