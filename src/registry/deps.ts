/**
 * Child tags a component renders (k3ux → k3ux). Most UX elements are standalone;
 * peer `k3ui` children (e.g. audio-player) are registered by the component itself.
 */
export const COMPONENT_DEPS: Record<string, readonly string[]> = {
  /* intentionally sparse — extend when a k3ux element stamps another k3ux tag */
};
