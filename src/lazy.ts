/*
 * On-demand entry (`k3ux/lazy` → dist/lazy/k3ux.js + one chunk per component).
 * Same core API as `k3ux`; components load through the registry catalog.
 */
import { bootstrapGlobal } from './base.js';

export * from './base.js';

bootstrapGlobal();
