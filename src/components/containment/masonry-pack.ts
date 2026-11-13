/** Shared masonry packer for light-DOM children of a positioned host. */

export interface MasonryPackOptions {
  gap: number;
  columnWidth: number;
  columns?: number;
  minColumns?: number;
  maxColumns?: number;
  animate?: boolean;
}

export function packMasonryItems(
  host: HTMLElement,
  items: HTMLElement[],
  opts: MasonryPackOptions,
): number {
  const hostW = host.clientWidth || host.offsetWidth;
  if (!hostW) return 0;
  const gap = Math.max(0, opts.gap);
  const minC = opts.minColumns ?? 1;
  const maxC = opts.maxColumns ?? 12;
  const colCount = Math.max(
    minC,
    Math.min(
      maxC,
      opts.columns && opts.columns > 0
        ? Math.floor(opts.columns)
        : Math.max(1, Math.floor((hostW + gap) / (Math.max(40, opts.columnWidth) + gap))),
    ),
  );
  const colW = (hostW - gap * (colCount - 1)) / colCount;
  const heights = Array.from({ length: colCount }, () => 0);
  const animate = opts.animate !== false;

  for (const el of items) {
    const hidden = el.hasAttribute('hidden') || el.hasAttribute('data-hidden');
    el.style.position = 'absolute';
    el.style.boxSizing = 'border-box';
    el.style.width = `${colW}px`;
    if (hidden) {
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      continue;
    }
    el.style.opacity = '1';
    el.style.pointerEvents = '';
    el.style.transition = animate
      ? 'top 300ms ease, left 300ms ease, width 300ms ease, opacity 200ms linear'
      : 'none';
    void el.offsetHeight;
    const h = el.getBoundingClientRect().height;
    let shortest = 0;
    for (let i = 1; i < colCount; i++) {
      if ((heights[i] ?? 0) < (heights[shortest] ?? 0)) shortest = i;
    }
    const top = heights[shortest] ?? 0;
    const left = shortest * (colW + gap);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    heights[shortest] = top + h + gap;
  }

  const total = Math.max(0, ...heights) - (heights.some((h) => h > 0) ? gap : 0);
  return Math.max(0, total);
}
