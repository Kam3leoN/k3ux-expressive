export interface ComponentDef {
  tag: string;
  /** Dynamic import whose default export is a custom element class. */
  load: () => Promise<{ default: CustomElementConstructor }>;
}

/** Lazy catalog — UX companion components (animations + media / feedback extras). */
export const catalog: ComponentDef[] = [
  // animation
  { tag: 'k3-confetti', load: () => import('../components/animation/confetti.js') },
  { tag: 'k3-snow', load: () => import('../components/animation/snow.js') },
  { tag: 'k3-firework', load: () => import('../components/animation/firework.js') },
  { tag: 'k3-voice-ring', load: () => import('../components/animation/voice-ring.js') },
  { tag: 'k3-text-bounce', load: () => import('../components/animation/text-bounce.js') },
  { tag: 'k3-text-scramble', load: () => import('../components/animation/text-scramble.js') },
  { tag: 'k3-icons-burst', load: () => import('../components/animation/icons-burst.js') },
  { tag: 'k3-halftone', load: () => import('../components/animation/halftone.js') },
  { tag: 'k3-holo-card', load: () => import('../components/animation/cards/holo-card.js') },
  { tag: 'k3-scratch-card', load: () => import('../components/animation/cards/scratch-card.js') },
  { tag: 'k3-lenticular-card', load: () => import('../components/animation/cards/lenticular-card.js') },
  // feedback / media extras
  { tag: 'k3-countdown', load: () => import('../components/feedback/countdown.js') },
  { tag: 'k3-marquee', load: () => import('../components/feedback/marquee.js') },
  { tag: 'k3-sound-fx', load: () => import('../components/feedback/sound-fx.js') },
  { tag: 'k3-audio-player', load: () => import('../components/media/audio-player.js') },
  { tag: 'k3-qr-code', load: () => import('../components/media/qr-code.js') },
  // charts / inputs / pickers / containment
  { tag: 'k3-chart', load: () => import('../components/charts/chart.js') },
  { tag: 'k3-rating', load: () => import('../components/inputs/rating.js') },
  { tag: 'k3-signature', load: () => import('../components/inputs/signature.js') },
  { tag: 'k3-wheel-picker', load: () => import('../components/pickers/wheel-picker.js') },
  { tag: 'k3-masonry', load: () => import('../components/containment/masonry.js') },
  { tag: 'k3-iso-filter', load: () => import('../components/containment/iso-filter.js') },
];
