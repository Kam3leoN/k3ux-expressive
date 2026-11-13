/**
 * Scratch-card engine — metallic covers, brushes, erasing and measuring.
 * Pure canvas helpers used by `k3-scratch-card`; the four erase styles
 * reproduce scratchcard-js (Masth0, MIT) pixel for pixel, rewritten here.
 */

export type ScratchType = 'line' | 'circle' | 'spray' | 'brush';
export type ScratchMetal = 'silver' | 'gold';

export interface ScratchStroke {
  type: ScratchType;
  /** Line width · circle radius · spray diameter (CSS px). */
  radius: number;
  sprayPoints: number;
  /** Spray dot diameter (CSS px). */
  sprayDotSize: number;
  /** Device pixel ratio of the canvas (the line blur scales with it). */
  ratio: number;
}

interface Metal {
  stops: readonly string[];
  print: string;
  ink: string;
  shadow: string;
  light: string;
}

const METALS: Record<ScratchMetal, Metal> = {
  silver: {
    stops: ['#8f959c', '#d9dde1', '#a7adb4', '#f2f4f5', '#9ca2a9', '#cfd3d8', '#8b9198'],
    print: '#6f767e',
    ink: '#8a9097',
    shadow: 'rgba(40, 44, 50, 0.55)',
    light: 'rgba(255, 255, 255, 0.85)',
  },
  gold: {
    stops: ['#a87a22', '#f3d77e', '#c3922f', '#fff0b3', '#b4852a', '#e8c25e', '#9d711c'],
    print: '#7d5714',
    ink: '#b58a2e',
    shadow: 'rgba(74, 48, 6, 0.6)',
    light: 'rgba(255, 249, 225, 0.9)',
  },
};

export function isMetal(cover: string): cover is ScratchMetal {
  return cover === 'silver' || cover === 'gold';
}

/** Reproducible pseudo-random numbers (mulberry32). */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let grainTile: HTMLCanvasElement | null = null;

/** Fine matte grain of the latex layer. */
function grain(): HTMLCanvasElement | null {
  if (grainTile) return grainTile;
  const size = 128;
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const ctx = tile.getContext('2d');
  if (!ctx) return null;
  const random = seeded(11);
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const light = random() > 0.5;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = light ? 255 : 0;
    image.data[i + 3] = Math.round(random() * (light ? 46 : 38));
  }
  ctx.putImageData(image, 0, 0);
  return (grainTile = tile);
}

/** Silver or gold cover: metallic bands, printed pattern, grain, sheen and an engraved label. */
export function paintMetal(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ratio: number,
  metalName: ScratchMetal,
  label: string,
  font: string,
): void {
  const metal = METALS[metalName];
  const base = ctx.createLinearGradient(0, 0, width, height * 0.6);
  metal.stops.forEach((color, i) => base.addColorStop(i / (metal.stops.length - 1), color));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  /* Printed pattern: staggered diamonds */
  ctx.save();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = metal.print;
  ctx.beginPath();
  const step = 16;
  for (let row = 0, y = 0; y < height + step; row++, y += step * 0.75) {
    for (let x = row % 2 ? step / 2 : 0; x < width + step; x += step) {
      ctx.moveTo(x, y - 2.6);
      ctx.lineTo(x + 2.6, y);
      ctx.lineTo(x, y + 2.6);
      ctx.lineTo(x - 2.6, y);
      ctx.closePath();
    }
  }
  ctx.fill();
  ctx.restore();

  /* Grain at device resolution */
  const tile = grain();
  const pattern = tile ? ctx.createPattern(tile, 'repeat') : null;
  if (pattern) {
    if (typeof DOMMatrix === 'function') pattern.setTransform(new DOMMatrix().scale(1 / ratio));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }

  /* Slanted sheen, slightly darker edges */
  const sheen = ctx.createLinearGradient(0, height, width, 0);
  sheen.addColorStop(0.28, 'rgba(255, 255, 255, 0)');
  sheen.addColorStop(0.42, 'rgba(255, 255, 255, 0.32)');
  sheen.addColorStop(0.56, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, width, height);
  const edge = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.35,
    width / 2,
    height / 2,
    Math.hypot(width, height) * 0.62,
  );
  edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edge.addColorStop(1, 'rgba(0, 0, 0, 0.16)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, width, height);

  /* Engraved label */
  if (label) {
    const size = Math.max(12, Math.min(width * 0.11, height * 0.2, 44));
    ctx.save();
    ctx.font = `700 ${size}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const depth = Math.max(1, size / 26);
    ctx.fillStyle = metal.light;
    ctx.fillText(label, width / 2 - depth, height / 2 - depth);
    ctx.fillStyle = metal.shadow;
    ctx.fillText(label, width / 2 + depth, height / 2 + depth);
    ctx.fillStyle = metal.ink;
    ctx.fillText(label, width / 2, height / 2);
    ctx.restore();
  }
}

/** Draw an image cover like `object-fit: cover`. */
export function paintImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
}

/** Built-in brush: elongated blot with ragged edges, 50 × 50 px (drawn at 2× to stay sharp). */
export function defaultBrush(): HTMLCanvasElement {
  const brush = document.createElement('canvas');
  brush.width = brush.height = 100;
  brush.dataset.size = '50';
  const ctx = brush.getContext('2d');
  if (!ctx) return brush;
  ctx.scale(2, 2);
  const random = seeded(7);
  ctx.beginPath();
  const points = 30;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const jitter = 0.84 + random() * 0.28;
    const x = 25 + Math.cos(angle) * 21 * jitter;
    const y = 25 + Math.sin(angle) * 8.5 * jitter;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(25 + (random() - 0.5) * 44, 25 + (random() - 0.5) * 22, 0.7 + random() * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  return brush;
}

/** Display size of a brush (CSS px). */
export function brushSize(source: CanvasImageSource): [number, number] {
  if (source instanceof HTMLImageElement) return [source.naturalWidth, source.naturalHeight];
  if (source instanceof HTMLCanvasElement && source.dataset.size) {
    const size = Number(source.dataset.size);
    return [size, size];
  }
  const { width, height } = source as { width: number | SVGAnimatedLength; height: number | SVGAnimatedLength };
  return [
    typeof width === 'number' ? width : width.baseVal.value,
    typeof height === 'number' ? height : height.baseVal.value,
  ];
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous'; /* needed to measure an image from another origin */
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`image not found: ${src}`));
    image.src = src;
  });
}

/**
 * Erase the cover at (x, y) in CSS px. `path` carries the current line
 * (the whole line is stroked again on each move: its blurred edges fade out).
 */
export function scratchAt(
  ctx: CanvasRenderingContext2D,
  stroke: ScratchStroke,
  x: number,
  y: number,
  path: Path2D | null,
  brush: CanvasImageSource | null,
): void {
  const { type, radius, sprayPoints, sprayDotSize, ratio } = stroke;
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = ctx.strokeStyle = '#000';
  switch (type) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'spray': {
      /* Dots spread in a disc of diameter `radius` around the pointer */
      const r = radius / 2;
      for (let i = 0; i < sprayPoints; i++) {
        const dx = Math.random() * 2 * r - r;
        const limit = Math.sqrt(r * r - dx * dx);
        const dy = Math.random() * 2 * limit - limit;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, sprayDotSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'brush': {
      if (!brush) break;
      const [w, h] = brushSize(brush);
      /* The brush turns with the position seen from the top-left corner */
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(y, x));
      ctx.drawImage(brush, -w / 2, -h / 2, w, h);
      break;
    }
    default: {
      if (!path) break;
      path.lineTo(x, y);
      ctx.lineWidth = radius;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.filter = `blur(${ratio}px)`;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

/**
 * Share of fully erased pixels, 0 … 100 (one pixel in two, three… on large
 * canvases). `null` when pixels cannot be read (cross-origin image without CORS).
 */
export function measureCleared(ctx: CanvasRenderingContext2D, width: number, height: number, maxSamples = 90_000): number | null {
  if (!width || !height) return 0;
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / maxSamples)));
  let cleared = 0;
  let total = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0, i = y * width * 4 + 3; x < width; x += step, i += step * 4) {
      total++;
      if (data[i] === 0) cleared++;
    }
  }
  return total ? (cleared / total) * 100 : 0;
}
