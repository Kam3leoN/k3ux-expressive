import 'k3ui';
import 'k3ui/k3ui.css';
import '../src/index.ts';

document.querySelector('[data-play="scramble"]')?.addEventListener('click', () => {
  const el = document.querySelector('#scramble') as { play?: () => void } | null;
  el?.play?.();
});

document.querySelector('[data-fire="confetti"]')?.addEventListener('click', () => {
  const el = document.querySelector('#confetti') as { fire?: () => void } | null;
  el?.fire?.();
});
