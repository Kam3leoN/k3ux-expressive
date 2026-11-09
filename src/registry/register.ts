import { catalog } from './catalog.js';

const registered = new Set<string>();

export async function register(tag: string): Promise<void> {
  if (registered.has(tag) || customElements.get(tag)) {
    registered.add(tag);
    return;
  }
  const def = catalog.find((c) => c.tag === tag);
  if (!def) {
    console.warn(`[k3ux/registry] unknown tag: ${tag}`);
    return;
  }
  const mod = await def.load();
  const ctor = mod.default;
  if (!customElements.get(tag)) {
    customElements.define(tag, ctor);
  }
  registered.add(tag);
}

export async function registerAll(tags: 'all' | string[] = 'all'): Promise<void> {
  const list = tags === 'all' ? catalog.map((c) => c.tag) : tags;
  await Promise.all(list.map((t) => register(t)));
}

export function isRegistered(tag: string): boolean {
  return registered.has(tag) || !!customElements.get(tag);
}

export function isKnown(tag: string): boolean {
  return catalog.some((c) => c.tag === tag);
}

export const registry = {
  register,
  registerAll,
  isKnown,
  isRegistered,
  get tags() {
    return catalog.map((c) => c.tag);
  },
};
