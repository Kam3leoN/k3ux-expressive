import { VERSION } from '../version.js';
import { registry } from '../registry/register.js';

export interface InitOptions {
  /** Register all catalog tags (default) or a subset. */
  components?: 'all' | string[];
}

export interface K3UXGlobal {
  version: string;
  init: typeof init;
  registry: typeof registry;
}

declare global {
  interface Window {
    K3UX?: K3UXGlobal;
    K3UX_OPTIONS?: InitOptions;
    K3UX_MANUAL?: boolean;
  }
}

let lastOptions: InitOptions = {};

export function getInitOptions(): InitOptions {
  return { ...lastOptions };
}

export async function init(options: InitOptions = {}): Promise<void> {
  lastOptions = { ...lastOptions, ...options };
  const tags = lastOptions.components ?? 'all';
  await registry.registerAll(tags);

  const api: K3UXGlobal = {
    version: VERSION,
    init,
    registry,
  };
  window.K3UX = api;
}

/** Auto-bootstrap unless `K3UX_MANUAL` is set (tests / custom boot). */
export function autoBootstrap(): void {
  if (typeof window === 'undefined') return;
  if (window.K3UX_MANUAL) return;
  const opts = window.K3UX_OPTIONS ?? {};
  void init(opts);
}
