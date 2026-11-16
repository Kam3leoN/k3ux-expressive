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

const sparkle = document.querySelector('#sparkle') as
  | (HTMLElement & { intensity: number; colors: string[] | string; burst: (x: number, y: number, n?: number) => number })
  | null;
document.querySelector<HTMLInputElement>('#sparkle-intensity')?.addEventListener('input', (event) => {
  const value = Number((event.target as HTMLInputElement).value);
  if (sparkle) sparkle.intensity = value;
  const out = document.querySelector('#sparkle-intensity-out');
  if (out) out.textContent = String(value);
});
document.querySelector<HTMLInputElement>('#sparkle-colors')?.addEventListener('input', (event) => {
  /* Attribute path: the component parses the comma list (any number of colours). */
  sparkle?.setAttribute('colors', (event.target as HTMLInputElement).value);
});
document.querySelector('[data-sparkle="burst"]')?.addEventListener('click', (event) => {
  const { clientX, clientY } = event as MouseEvent;
  sparkle?.burst(clientX, clientY, 40);
});
