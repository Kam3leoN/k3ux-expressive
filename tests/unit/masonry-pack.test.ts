import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { packMasonryItems } from '../../src/components/containment/masonry-pack.js';

describe('packMasonryItems', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    host.style.cssText = 'position:relative;width:400px;';
    Object.defineProperty(host, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(host, 'offsetWidth', { configurable: true, value: 400 });
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
  });

  it('packs visible items into columns and skips hidden', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    c.setAttribute('data-hidden', '');
    host.append(a, b, c);
    const heights = new Map<HTMLElement, number>([
      [a, 40],
      [b, 60],
      [c, 40],
    ]);
    for (const el of [a, b, c]) {
      el.getBoundingClientRect = () =>
        ({
          width: 120,
          height: heights.get(el) ?? 0,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          },
        }) as DOMRect;
    }

    const h = packMasonryItems(host, [a, b, c], {
      gap: 8,
      columnWidth: 120,
      columns: 2,
      animate: false,
    });

    expect(a.style.position).toBe('absolute');
    expect(b.style.position).toBe('absolute');
    expect(c.style.opacity).toBe('0');
    expect(parseFloat(a.style.left)).toBe(0);
    expect(h).toBe(60);
  });
});
