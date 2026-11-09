/**
 * Confetti canvas engine — TypeScript port of canvas-confetti (Kiril Vatev),
 * adapted from K3ui v1. Vendored in-tree (no npm dependency).
 *
 * @license ISC — Copyright (c) 2020, Kiril Vatev
 * @see https://www.kirilv.com/canvas-confetti/
 * @see https://github.com/catdad/canvas-confetti
 */

import { prefersReducedMotion } from 'k3ui';

export interface ConfettiPathShape {
  type: 'path';
  path: string;
  matrix: number[];
}

export interface ConfettiBitmapShape {
  type: 'bitmap';
  bitmap: ImageBitmap;
  matrix: number[];
}

export type ConfettiFireShape = string | ConfettiPathShape | ConfettiBitmapShape;

export interface ConfettiFireOptions {
  particleCount?: number;
  angle?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  ticks?: number;
  origin?: { x?: number; y?: number };
  shapes?: ConfettiFireShape[];
  zIndex?: number;
  colors?: string[];
  disableForReducedMotion?: boolean;
  scalar?: number;
  flat?: boolean;
  resize?: boolean;
}

type ConfettiShape = ConfettiFireShape;

interface Fetti {
  x: number;
  y: number;
  wobble: number;
  wobbleSpeed: number;
  velocity: number;
  angle2D: number;
  tiltAngle: number;
  color: { r: number; g: number; b: number };
  shape: ConfettiShape;
  tick: number;
  totalTicks: number;
  decay: number;
  drift: number;
  random: number;
  tiltSin: number;
  tiltCos: number;
  wobbleX: number;
  wobbleY: number;
  gravity: number;
  ovalScalar: number;
  scalar: number;
  flat: boolean;
}

interface AnimationObject {
  addFettis: (fettis: Fetti[]) => Promise<void>;
  canvas: HTMLCanvasElement;
  promise: Promise<void>;
  reset: () => void;
}

const _defaults: ConfettiFireOptions & {
  particleCount: number;
  angle: number;
  spread: number;
  startVelocity: number;
  decay: number;
  gravity: number;
  drift: number;
  ticks: number;
  origin: { x: number; y: number };
  shapes: ConfettiFireShape[];
  zIndex: number;
  colors: string[];
  disableForReducedMotion: boolean;
  scalar: number;
  flat: boolean;
  resize: boolean;
} = {
  "particleCount": 50,
  "angle": 90,
  "spread": 45,
  "startVelocity": 45,
  "decay": 0.9,
  "gravity": 1,
  "drift": 0,
  "ticks": 200,
  "origin": {
    "x": 0.5,
    "y": 0.5
  },
  "shapes": [
    "square",
    "circle"
  ],
  "zIndex": 100,
  "colors": [
    "#26ccff",
    "#a25afd",
    "#ff5e7e",
    "#88ff5a",
    "#fcff42",
    "#ffa62d",
    "#ff36ff"
  ],
  "disableForReducedMotion": true,
  "scalar": 1,
  "flat": false,
  "resize": true
};

const canUsePaths = typeof Path2D === 'function' && typeof DOMMatrix === 'function';

/**
 * Vérifie si OffscreenCanvas est disponible et peut dessiner des bitmaps
 * Identique à canvas-confetti
 */
const canDrawBitmap = (function () {
    if (typeof OffscreenCanvas === 'undefined') {
        return false;
    }

    try {
        const canvas = new OffscreenCanvas(1, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        ctx.fillRect(0, 0, 1, 1);
        const bitmap = canvas.transferToImageBitmap();
        ctx.createPattern(bitmap, 'no-repeat');
        return true;
    } catch (e) {
        return false;
    }
})();

// ============================================================================
// UTILITAIRES (identiques à canvas-confetti)
// ============================================================================

/**
 * Mapper pour les bitmaps (cache pour performances)
 * Identique à canvas-confetti bitmapMapper
 * @see https://github.com/catdad/canvas-confetti/issues/209
 */
const bitmapMapper = (function (skipTransform: boolean, map: Map<ImageBitmap, OffscreenCanvas>) {
    return {
        transform: function (bitmap: ImageBitmap): OffscreenCanvas | ImageBitmap {
            if (skipTransform) {
                return bitmap;
            }

            if (map.has(bitmap)) {
                return map.get(bitmap)!;
            }

            const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(bitmap, 0, 0);
            map.set(bitmap, canvas);
            return canvas;
        },
        clear: function (): void {
            map.clear();
        },
    };
})(!canDrawBitmap, new Map<ImageBitmap, OffscreenCanvas>());

/**
 * Gestionnaire RAF amélioré
 * Identique à canvas-confetti raf
 */
const raf = (function () {
    const TIME = Math.floor(1000 / 60);
    let frame: ((cb: () => void) => number) | null = null;
    let cancel: ((id: number) => void) | null = null;
    const frames: { [key: number]: number } = {};
    let lastFrameTime = 0;

    if (typeof requestAnimationFrame === 'function' && typeof cancelAnimationFrame === 'function') {
        frame = function (cb: () => void): number {
            const id = Math.random();

            frames[id] = requestAnimationFrame(function onFrame(time: number) {
                if (lastFrameTime === time || lastFrameTime + TIME - 1 < time) {
                    lastFrameTime = time;
                    delete frames[id];
                    cb();
                } else {
                    frames[id] = requestAnimationFrame(onFrame);
                }
            });

            return id;
        };

        cancel = function (id: number): void {
            if (frames[id]) {
                cancelAnimationFrame(frames[id]);
                delete frames[id];
            }
        };
    } else {
        frame = function (cb: () => void): number {
            return window.setTimeout(cb, TIME);
        };

        cancel = function (timer: number): void {
            clearTimeout(timer);
        };
    }

    return { frame: frame!, cancel: cancel! };
})();


export type ConfettiCannonOptions = ConfettiFireOptions;

/**
 * Imperative confetti cannon (fullscreen lib canvas, or custom HTMLCanvasElement).
 */
export class ConfettiCannon {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationObj: AnimationObject | null = null;
  private initialized = false;
  private allowResize: boolean;
  private hasResizeEventRegistered = false;
  private readonly isLibCanvas: boolean;
  private globalDisableForReducedMotion: boolean;
  private resizer: (canvas: HTMLCanvasElement) => void;
  private options: ConfettiFireOptions;
  /** Shared size bag — mutated by the resize listener; kept across bursts. */
  private size = { width: 0, height: 0 };
  private readonly onResize = (): void => {
    this.size.width = this.size.height = 0;
  };

  constructor(
    host: HTMLElement | HTMLCanvasElement | null = null,
    options: ConfettiFireOptions = {},
  ) {
    this.isLibCanvas = !(host instanceof HTMLCanvasElement);
    if (!this.isLibCanvas) {
      this.canvas = host as HTMLCanvasElement;
    }
    this.options = { ..._defaults, ...options };
    this.allowResize = Boolean(prop(this.options, 'resize'));
    this.globalDisableForReducedMotion = Boolean(
      prop(this.options, 'disableForReducedMotion', (val) => Boolean(val)),
    );
    this.resizer = this.isLibCanvas ? setCanvasWindowSize : setCanvasRectSize;
  }

  /**
   * Create + size the fullscreen canvas and touch a 2d context once.
   * Call early (e.g. on `k3-confetti` connect) so the first burst is not cold.
   */
  warm(): void {
    if (typeof document === 'undefined') return;
    if (this.globalDisableForReducedMotion && prefersReducedMotion()) return;
    this.ensureCanvas();
    this.ensureSized();
    this.ensureResizeListener();
  }

  private ensureCanvas(zIndex?: number): boolean {
    if (this.isLibCanvas && this.animationObj) {
      this.canvas = this.animationObj.canvas;
    } else if (this.isLibCanvas && !this.canvas) {
      const z = zIndex ?? Number(prop(this.options, 'zIndex', Number));
      this.canvas = getCanvas(z);
      this.canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(this.canvas);
    }
    if (!this.canvas) return false;
    if (!this.ctx) {
      try {
        this.ctx = this.canvas.getContext('2d', {
          desynchronized: true,
          alpha: true,
        });
      } catch {
        this.ctx = null;
      }
      if (!this.ctx) {
        try {
          this.ctx = this.canvas.getContext('2d');
        } catch {
          this.ctx = null;
        }
      }
    }
    return !!this.ctx;
  }

  private ensureSized(): void {
    if (!this.canvas) return;
    if (!this.initialized || this.canvas.width === 0 || this.canvas.height === 0) {
      this.resizer(this.canvas);
      this.initialized = true;
    }
    this.size.width = this.canvas.width;
    this.size.height = this.canvas.height;
  }

  private ensureResizeListener(): void {
    if (!this.allowResize || this.hasResizeEventRegistered) return;
    if (typeof window === 'undefined') return;
    this.hasResizeEventRegistered = true;
    window.addEventListener('resize', this.onResize, false);
  }

  private fireLocal(options: ConfettiFireOptions): Promise<void> {
    const particleCount = prop(options, 'particleCount', (val) =>
      onlyPositiveInt(Number(val)),
    ) as number;
    const angle = Number(prop(options, 'angle', Number));
    const spread = Number(prop(options, 'spread', Number));
    const startVelocity = Number(prop(options, 'startVelocity', Number));
    const decay = Number(prop(options, 'decay', Number));
    const gravity = Number(prop(options, 'gravity', Number));
    const drift = Number(prop(options, 'drift', Number));
    const colors = prop(options, 'colors', (val) =>
      colorsToRgb(val as string[]),
    ) as { r: number; g: number; b: number }[];
    const ticks = Number(prop(options, 'ticks', Number));
    const shapes = (prop(options, 'shapes') as ConfettiFireShape[]) ?? ['square'];
    const scalar = Number(prop(options, 'scalar'));
    const flat = Boolean(prop(options, 'flat'));
    const origin = getOrigin(options);

    let temp = particleCount;
    const fettis: Fetti[] = [];
    const startX = this.canvas!.width * origin.x;
    const startY = this.canvas!.height * origin.y;

    while (temp--) {
      fettis.push(
        randomPhysics({
          x: startX,
          y: startY,
          angle,
          spread,
          startVelocity,
          color: colors[temp % colors.length]!,
          shape: shapes[randomInt(0, shapes.length)]!,
          ticks,
          decay,
          gravity,
          drift,
          scalar,
          flat,
        }),
      );
    }

    if (this.animationObj) {
      return this.animationObj.addFettis(fettis);
    }

    const done = () => {
      // Keep the lib canvas mounted — tearing it down every burst forces a
      // costly GPU realloc on the next fire (visible hitch on the demo page).
      this.animationObj = null;
    };

    this.animationObj = animate(this.canvas!, fettis, this.resizer, this.size, done);
    return this.animationObj.promise;
  }

  /**
   * Fire several independent origins in one animation tick (used by rain).
   * Much cheaper than N separate `fire({ particleCount: 1 })` calls.
   */
  fireSpread(shots: ConfettiFireOptions[]): Promise<void> {
    if (!shots.length) return Promise.resolve();
    if (
      this.globalDisableForReducedMotion &&
      prefersReducedMotion()
    ) {
      return Promise.resolve();
    }
    if (!this.ensureCanvas() || !this.canvas) return Promise.resolve();
    this.ensureSized();
    this.ensureResizeListener();

    const fettis: Fetti[] = [];
    for (const options of shots) {
      const particleCount = prop(options, 'particleCount', (val) =>
        onlyPositiveInt(Number(val)),
      ) as number;
      const angle = Number(prop(options, 'angle', Number));
      const spread = Number(prop(options, 'spread', Number));
      const startVelocity = Number(prop(options, 'startVelocity', Number));
      const decay = Number(prop(options, 'decay', Number));
      const gravity = Number(prop(options, 'gravity', Number));
      const drift = Number(prop(options, 'drift', Number));
      const colors = prop(options, 'colors', (val) =>
        colorsToRgb(val as string[]),
      ) as { r: number; g: number; b: number }[];
      const ticks = Number(prop(options, 'ticks', Number));
      const shapes = (prop(options, 'shapes') as ConfettiFireShape[]) ?? ['square'];
      const scalar = Number(prop(options, 'scalar'));
      const flat = Boolean(prop(options, 'flat'));
      const origin = getOrigin(options);
      const startX = this.canvas.width * origin.x;
      const startY = this.canvas.height * origin.y;
      let temp = particleCount;
      while (temp--) {
        fettis.push(
          randomPhysics({
            x: startX,
            y: startY,
            angle,
            spread,
            startVelocity,
            color: colors[temp % colors.length]!,
            shape: shapes[randomInt(0, shapes.length)]!,
            ticks,
            decay,
            gravity,
            drift,
            scalar,
            flat,
          }),
        );
      }
    }

    if (this.animationObj) {
      return this.animationObj.addFettis(fettis);
    }

    const done = () => {
      this.animationObj = null;
    };
    this.animationObj = animate(this.canvas, fettis, this.resizer, this.size, done);
    return this.animationObj.promise;
  }

  fire(options: ConfettiFireOptions = {}): Promise<void> {
    const disableForReducedMotion =
      this.globalDisableForReducedMotion ||
      Boolean(prop(options, 'disableForReducedMotion', (val) => Boolean(val)));
    const zIndex = Number(prop(options, 'zIndex', Number));

    if (disableForReducedMotion && prefersReducedMotion()) {
      return Promise.resolve();
    }

    if (!this.ensureCanvas(zIndex)) {
      return Promise.resolve();
    }

    this.ensureSized();
    this.ensureResizeListener();

    return this.fireLocal(options);
  }

  reset(): void {
    this.animationObj?.reset();
  }

  destroy(): void {
    this.reset();
    if (this.hasResizeEventRegistered && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onResize);
      this.hasResizeEventRegistered = false;
    }
    if (this.isLibCanvas && this.canvas && document.body.contains(this.canvas)) {
      document.body.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.initialized = false;
    this.size.width = this.size.height = 0;
    bitmapMapper.clear();
  }

  static shapeFromPath(
    pathData: string | { path: string; matrix?: number[] },
  ): ConfettiPathShape {
    return shapeFromPathImpl(pathData);
  }

  static shapeFromText(
    textData:
      | string
      | { text: string; scalar?: number; fontFamily?: string; color?: string },
  ): ConfettiBitmapShape {
    return shapeFromTextImpl(textData);
  }
}

export function shapeFromPath(
  pathData: string | { path: string; matrix?: number[] },
): ConfettiPathShape {
  return shapeFromPathImpl(pathData);
}

export function shapeFromText(
  textData:
    | string
    | { text: string; scalar?: number; fontFamily?: string; color?: string },
): ConfettiBitmapShape {
  return shapeFromTextImpl(textData);
}

/**
 * Crée une forme à partir d'un path SVG
 * Identique à canvas-confetti shapeFromPath
 */
function shapeFromPathImpl(
    pathData: string | { path: string; matrix?: number[] }
): ConfettiPathShape {
    if (!canUsePaths) {
        throw new Error('path confetti are not supported in this browser');
    }

    let path: string;
    let matrix: number[] | undefined;

    if (typeof pathData === 'string') {
        path = pathData;
    } else {
        path = pathData.path;
        matrix = pathData.matrix;
    }

    const path2d = new Path2D(path);
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;

    if (!matrix) {
        // Tenter de déterminer la largeur du path, jusqu'à 1000x1000
        const maxSize = 1000;
        let minX = maxSize;
        let minY = maxSize;
        let maxX = 0;
        let maxY = 0;
        let width: number, height: number;

        // Faire un saut de lignes... c'est plus rapide que de vérifier
        // chaque pixel et sera toujours correct
        for (let x = 0; x < maxSize; x += 2) {
            for (let y = 0; y < maxSize; y += 2) {
                if (tempCtx.isPointInPath(path2d, x, y, 'nonzero')) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        width = maxX - minX;
        height = maxY - minY;

        const maxDesiredSize = 10;
        const scale = Math.min(maxDesiredSize / width, maxDesiredSize / height);

        matrix = [
            scale,
            0,
            0,
            scale,
            -Math.round((width / 2) + minX) * scale,
            -Math.round((height / 2) + minY) * scale,
        ];
    }

    return {
        type: 'path',
        path: path,
        matrix: matrix,
    };
}

/**
 * Crée une forme à partir d'un texte/emoji
 * Identique à canvas-confetti shapeFromText
 * @see https://nolanlawson.com/2022/04/08/the-struggle-of-using-native-emoji-on-the-web/
 */
function shapeFromTextImpl(
    textData:
        | string
        | {
            text: string;
            scalar?: number;
            fontFamily?: string;
            color?: string;
        }
): ConfettiBitmapShape {
    if (typeof OffscreenCanvas === 'undefined') {
        throw new Error('text confetti are not supported in this browser');
    }

    let text: string;
    let scalar = 1;
    let color = '#000000';
    // Voir https://nolanlawson.com/2022/04/08/the-struggle-of-using-native-emoji-on-the-web/
    const fontFamily =
        '"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "EmojiOne Color", "Android Emoji", "Twemoji Mozilla", "system emoji", sans-serif';

    if (typeof textData === 'string') {
        text = textData;
    } else {
        text = textData.text;
        scalar = 'scalar' in textData ? textData.scalar || 1 : scalar;
        color = 'color' in textData ? textData.color || color : color;
    }

    // Tous les autres confettis font 10 pixels,
    // donc cette taille de pixel est le facteur d'échelle 100% de facto
    const fontSize = 10 * scalar;
    const font = `${fontSize}px ${fontFamily}`;

    let canvas = new OffscreenCanvas(fontSize, fontSize);
    let ctx = canvas.getContext('2d')!;

    ctx.font = font;
    const size = ctx.measureText(text);
    let width = Math.ceil(size.actualBoundingBoxRight + size.actualBoundingBoxLeft);
    let height = Math.ceil(size.actualBoundingBoxAscent + size.actualBoundingBoxDescent);

    const padding = 2;
    const x = size.actualBoundingBoxLeft + padding;
    const y = size.actualBoundingBoxAscent + padding;
    width += padding + padding;
    height += padding + padding;

    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d')!;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    const scale = 1 / scalar;

    return {
        type: 'bitmap',
        bitmap: canvas.transferToImageBitmap(),
        matrix: [scale, 0, 0, scale, (-width * scale) / 2, (-height * scale) / 2],
    };
}

/**
 * Transforme un Path2D avec une matrice de transformation
 * Identique à canvas-confetti transformPath2D
 */
function transformPath2D(
    pathString: string,
    pathMatrix: number[],
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    rotation: number
): Path2D {
    if (!canUsePaths) {
        throw new Error('Path2D is not supported in this browser');
    }

    const path2d = new Path2D(pathString);
    const t1 = new Path2D();
    t1.addPath(path2d, new DOMMatrix(pathMatrix));

    const t2 = new Path2D();
    // Voir https://developer.mozilla.org/en-US/docs/Web/API/DOMMatrix/DOMMatrix
    t2.addPath(
        t1,
        new DOMMatrix([
            Math.cos(rotation) * scaleX,
            Math.sin(rotation) * scaleX,
            -Math.sin(rotation) * scaleY,
            Math.cos(rotation) * scaleY,
            x,
            y,
        ])
    );

    return t2;
}

/**
 * Convertit une valeur avec transformation optionnelle
 * Identique à canvas-confetti convert
 */
function convert<T>(val: unknown, transform?: (val: unknown) => T): T {
    return transform ? transform(val) : (val as T);
}

/**
 * Vérifie si une valeur est valide (non null et non undefined)
 * Identique à canvas-confetti isOk
 */
function isOk(val: unknown): boolean {
    return !(val === null || val === undefined);
}

type ConfettiPropSource = ConfettiFireOptions;

/**
 * Récupère une propriété depuis les options ou les defaults
 * Identique à canvas-confetti prop
 */
function prop(
    options: ConfettiPropSource,
    name: string,
    transform?: (val: unknown) => unknown
): unknown {
    const defaults = _defaults as unknown as Record<string, unknown>;
    const source = options as unknown as Record<string, unknown>;
    const raw = source && isOk(source[name]) ? source[name] : defaults[name];
    return convert(raw, transform);
}

/**
 * Convertit un nombre en entier positif
 * Identique à canvas-confetti onlyPositiveInt
 */
function onlyPositiveInt(number: number): number {
    return number < 0 ? 0 : Math.floor(number);
}

/**
 * Génère un entier aléatoire entre min et max [min, max)
 * Identique à canvas-confetti randomInt
 */
function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Convertit une couleur hex en RGB
 * Identique à canvas-confetti hexToRgb
 */
function hexToRgb(str: string): { r: number; g: number; b: number } {
    let val = String(str).replace(/[^0-9a-f]/gi, '');

    if (val.length < 6) {
        val = val[0] + val[0] + val[1] + val[1] + val[2] + val[2];
    }

    return {
        r: parseInt(val.substring(0, 2), 16),
        g: parseInt(val.substring(2, 4), 16),
        b: parseInt(val.substring(4, 6), 16),
    };
}

/**
 * Convertit un tableau de couleurs hex en RGB
 * Identique à canvas-confetti colorsToRgb
 */
function colorsToRgb(colors: string[]): { r: number; g: number; b: number }[] {
    return colors.map(hexToRgb);
}

/**
 * Récupère l'origine depuis les options
 * Identique à canvas-confetti getOrigin
 * 
 * IMPORTANT: Dans canvas-confetti, prop(origin, 'x', Number) cherche defaults.x (pas defaults.origin.x)
 * car les valeurs par défaut sont x: 0.5 et y: 0.5 directement dans defaults, pas dans defaults.origin
 * 
 * Pour simuler ce comportement, on utilise directement les valeurs par défaut depuis _defaults.origin
 * et on applique la même logique que prop() manuellement
 */
function getOrigin(options: ConfettiFireOptions): { x: number; y: number } {
    const origin = (prop(options, 'origin') ?? {}) as { x?: number; y?: number };
    const defaultX = _defaults.origin?.x ?? 0.5;
    const defaultY = _defaults.origin?.y ?? 0.5;
    const x = isOk(origin.x) ? Number(origin.x) : Number(defaultX);
    const y = isOk(origin.y) ? Number(origin.y) : Number(defaultY);
    return { x, y };
}

/**
 * Définit la taille du canvas selon la fenêtre
 * Identique à canvas-confetti setCanvasWindowSize
 */
function setCanvasWindowSize(canvas: HTMLCanvasElement): void {
    const w = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    // Assigning canvas.width/height reallocates the GPU buffer — skip no-ops.
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
}

/**
 * Définit la taille du canvas selon son rect
 * Identique à canvas-confetti setCanvasRectSize
 */
function setCanvasRectSize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(0, Math.floor(rect.width));
    const h = Math.max(0, Math.floor(rect.height));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
}

/**
 * Crée un canvas pour la fenêtre
 * Identique à canvas-confetti getCanvas
 */
function getCanvas(zIndex: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    // Forcer position: fixed avec !important pour éviter les conflits avec les styles CSS
    canvas.style.setProperty('position', 'fixed', 'important');
    canvas.style.setProperty('top', '0px', 'important');
    canvas.style.setProperty('left', '0px', 'important');
    canvas.style.setProperty('pointer-events', 'none', 'important');
    canvas.style.setProperty('z-index', String(zIndex), 'important');
    // S'assurer qu'aucune classe CSS ne surcharge nos styles
    canvas.removeAttribute('class');
    return canvas;
}

/**
 * Dessine une ellipse (fallback pour navigateurs sans support)
 * Identique à canvas-confetti ellipse
 */
function ellipse(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    radiusX: number,
    radiusY: number,
    rotation: number,
    startAngle: number,
    endAngle: number,
    antiClockwise?: boolean
): void {
    context.save();
    context.translate(x, y);
    context.rotate(rotation);
    context.scale(radiusX, radiusY);
    context.arc(0, 0, 1, startAngle, endAngle, antiClockwise);
    context.restore();
}

/**
 * Génère une physique aléatoire pour une particule
 * Identique à canvas-confetti randomPhysics
 */
interface ConfettiPhysicsInput {
    angle: number;
    spread: number;
    startVelocity: number;
    x: number;
    y: number;
    color: { r: number; g: number; b: number };
    shape: ConfettiShape;
    ticks: number;
    decay: number;
    drift: number;
    gravity: number;
    scalar: number;
    flat: boolean;
}

function randomPhysics(opts: ConfettiPhysicsInput): Fetti {
    const radAngle = opts.angle * (Math.PI / 180);
    const radSpread = opts.spread * (Math.PI / 180);

    return {
        x: opts.x,
        y: opts.y,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
        velocity: opts.startVelocity * 0.5 + Math.random() * opts.startVelocity,
        angle2D: -radAngle + (0.5 * radSpread - Math.random() * radSpread),
        tiltAngle: (Math.random() * (0.75 - 0.25) + 0.25) * Math.PI,
        color: opts.color,
        shape: opts.shape,
        tick: 0,
        totalTicks: opts.ticks,
        decay: opts.decay,
        drift: opts.drift,
        random: Math.random() + 2,
        tiltSin: 0,
        tiltCos: 0,
        wobbleX: 0,
        wobbleY: 0,
        gravity: opts.gravity * 3,
        ovalScalar: 0.6,
        scalar: opts.scalar,
        flat: opts.flat,
    };
}

/**
 * Met à jour une particule de confetti
 * Identique à canvas-confetti updateFetti
 */
function updateFetti(context: CanvasRenderingContext2D, fetti: Fetti): boolean {
    fetti.x += Math.cos(fetti.angle2D) * fetti.velocity + fetti.drift;
    fetti.y += Math.sin(fetti.angle2D) * fetti.velocity + fetti.gravity;
    fetti.velocity *= fetti.decay;

    if (fetti.flat) {
        fetti.wobble = 0;
        fetti.wobbleX = fetti.x + 10 * fetti.scalar;
        fetti.wobbleY = fetti.y + 10 * fetti.scalar;
        fetti.tiltSin = 0;
        fetti.tiltCos = 0;
        fetti.random = 1;
    } else {
        fetti.wobble += fetti.wobbleSpeed;
        fetti.wobbleX = fetti.x + 10 * fetti.scalar * Math.cos(fetti.wobble);
        fetti.wobbleY = fetti.y + 10 * fetti.scalar * Math.sin(fetti.wobble);
        fetti.tiltAngle += 0.1;
        fetti.tiltSin = Math.sin(fetti.tiltAngle);
        fetti.tiltCos = Math.cos(fetti.tiltAngle);
        fetti.random = Math.random() + 2;
    }

    const progress = fetti.tick++ / fetti.totalTicks;
    const x1 = fetti.x + fetti.random * fetti.tiltCos;
    const y1 = fetti.y + fetti.random * fetti.tiltSin;
    const x2 = fetti.wobbleX + fetti.random * fetti.tiltCos;
    const y2 = fetti.wobbleY + fetti.random * fetti.tiltSin;

    context.fillStyle = `rgba(${fetti.color.r}, ${fetti.color.g}, ${fetti.color.b}, ${1 - progress})`;
    context.beginPath();

    // Support des paths SVG (identique à canvas-confetti)
    if (
        canUsePaths &&
        typeof fetti.shape === 'object' &&
        fetti.shape.type === 'path' &&
        typeof fetti.shape.path === 'string' &&
        Array.isArray(fetti.shape.matrix)
    ) {
        context.fill(
            transformPath2D(
                fetti.shape.path,
                fetti.shape.matrix,
                fetti.x,
                fetti.y,
                Math.abs(x2 - x1) * 0.1,
                Math.abs(y2 - y1) * 0.1,
                (Math.PI / 10) * fetti.wobble
            )
        );
    }
    // Support des bitmaps (identique à canvas-confetti)
    else if (typeof fetti.shape === 'object' && fetti.shape.type === 'bitmap') {
        const rotation = (Math.PI / 10) * fetti.wobble;
        const scaleX = Math.abs(x2 - x1) * 0.1;
        const scaleY = Math.abs(y2 - y1) * 0.1;
        const width = fetti.shape.bitmap.width * fetti.scalar;
        const height = fetti.shape.bitmap.height * fetti.scalar;

        const matrix = new DOMMatrix([
            Math.cos(rotation) * scaleX,
            Math.sin(rotation) * scaleX,
            -Math.sin(rotation) * scaleY,
            Math.cos(rotation) * scaleY,
            fetti.x,
            fetti.y,
        ]);

        // Appliquer la matrice de transformation de la forme
        matrix.multiplySelf(new DOMMatrix(fetti.shape.matrix));

        const pattern = context.createPattern(
            bitmapMapper.transform(fetti.shape.bitmap) as CanvasImageSource,
            'no-repeat'
        );
        if (pattern) {
            pattern.setTransform(matrix);
            context.globalAlpha = 1 - progress;
            context.fillStyle = pattern;
            context.fillRect(fetti.x - width / 2, fetti.y - height / 2, width, height);
            context.globalAlpha = 1;
        }
    }
    // Support des cercles (identique à canvas-confetti)
    else if (fetti.shape === 'circle') {
        context.ellipse
            ? context.ellipse(
                fetti.x,
                fetti.y,
                Math.abs(x2 - x1) * fetti.ovalScalar,
                Math.abs(y2 - y1) * fetti.ovalScalar,
                (Math.PI / 10) * fetti.wobble,
                0,
                2 * Math.PI
            )
            : ellipse(
                context,
                fetti.x,
                fetti.y,
                Math.abs(x2 - x1) * fetti.ovalScalar,
                Math.abs(y2 - y1) * fetti.ovalScalar,
                (Math.PI / 10) * fetti.wobble,
                0,
                2 * Math.PI
            );
    }
    // Support des étoiles (identique à canvas-confetti)
    else if (fetti.shape === 'star') {
        let rot = (Math.PI / 2) * 3;
        const innerRadius = 4 * fetti.scalar;
        const outerRadius = 8 * fetti.scalar;
        let x = fetti.x;
        let y = fetti.y;
        let spikes = 5;
        const step = Math.PI / spikes;

        while (spikes--) {
            x = fetti.x + Math.cos(rot) * outerRadius;
            y = fetti.y + Math.sin(rot) * outerRadius;
            context.lineTo(x, y);
            rot += step;
            x = fetti.x + Math.cos(rot) * innerRadius;
            y = fetti.y + Math.sin(rot) * innerRadius;
            context.lineTo(x, y);
            rot += step;
        }
    }
    // Formes carrées par défaut (identique à canvas-confetti)
    else {
        context.moveTo(Math.floor(fetti.x), Math.floor(fetti.y));
        context.lineTo(Math.floor(fetti.wobbleX), Math.floor(y1));
        context.lineTo(Math.floor(x2), Math.floor(y2));
        context.lineTo(Math.floor(x1), Math.floor(fetti.wobbleY));
    }

    context.closePath();
    context.fill();

    return fetti.tick < fetti.totalTicks;
}

/**
 * Anime les confettis
 * Identique à canvas-confetti animate
 */
function animate(
    canvas: HTMLCanvasElement,
    fettis: Fetti[],
    resizer: (canvas: HTMLCanvasElement) => void,
    size: { width: number; height: number },
    done: () => void
): AnimationObject {
    let animatingFettis = fettis.slice();
    const context = canvas.getContext('2d');
    let animationFrame: number | null = null;
    let destroy: (() => void) | null = null;

    const promise = new Promise<void>((resolve) => {
        if (!context) {
          done();
          resolve();
          return;
        }
        const onDone = () => {
            animationFrame = null;
            destroy = null;
            try {
              context.clearRect(0, 0, size.width, size.height);
            } catch {
              /* jsdom / detached canvas */
            }
            bitmapMapper.clear();
            done();
            resolve();
        };

        const update = () => {
            if (!size.width && !size.height) {
                resizer(canvas);
                size.width = canvas.width;
                size.height = canvas.height;
            }

            context.clearRect(0, 0, size.width, size.height);

            animatingFettis = animatingFettis.filter((fetti) => updateFetti(context, fetti));

            if (animatingFettis.length) {
                animationFrame = raf.frame(update);
            } else {
                onDone();
            }
        };

        animationFrame = raf.frame(update);
        destroy = onDone;
    });

    return {
        addFettis: (newFettis: Fetti[]) => {
            animatingFettis = animatingFettis.concat(newFettis);
            return promise;
        },
        canvas,
        promise,
        reset: () => {
            if (animationFrame !== null) {
                raf.cancel(animationFrame);
            }
            if (destroy) {
                destroy();
            }
        },
    };
}


