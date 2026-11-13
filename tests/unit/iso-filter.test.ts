import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../src/components/containment/iso-filter.js';
import type { K3IsoFilter } from '../../src/components/containment/iso-filter.js';

describe('k3-iso-filter', () => {
  let el: K3IsoFilter;

  beforeEach(async () => {
    el = document.createElement('k3-iso-filter') as K3IsoFilter;
    el.layout = 'grid';
    el.gap = 4;
    const a = document.createElement('div');
    a.dataset.filter = 'alkali';
    a.textContent = 'Li';
    const b = document.createElement('div');
    b.dataset.filter = 'noble';
    b.textContent = 'He';
    el.append(a, b);
    document.body.append(el);
    await el.updateComplete;
  });

  afterEach(() => {
    el.remove();
  });

  it('registers the custom element', () => {
    expect(customElements.get('k3-iso-filter')).toBeTruthy();
  });

  it('hides items that do not match the active filter', async () => {
    el.filter = 'alkali';
    await el.updateComplete;
    el.refresh();
    const items = [...el.querySelectorAll('[data-filter]')] as HTMLElement[];
    expect(items[0]?.hasAttribute('data-hidden')).toBe(false);
    expect(items[1]?.hasAttribute('data-hidden')).toBe(true);
  });

  it('shows all when filter is *', async () => {
    el.filter = 'noble';
    await el.updateComplete;
    el.setFilter('*');
    await el.updateComplete;
    const hidden = el.querySelectorAll('[data-hidden]');
    expect(hidden.length).toBe(0);
  });
});
