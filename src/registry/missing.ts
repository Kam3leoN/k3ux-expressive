/** Pack builder on the documentation site (k3ui playground). */
export const PACK_BUILDER_URL = 'https://k3ui-expressive.vercel.app/?product=k3ux';

export interface PackInfo {
  name: string;
  version: string;
  components: string[];
  builder?: string;
}

declare global {
  // eslint-disable-next-line no-var
  var K3UX_PACK: PackInfo | undefined;
}

export function packInfo(): PackInfo | undefined {
  const info = globalThis.K3UX_PACK;
  if (!info || typeof info !== 'object') return undefined;
  const components = Array.isArray(info.components)
    ? info.components.filter((t): t is string => typeof t === 'string')
    : typeof info.components === 'string'
      ? [info.components]
      : [];
  return { ...info, components };
}

/** `true` when this build can define `tag` (full library, or listed in the pack). */
export function inPack(tag: string): boolean {
  const info = packInfo();
  if (!info) return true;
  return info.components.includes(tag);
}
