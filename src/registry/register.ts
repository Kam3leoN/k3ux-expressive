import { catalog } from './catalog.js';
import { COMPONENT_DEPS } from './deps.js';
import { inPack, packInfo } from './missing.js';

const registered = new Set<string>();

export async function register(tag: string, seen: Set<string> = new Set()): Promise<void> {
  if (seen.has(tag)) return;
  seen.add(tag);
  const deps = COMPONENT_DEPS[tag];
  if (deps?.length) await Promise.all(deps.map((dep) => register(dep, seen)));
  if (registered.has(tag) || customElements.get(tag)) {
    registered.add(tag);
    return;
  }
  const def = catalog.find((c) => c.tag === tag);
  if (!def) {
    console.warn(`[k3ux/registry] unknown tag: ${tag}`);
    return;
  }
  if (!inPack(tag)) {
    console.error(
      `[k3ux] <${tag}> is not in this pack. Rebuild: ${packInfo()?.builder ?? 'pack.html?product=k3ux'}`,
    );
    return;
  }
  const mod = await def.load();
  const ctor = mod.default;
  if (!ctor) {
    console.error(`[k3ux] <${tag}> is not in this pack (stub loader).`);
    return;
  }
  if (!customElements.get(tag)) {
    customElements.define(tag, ctor);
  }
  registered.add(tag);
}

export async function registerAll(tags: 'all' | string[] = 'all'): Promise<void> {
  const list = tags === 'all' ? catalog.map((c) => c.tag).filter(isKnown) : tags;
  await Promise.all(list.map((t) => register(t)));
}

export function isRegistered(tag: string): boolean {
  return registered.has(tag) || !!customElements.get(tag);
}

export function isKnown(tag: string): boolean {
  return catalog.some((c) => c.tag === tag) && inPack(tag);
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
