# K3ux

Optional **UX / animation** companion to [k3ui](https://github.com/Kam3leoN/k3ui-expressive).

Repo: [Kam3leoN/k3ux-expressive](https://github.com/Kam3leoN/k3ux-expressive) · docs switch on the shared k3ui Vercel playground (home → **K3ui / K3ux**).

Install `k3ui` for Material 3 Expressive UI. Add `k3ux` only when you need decorative effects (confetti, text bounce/scramble, holo/scratch/lenticular cards, etc.).

```bash
npm i k3ui k3ux
```

```ts
import 'k3ui';
import 'k3ui/k3ui.css';
import 'k3ux'; // registers k3-confetti, k3-text-bounce, k3-holo-card, …
```

Optional holographic foils (GPL-3.0):

```ts
import 'k3ux/holo-effects.css';
```

## Sparkle mouse

`<k3-sparkle-mouse>` leaves four-point stars behind the pointer — they scatter, twinkle,
drift and fade. Drop one element in the page; nothing runs while the pointer is still.

```html
<!-- light blue-violet trail (default: intensity 20 %) -->
<k3-sparkle-mouse></k3-sparkle-mouse>

<!-- denser, with your own palette — any number of colours -->
<k3-sparkle-mouse
  intensity="60"
  colors="#ffd54f, #ff8a65, #f06292, #ba68c8, #64b5f6"
></k3-sparkle-mouse>
```

| Attribute / property | Default | |
| --- | --- | --- |
| `intensity` | `20` | 0–100 %. 20 = a light trail, 100 = five times denser, 0 = none |
| `colors` | `#5b8def, #6f7bf7, #7c5cff, #9a6bff, #b388ff` | Comma list or JSON array (attribute), `string[]` (property). Theme roles (`primary`), CSS colours, `var(--brand)`. Every sparkle picks one entry: 5 colours → 5 customisable, 10 → 10 |
| `size-min` / `size-max` | `12` / `28` | Tip-to-tip size range, px |
| `duration` | `1100` | Mean life of a sparkle, ms |
| `spread` | `36` | Scatter radius around the pointer path, px |
| `gravity` | `0` | Downward pull, px/s² — 0: sparkles float in place; positive: they fall; negative: they rise |
| `touch` | off | Also follow touch pointers |
| `disabled` | off | Pause without removing the element |
| `use-host-canvas` | off | Keep sparkles inside the element's box instead of the viewport |
| `disable-for-reduced-motion` | on | No sparkles when the OS asks for reduced motion |

```ts
const sparkle = document.querySelector('k3-sparkle-mouse');
sparkle.colors = ['#00e5ff', '#7c4dff', 'var(--brand)'];
sparkle.intensity = 100;
sparkle.burst(event.clientX, event.clientY, 40); // e.g. on click
sparkle.stop(); // start(), clear()
```

Events: `k3-sparkle-mouse-start`, `k3-sparkle-mouse-stop`. Original canvas implementation
(`SparkleEngine` is exported for use without the element).
