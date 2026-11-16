/**
 * Shared API without component modules — used by `k3ux/lazy` and custom packs.
 * Named component exports stay on the full `k3ux` entry (`src/index.ts`).
 */
export { VERSION } from './version.js';
export {
  init,
  autoBootstrap,
  getInitOptions,
  type InitOptions,
  type K3UXGlobal,
} from './bootstrap/init.js';
export { registry } from './registry/register.js';
export { catalog, type ComponentDef } from './registry/catalog.js';
export { PACK_BUILDER_URL, type PackInfo } from './registry/missing.js';

import { VERSION } from './version.js';
import { init, autoBootstrap, type K3UXGlobal } from './bootstrap/init.js';
import { registry } from './registry/register.js';

/** Attach `window.K3UX` and auto-init unless `K3UX_MANUAL`. */
export function bootstrapGlobal(): void {
  if (typeof window === 'undefined') return;
  const api = { version: VERSION, init, registry } satisfies K3UXGlobal;
  window.K3UX = api;
  if (window.K3UX_MANUAL !== true) autoBootstrap();
}
