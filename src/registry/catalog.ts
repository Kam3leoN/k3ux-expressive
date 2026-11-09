export interface ComponentDef {
  tag: string;
  /** Dynamic import whose default export is a custom element class. */
  load: () => Promise<{ default: CustomElementConstructor }>;
}

/** Lazy catalog — decorative UX / animation components only. */
export const catalog: ComponentDef[] = [
  { tag: 'k3-confetti', load: () => import('../components/feedback/confetti.js') },
  { tag: 'k3-text-bounce', load: () => import('../components/animation/text-bounce.js') },
  { tag: 'k3-text-scramble', load: () => import('../components/animation/text-scramble.js') },
  { tag: 'k3-heart-burst', load: () => import('../components/animation/heart-burst.js') },
  { tag: 'k3-halftone', load: () => import('../components/animation/halftone.js') },
  { tag: 'k3-holo-card', load: () => import('../components/animation/holo-card.js') },
  { tag: 'k3-scratch-card', load: () => import('../components/animation/scratch-card.js') },
  { tag: 'k3-lenticular-card', load: () => import('../components/animation/lenticular-card.js') },
];
