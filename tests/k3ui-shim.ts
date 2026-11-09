/**
 * Vitest / playground peer shim — only the k3ui surface k3ux components need.
 * Avoids loading the full k3ui catalog (and its CSS side-effects) during tests.
 */
export { K3Element, type Density } from '../../K3ui/src/core/k3-element.js';
export { prefersReducedMotion } from '../../K3ui/src/core/lifecycle.js';
export { easings } from '../../K3ui/src/motion/easings.js';
export { i18n } from '../../K3ui/src/i18n/index.js';
