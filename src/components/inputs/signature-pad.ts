/**
 * Signature pad engine — ported from K3ui v1 (SignaturePad-based).
 * Standalone canvas controller used by `k3-signature`.
 */

export interface SignaturePadOptions {
  penColor: string;
  backgroundColor: string;
  minWidth: number;
  maxWidth: number;
  dotSize: number;
  minDistance: number;
  throttle: number;
  velocityFilterWeight: number;
  compositeOperation: GlobalCompositeOperation;
  canvasContextOptions: CanvasRenderingContext2DSettings;
}

export const defaultSignaturePadOptions = (): SignaturePadOptions => ({
  penColor: '#1c1b1f',
  backgroundColor: 'rgba(0,0,0,0)',
  minWidth: 0.5,
  maxWidth: 2.5,
  dotSize: 0,
  minDistance: 5,
  throttle: 16,
  velocityFilterWeight: 0.7,
  compositeOperation: 'source-over',
  canvasContextOptions: {},
});

export interface BasicPoint {
    x: number;
    y: number;
    pressure: number;
    time: number;
}

/**
 * Classe Point pour les signatures
 */
class Point implements BasicPoint {
    public x: number;
    public y: number;
    public pressure: number;
    public time: number;

    constructor(x: number, y: number, pressure?: number, time?: number) {
        if (isNaN(x) || isNaN(y)) {
            throw new Error(`Point is invalid: (${x}, ${y})`);
        }
        this.x = +x;
        this.y = +y;
        this.pressure = pressure || 0;
        this.time = time || Date.now();
    }

    public distanceTo(start: BasicPoint): number {
        return Math.sqrt(
            Math.pow(this.x - start.x, 2) + Math.pow(this.y - start.y, 2),
        );
    }

    public equals(other: BasicPoint): boolean {
        return (
            this.x === other.x &&
            this.y === other.y &&
            this.pressure === other.pressure &&
            this.time === other.time
        );
    }

    public velocityFrom(start: BasicPoint): number {
        return this.time !== start.time
            ? this.distanceTo(start) / (this.time - start.time)
            : 0;
    }
}

/**
 * Classe Bezier pour les courbes
 */
class Bezier {
    public static fromPoints(
        points: Point[],
        widths: { start: number; end: number },
    ): Bezier {
        const c2 = this.calculateControlPoints(points[0], points[1], points[2]).c2;
        const c3 = this.calculateControlPoints(points[1], points[2], points[3]).c1;

        return new Bezier(points[1], c2, c3, points[2], widths.start, widths.end);
    }

    private static calculateControlPoints(
        s1: BasicPoint,
        s2: BasicPoint,
        s3: BasicPoint,
    ): {
        c1: BasicPoint;
        c2: BasicPoint;
    } {
        const dx1 = s1.x - s2.x;
        const dy1 = s1.y - s2.y;
        const dx2 = s2.x - s3.x;
        const dy2 = s2.y - s3.y;

        const m1 = { x: (s1.x + s2.x) / 2.0, y: (s1.y + s2.y) / 2.0 };
        const m2 = { x: (s2.x + s3.x) / 2.0, y: (s2.y + s3.y) / 2.0 };

        const l1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const l2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        const dxm = m1.x - m2.x;
        const dym = m1.y - m2.y;

        const k = l1 + l2 == 0 ? 0 : l2 / (l1 + l2);
        const cm = { x: m2.x + dxm * k, y: m2.y + dym * k };

        const tx = s2.x - cm.x;
        const ty = s2.y - cm.y;

        return {
            c1: new Point(m1.x + tx, m1.y + ty),
            c2: new Point(m2.x + tx, m2.y + ty),
        };
    }

    constructor(
        public startPoint: Point,
        public control2: BasicPoint,
        public control1: BasicPoint,
        public endPoint: Point,
        public startWidth: number,
        public endWidth: number,
    ) { }

    public length(): number {
        const steps = 10;
        let length = 0;
        let px: number | undefined;
        let py: number | undefined;

        for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const cx = this.point(
                t,
                this.startPoint.x,
                this.control1.x,
                this.control2.x,
                this.endPoint.x,
            );
            const cy = this.point(
                t,
                this.startPoint.y,
                this.control1.y,
                this.control2.y,
                this.endPoint.y,
            );

            if (i > 0) {
                const xdiff = cx - (px as number);
                const ydiff = cy - (py as number);

                length += Math.sqrt(xdiff * xdiff + ydiff * ydiff);
            }

            px = cx;
            py = cy;
        }

        return length;
    }

    private point(
        t: number,
        start: number,
        c1: number,
        c2: number,
        end: number,
    ): number {
        return (
            start * (1.0 - t) * (1.0 - t) * (1.0 - t) +
            3.0 * c1 * (1.0 - t) * (1.0 - t) * t +
            3.0 * c2 * (1.0 - t) * t * t +
            end * t * t * t
        );
    }
}

/**
 * Gestionnaire d'événements pour Signature
 */
class SignatureEventTarget {
    private _et: EventTarget;

    constructor() {
        try {
            this._et = new EventTarget();
        } catch {
            this._et = document;
        }
    }

    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        this._et.addEventListener(type, listener, options);
    }

    dispatchEvent(event: Event): boolean {
        return this._et.dispatchEvent(event);
    }

    removeEventListener(
        type: string,
        callback: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
    ): void {
        this._et.removeEventListener(type, callback, options);
    }
}

/** Options de rendu d’un trait / groupe de points */
interface SignatureStrokeOptions {
    penColor: string;
    dotSize: number;
    minWidth: number;
    maxWidth: number;
    velocityFilterWeight: number;
    compositeOperation: GlobalCompositeOperation;
}

/** Options d’import `fromDataURL` */
interface SignatureFromDataURLOptions {
    ratio?: number;
    width?: number;
    height?: number;
    xOffset?: number;
    yOffset?: number;
}

/**
 * Fonction throttle pour limiter les appels
 */
function throttle<T extends (...args: never[]) => unknown>(
    fn: T,
    wait = 250,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
    let previous = 0;
    let timeout: number | null = null;
    let result: ReturnType<T> | undefined;
    let storedArgs: Parameters<T> | undefined;

    const later = (): void => {
        previous = Date.now();
        timeout = null;
        if (storedArgs) {
            result = fn(...storedArgs) as ReturnType<T>;
            storedArgs = undefined;
        }
    };

    return function wrapper(...args: Parameters<T>): ReturnType<T> | undefined {
        const now = Date.now();
        const remaining = wait - (now - previous);

        storedArgs = args;

        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }

            previous = now;
            result = fn(...args) as ReturnType<T>;
            storedArgs = undefined;
        } else if (!timeout) {
            timeout = window.setTimeout(later, remaining);
        }

        return result;
    };
}

/**
 * Événement de signature
 */
export interface SignatureEvent {
    event: MouseEvent | TouchEvent | PointerEvent;
    type: string;
    x: number;
    y: number;
    pressure: number;
}

/**
 * Groupe de points
 */
export interface PointGroup {
    points: BasicPoint[];
    dotSize: number;
    minWidth: number;
    maxWidth: number;
    penColor: string;
    velocityFilterWeight: number;
    compositeOperation: GlobalCompositeOperation;
}

// ============================================================================
// CLASSE SIGNATURE
// ============================================================================

/**
 * Valeurs par défaut pour les options
 */
/**
 * Classe Signature pour K3UI
 */
export class SignaturePad {

    /** Canvas element */
    private canvas: HTMLCanvasElement;

    /** Context 2D du canvas */
    private _ctx: CanvasRenderingContext2D;

    /** État de dessin */
    private _drawingStroke = false;

    /** Canvas vide */
    private _isEmpty = true;

    /** Derniers points */
    private _lastPoints: Point[] = [];

    /** Données des groupes de points */
    private _data: PointGroup[] = [];

    /** Dernière vélocité */
    private _lastVelocity = 0;

    /** Dernière largeur */
    private _lastWidth = 0;

    /** Mise à jour du stroke throttlée */
    private _strokeMoveUpdate: (event: SignatureEvent) => void;

    /** ID du pointeur */
    private _strokePointerId: number | undefined;

    /** Event target */
    private _eventTarget: SignatureEventTarget;

        /**
     * Constructeur du composant
     * @param el Élément HTML
     * @param options Options de configuration
     */
    options: SignaturePadOptions;

  constructor(canvas: HTMLCanvasElement, options: Partial<SignaturePadOptions> = {}) {
    this.canvas = canvas;
    this.options = { ...defaultSignaturePadOptions(), ...options };
    this._setupCanvas();
    this._ctx = this.canvas.getContext(
      '2d',
      this.options.canvasContextOptions,
    ) as CanvasRenderingContext2D;
    this._eventTarget = new SignatureEventTarget();
    this._strokeMoveUpdate = this.options.throttle
      ? throttle(SignaturePad.prototype._strokeUpdate.bind(this), this.options.throttle)
      : this._strokeUpdate.bind(this);
    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchMove = this._handleTouchMove.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
    this._handleTouchCancel = this._handleTouchCancel.bind(this);
    this._handlePointerDown = this._handlePointerDown.bind(this);
    this._handlePointerMove = this._handlePointerMove.bind(this);
    this._handlePointerUp = this._handlePointerUp.bind(this);
    this._handlePointerCancel = this._handlePointerCancel.bind(this);
    this.init();
  }

    /**
     * Configure le canvas
     * @private
     */
    private _setupCanvas(): void {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        const ctx = this.canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
        }
    }

    /**
     * Initialise le composant
     * @private
     */
    private init(): void {
        this.clear();
        this.on();
    }

    /**
     * Active les événements
     */
    public on(): void {
        this.canvas.style.touchAction = 'none';

        const isIOS =
            /Macintosh/.test(navigator.userAgent) && 'ontouchstart' in document;

        if (window.PointerEvent && !isIOS) {
            this._handlePointerEvents();
        } else {
            this._handleMouseEvents();
            if ('ontouchstart' in window) {
                this._handleTouchEvents();
            }
        }
    }

    /**
     * Désactive les événements
     */
    public off(): void {
        this.canvas.style.touchAction = 'auto';

        this.canvas.removeEventListener('pointerdown', this._handlePointerDown);
        this.canvas.removeEventListener('mousedown', this._handleMouseDown);
        this.canvas.removeEventListener('touchstart', this._handleTouchStart);

        this._removeMoveUpEventListeners();
    }

    /**
     * Efface le canvas
     */
    public clear(): void {
        const { _ctx: ctx, canvas } = this;

        if (ctx) {
            ctx.fillStyle = this.options.backgroundColor || 'rgba(0,0,0,0)';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        this._data = [];
        this._reset(this._getPointGroupOptions());
        this._isEmpty = true;
        this._strokePointerId = undefined;

        this.dispatchEvent(new CustomEvent('clear'));
    }

    /**
     * Vérifie si le canvas est vide
     */
    public isEmpty(): boolean {
        return this._isEmpty;
    }

    /** Mark the canvas as non-empty (e.g. after stamping initials). */
    markDrawn(): void {
        this._isEmpty = false;
    }

    /**
     * Exporte les données
     */
    public toData(): PointGroup[] {
        return this._data;
    }

    /**
     * Importe les données
     */
    public fromData(
        pointGroups: PointGroup[],
        { clear = true }: { clear?: boolean } = {},
    ): void {
        if (clear) {
            this.clear();
        }

        this._fromData(
            pointGroups,
            this._drawCurve.bind(this),
            this._drawDot.bind(this),
        );

        this._data = this._data.concat(pointGroups);
    }

    /**
     * Exporte en data URL
     */
    public toDataURL(type = 'image/png', encoderOptions?: number): string {
        if (type === 'image/svg+xml') {
            return `data:image/svg+xml;base64,${btoa(this.toSVG())}`;
        }
        return this.canvas.toDataURL(type, encoderOptions);
    }

    /**
     * Importe depuis data URL
     */
    public fromDataURL(
        dataUrl: string,
        options: SignatureFromDataURLOptions = {},
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const ratio = options.ratio || window.devicePixelRatio || 1;
            const width = options.width || this.canvas.width / ratio;
            const height = options.height || this.canvas.height / ratio;
            const xOffset = options.xOffset || 0;
            const yOffset = options.yOffset || 0;

            this._reset(this._getPointGroupOptions());

            image.onload = (): void => {
                this._ctx.drawImage(image, xOffset, yOffset, width, height);
                resolve();
            };
            image.onerror = (error): void => {
                reject(error);
            };
            image.crossOrigin = 'anonymous';
            image.src = dataUrl;

            this._isEmpty = false;
        });
    }

    /**
     * Exporte en SVG
     */
    public toSVG(): string {
        const pointGroups = this._data;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const minX = 0;
        const minY = 0;
        const maxX = this.canvas.width / ratio;
        const maxY = this.canvas.height / ratio;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        svg.setAttribute('viewBox', `${minX} ${minY} ${maxX} ${maxY}`);
        svg.setAttribute('width', maxX.toString());
        svg.setAttribute('height', maxY.toString());

        if (this.options.backgroundColor) {
            const rect = document.createElement('rect');
            rect.setAttribute('width', '100%');
            rect.setAttribute('height', '100%');
            rect.setAttribute('fill', this.options.backgroundColor);
            svg.appendChild(rect);
        }

        this._fromData(
            pointGroups,
            (curve, { penColor }) => {
                const path = document.createElement('path');
                if (
                    !isNaN(curve.control1.x) &&
                    !isNaN(curve.control1.y) &&
                    !isNaN(curve.control2.x) &&
                    !isNaN(curve.control2.y)
                ) {
                    const attr =
                        `M ${curve.startPoint.x.toFixed(3)},${curve.startPoint.y.toFixed(3)} ` +
                        `C ${curve.control1.x.toFixed(3)},${curve.control1.y.toFixed(3)} ` +
                        `${curve.control2.x.toFixed(3)},${curve.control2.y.toFixed(3)} ` +
                        `${curve.endPoint.x.toFixed(3)},${curve.endPoint.y.toFixed(3)}`;
                    path.setAttribute('d', attr);
                    path.setAttribute('stroke-width', (curve.endWidth * 2.25).toFixed(3));
                    path.setAttribute('stroke', penColor);
                    path.setAttribute('fill', 'none');
                    path.setAttribute('stroke-linecap', 'round');
                    svg.appendChild(path);
                }
            },
            (point, { penColor, dotSize, minWidth, maxWidth }) => {
                const circle = document.createElement('circle');
                const size = dotSize > 0 ? dotSize : (minWidth + maxWidth) / 2;
                circle.setAttribute('r', size.toString());
                circle.setAttribute('cx', point.x.toString());
                circle.setAttribute('cy', point.y.toString());
                circle.setAttribute('fill', penColor);
                svg.appendChild(circle);
            },
        );

        return svg.outerHTML;
    }

    /**
     * Dispatch un événement
     */
    private dispatchEvent(event: Event): boolean {
        return this._eventTarget.dispatchEvent(event);
    }

    /**
     * Obtient les fonctions de listener
     */
    private _getListenerFunctions() {
        const canvasWindow =
            window.document === this.canvas.ownerDocument
                ? window
                : (this.canvas.ownerDocument.defaultView ?? this.canvas.ownerDocument);

        return {
            addEventListener: canvasWindow.addEventListener.bind(
                canvasWindow,
            ) as typeof window.addEventListener,
            removeEventListener: canvasWindow.removeEventListener.bind(
                canvasWindow,
            ) as typeof window.removeEventListener,
        };
    }

    /**
     * Supprime les listeners move/up
     */
    private _removeMoveUpEventListeners(): void {
        const { removeEventListener } = this._getListenerFunctions();
        removeEventListener('pointermove', this._handlePointerMove);
        removeEventListener('pointerup', this._handlePointerUp);
        removeEventListener('pointercancel', this._handlePointerCancel);
        removeEventListener('mousemove', this._handleMouseMove);
        removeEventListener('mouseup', this._handleMouseUp);
        removeEventListener('touchmove', this._handleTouchMove);
        removeEventListener('touchend', this._handleTouchEnd);
        removeEventListener('touchcancel', this._handleTouchCancel);
    }

    /**
     * Gère les événements pointer
     */
    private _handlePointerEvents(): void {
        this._drawingStroke = false;
        this.canvas.addEventListener('pointerdown', this._handlePointerDown, {
            passive: false,
        });
    }

    /**
     * Gère les événements mouse
     */
    private _handleMouseEvents(): void {
        this._drawingStroke = false;
        this.canvas.addEventListener('mousedown', this._handleMouseDown, {
            passive: false,
        });
    }

    /**
     * Gère les événements touch
     */
    private _handleTouchEvents(): void {
        this.canvas.addEventListener('touchstart', this._handleTouchStart, {
            passive: false,
        });
    }

    /**
     * Vérifie si le bouton gauche est pressé
     */
    private _isLeftButtonPressed(event: MouseEvent, only?: boolean): boolean {
        if (only) {
            return event.buttons === 1;
        }
        return (event.buttons & 1) === 1;
    }

    /**
     * Convertit un événement pointer en SignatureEvent
     */
    private _pointerEventToSignatureEvent(
        event: MouseEvent | PointerEvent,
    ): SignatureEvent {
        return {
            event: event,
            type: event.type,
            x: event.clientX,
            y: event.clientY,
            pressure: 'pressure' in event ? event.pressure : 0,
        };
    }

    /**
     * Convertit un événement touch en SignatureEvent
     */
    private _touchEventToSignatureEvent(event: TouchEvent): SignatureEvent {
        const touch = event.changedTouches[0];
        return {
            event: event,
            type: event.type,
            x: touch.clientX,
            y: touch.clientY,
            pressure: touch.force,
        };
    }

    /**
     * Handler mouse down
     */
    private _handleMouseDown(event: MouseEvent): void {
        if (!this._isLeftButtonPressed(event, true) || this._drawingStroke) {
            return;
        }
        this._strokeBegin(this._pointerEventToSignatureEvent(event));
    }

    /**
     * Handler mouse move
     */
    private _handleMouseMove(event: MouseEvent): void {
        if (!this._isLeftButtonPressed(event, true) || !this._drawingStroke) {
            this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
            return;
        }
        this._strokeMoveUpdate(this._pointerEventToSignatureEvent(event));
    }

    /**
     * Handler mouse up
     */
    private _handleMouseUp(event: MouseEvent): void {
        if (this._isLeftButtonPressed(event)) {
            return;
        }
        this._strokeEnd(this._pointerEventToSignatureEvent(event));
    }

    /**
     * Handler touch start
     */
    private _handleTouchStart(event: TouchEvent): void {
        if (event.targetTouches.length !== 1 || this._drawingStroke) {
            return;
        }
        if (event.cancelable) {
            event.preventDefault();
        }
        this._strokeBegin(this._touchEventToSignatureEvent(event));
    }

    /**
     * Handler touch move
     */
    private _handleTouchMove(event: TouchEvent): void {
        if (event.targetTouches.length !== 1) {
            return;
        }
        if (event.cancelable) {
            event.preventDefault();
        }
        if (!this._drawingStroke) {
            this._strokeEnd(this._touchEventToSignatureEvent(event), false);
            return;
        }
        this._strokeMoveUpdate(this._touchEventToSignatureEvent(event));
    }

    /**
     * Handler touch end
     */
    private _handleTouchEnd(event: TouchEvent): void {
        if (event.targetTouches.length !== 0) {
            return;
        }
        if (event.cancelable) {
            event.preventDefault();
        }
        this._strokeEnd(this._touchEventToSignatureEvent(event));
    }

    /**
     * Handler touch cancel
     */
    private _handleTouchCancel(event: TouchEvent): void {
        if (event.cancelable) {
            event.preventDefault();
        }
        this._strokeEnd(this._touchEventToSignatureEvent(event), false);
    }

    /**
     * Obtient l'ID du pointeur
     */
    private _getPointerId(event: PointerEvent) {
        return event.pointerId;
    }

    /**
     * Vérifie si l'ID du pointeur est autorisé
     */
    private _allowPointerId(
        event: PointerEvent,
        allowUndefined = false,
    ): boolean {
        if (typeof this._strokePointerId === 'undefined') {
            return allowUndefined;
        }
        return this._getPointerId(event) === this._strokePointerId;
    }

    /**
     * Handler pointer down
     */
    private _handlePointerDown(event: PointerEvent): void {
        if (
            this._drawingStroke ||
            !this._isLeftButtonPressed(event) ||
            !this._allowPointerId(event, true)
        ) {
            return;
        }
        this._strokePointerId = this._getPointerId(event);
        event.preventDefault();
        try {
            this.canvas.setPointerCapture(event.pointerId);
        } catch {
            // ignore — le tracé continue via les listeners move/up
        }
        this._strokeBegin(this._pointerEventToSignatureEvent(event));
    }

    /**
     * Handler pointer move
     */
    private _handlePointerMove(event: PointerEvent): void {
        if (!this._allowPointerId(event)) {
            return;
        }
        if (!this._isLeftButtonPressed(event, true) || !this._drawingStroke) {
            this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
            return;
        }
        event.preventDefault();
        this._strokeMoveUpdate(this._pointerEventToSignatureEvent(event));
    }

    /**
     * Handler pointer up
     */
    private _handlePointerUp(event: PointerEvent): void {
        if (this._isLeftButtonPressed(event) || !this._allowPointerId(event)) {
            return;
        }
        event.preventDefault();
        this._strokeEnd(this._pointerEventToSignatureEvent(event));
    }

    /**
     * Handler pointer cancel
     */
    private _handlePointerCancel(event: PointerEvent): void {
        if (!this._allowPointerId(event)) {
            return;
        }
        event.preventDefault();
        this._strokeEnd(this._pointerEventToSignatureEvent(event), false);
    }

    /**
     * Obtient les options du groupe de points
     */
    private _getPointGroupOptions(group?: PointGroup): SignatureStrokeOptions {
        return {
            penColor: group && 'penColor' in group ? group.penColor : this.options.penColor,
            dotSize: group && 'dotSize' in group ? group.dotSize : this.options.dotSize,
            minWidth: group && 'minWidth' in group ? group.minWidth : this.options.minWidth,
            maxWidth: group && 'maxWidth' in group ? group.maxWidth : this.options.maxWidth,
            velocityFilterWeight:
                group && 'velocityFilterWeight' in group
                    ? group.velocityFilterWeight
                    : this.options.velocityFilterWeight,
            compositeOperation:
                group && 'compositeOperation' in group
                    ? group.compositeOperation
                    : this.options.compositeOperation,
        };
    }

    /**
     * Réinitialise l'état
     */
    private _reset(options: SignatureStrokeOptions): void {
        this._lastPoints = [];
        this._lastVelocity = 0;
        this._lastWidth = (options.minWidth + options.maxWidth) / 2;
        this._ctx.fillStyle = options.penColor;
        this._ctx.globalCompositeOperation = options.compositeOperation;
    }

    /**
     * Crée un point
     */
    private _createPoint(x: number, y: number, pressure: number): Point {
        const rect = this.canvas.getBoundingClientRect();
        return new Point(
            x - rect.left,
            y - rect.top,
            pressure,
            new Date().getTime(),
        );
    }

    /**
     * Ajoute un point
     */
    private _addPoint(point: Point, options: SignatureStrokeOptions): Bezier | null {
        const { _lastPoints } = this;
        _lastPoints.push(point);

        if (_lastPoints.length > 2) {
            if (_lastPoints.length === 3) {
                _lastPoints.unshift(_lastPoints[0]);
            }
            const widths = this._calculateCurveWidths(
                _lastPoints[1],
                _lastPoints[2],
                options,
            );
            const curve = Bezier.fromPoints(_lastPoints, widths);
            _lastPoints.shift();
            return curve;
        }
        return null;
    }

    /**
     * Calcule les largeurs de courbe
     */
    private _calculateCurveWidths(
        startPoint: Point,
        endPoint: Point,
        options: SignatureStrokeOptions,
    ): { start: number; end: number } {
        const velocity =
            options.velocityFilterWeight * endPoint.velocityFrom(startPoint) +
            (1 - options.velocityFilterWeight) * this._lastVelocity;
        const newWidth = this._strokeWidth(velocity, options);
        const widths = {
            end: newWidth,
            start: this._lastWidth,
        };
        this._lastVelocity = velocity;
        this._lastWidth = newWidth;
        return widths;
    }

    /**
     * Calcule la largeur du stroke
     */
    private _strokeWidth(velocity: number, options: SignatureStrokeOptions): number {
        return Math.max(options.maxWidth / (velocity + 1), options.minWidth);
    }

    /**
     * Dessine un segment de courbe
     */
    private _drawCurveSegment(x: number, y: number, width: number): void {
        const ctx = this._ctx;
        ctx.moveTo(x, y);
        ctx.arc(x, y, width, 0, 2 * Math.PI, false);
        this._isEmpty = false;
    }

    /**
     * Dessine une courbe
     */
    private _drawCurve(curve: Bezier, options: SignatureStrokeOptions): void {
        const ctx = this._ctx;
        const widthDelta = curve.endWidth - curve.startWidth;
        const drawSteps = Math.ceil(curve.length()) * 2;

        ctx.beginPath();
        ctx.fillStyle = options.penColor;

        for (let i = 0; i < drawSteps; i += 1) {
            const t = i / drawSteps;
            const tt = t * t;
            const ttt = tt * t;
            const u = 1 - t;
            const uu = u * u;
            const uuu = uu * u;

            let x = uuu * curve.startPoint.x;
            x += 3 * uu * t * curve.control1.x;
            x += 3 * u * tt * curve.control2.x;
            x += ttt * curve.endPoint.x;

            let y = uuu * curve.startPoint.y;
            y += 3 * uu * t * curve.control1.y;
            y += 3 * u * tt * curve.control2.y;
            y += ttt * curve.endPoint.y;

            const width = Math.min(
                curve.startWidth + ttt * widthDelta,
                options.maxWidth,
            );
            this._drawCurveSegment(x, y, width);
        }

        ctx.closePath();
        ctx.fill();
    }

    /**
     * Dessine un point
     */
    private _drawDot(point: BasicPoint, options: SignatureStrokeOptions): void {
        const ctx = this._ctx;
        const width =
            options.dotSize > 0
                ? options.dotSize
                : (options.minWidth + options.maxWidth) / 2;

        ctx.beginPath();
        this._drawCurveSegment(point.x, point.y, width);
        ctx.closePath();
        ctx.fillStyle = options.penColor;
        ctx.fill();
    }

    /**
     * Importe depuis les données
     */
    private _fromData(
        pointGroups: PointGroup[],
        drawCurve: (curve: Bezier, options: SignatureStrokeOptions) => void,
        drawDot: (point: BasicPoint, options: SignatureStrokeOptions) => void,
    ): void {
        for (const group of pointGroups) {
            const { points } = group;
            const pointGroupOptions = this._getPointGroupOptions(group);

            if (points.length > 1) {
                for (let j = 0; j < points.length; j += 1) {
                    const basicPoint = points[j];
                    const point = new Point(
                        basicPoint.x,
                        basicPoint.y,
                        basicPoint.pressure,
                        basicPoint.time,
                    );

                    if (j === 0) {
                        this._reset(pointGroupOptions);
                    }

                    const curve = this._addPoint(point, pointGroupOptions);
                    if (curve) {
                        drawCurve(curve, pointGroupOptions);
                    }
                }
            } else {
                this._reset(pointGroupOptions);
                drawDot(points[0], pointGroupOptions);
            }
        }
    }

    /**
     * Démarre un stroke
     */
    private _strokeBegin(event: SignatureEvent): void {
        const cancelled = !this.dispatchEvent(
            new CustomEvent('beginStroke', { detail: event, cancelable: true }),
        );
        if (cancelled) {
            return;
        }

        const { addEventListener } = this._getListenerFunctions();
        switch (event.event.type) {
            case 'mousedown':
                addEventListener('mousemove', this._handleMouseMove, {
                    passive: false,
                });
                addEventListener('mouseup', this._handleMouseUp, { passive: false });
                break;
            case 'touchstart':
                addEventListener('touchmove', this._handleTouchMove, {
                    passive: false,
                });
                addEventListener('touchend', this._handleTouchEnd, { passive: false });
                addEventListener('touchcancel', this._handleTouchCancel, { passive: false });
                break;
            case 'pointerdown':
                addEventListener('pointermove', this._handlePointerMove, {
                    passive: false,
                });
                addEventListener('pointerup', this._handlePointerUp, {
                    passive: false,
                });
                addEventListener('pointercancel', this._handlePointerCancel, {
                    passive: false,
                });
                break;
        }

        this._drawingStroke = true;

        const pointGroupOptions = this._getPointGroupOptions();
        const newPointGroup: PointGroup = {
            ...pointGroupOptions,
            points: [],
        };

        this._data.push(newPointGroup);
        this._reset(pointGroupOptions);
        this._strokeUpdate(event);
    }

    /**
     * Met à jour un stroke
     */
    private _strokeUpdate(event: SignatureEvent): void {
        if (!this._drawingStroke) {
            return;
        }

        if (this._data.length === 0) {
            this._strokeBegin(event);
            return;
        }

        this.dispatchEvent(
            new CustomEvent('beforeUpdateStroke', { detail: event }),
        );

        const point = this._createPoint(event.x, event.y, event.pressure);
        const lastPointGroup = this._data[this._data.length - 1];
        const lastPoints = lastPointGroup.points;
        const lastPoint =
            lastPoints.length > 0 && lastPoints[lastPoints.length - 1];
        const isLastPointTooClose = lastPoint
            ? point.distanceTo(lastPoint) <= this.options.minDistance
            : false;
        const pointGroupOptions = this._getPointGroupOptions(lastPointGroup);

        if (!lastPoint || !(lastPoint && isLastPointTooClose)) {
            const curve = this._addPoint(point, pointGroupOptions);

            if (!lastPoint) {
                this._drawDot(point, pointGroupOptions);
            } else if (curve) {
                this._drawCurve(curve, pointGroupOptions);
            }

            lastPoints.push({
                time: point.time,
                x: point.x,
                y: point.y,
                pressure: point.pressure,
            });
        }

        this.dispatchEvent(new CustomEvent('afterUpdateStroke', { detail: event }));
    }

    /**
     * Termine un stroke
     */
    private _strokeEnd(event: SignatureEvent, shouldUpdate = true): void {
        this._removeMoveUpEventListeners();

        if (!this._drawingStroke) {
            return;
        }

        if (shouldUpdate) {
            this._strokeUpdate(event);
        }

        this._drawingStroke = false;
        if (event.event instanceof PointerEvent) {
            try {
                if (this.canvas.hasPointerCapture(event.event.pointerId)) {
                    this.canvas.releasePointerCapture(event.event.pointerId);
                }
            } catch {
                // ignore
            }
        }
        this._strokePointerId = undefined;
        this.dispatchEvent(new CustomEvent('endStroke', { detail: event }));
    }

    /** Forward pad events (`beginStroke`, `endStroke`, `clear`). */
    addEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        this._eventTarget.addEventListener(type, listener, options);
    }

    removeEventListener(
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
    ): void {
        this._eventTarget.removeEventListener(type, listener, options);
    }

    /**
     * Re-sync backing-store size to the CSS box (DPR) and redraw strokes.
     * Does not emit `clear` when the pad was already empty.
     */
    resize(): void {
        const data = this.toData();
        const empty = this.isEmpty();
        this._setupCanvas();
        this._ctx = this.canvas.getContext(
            '2d',
            this.options.canvasContextOptions,
        ) as CanvasRenderingContext2D;
        const { _ctx: ctx, canvas } = this;
        ctx.fillStyle = this.options.backgroundColor || 'rgba(0,0,0,0)';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (empty || data.length === 0) {
            this._data = [];
            this._isEmpty = true;
            this._strokePointerId = undefined;
            this._reset(this._getPointGroupOptions());
            return;
        }
        this._data = [];
        this.fromData(data, { clear: false });
    }

    /** Tear down listeners. */
    destroy(): void {
        this.off();
        this._eventTarget.removeEventListener('beginStroke', () => { });
        this._eventTarget.removeEventListener('endStroke', () => { });
        this._eventTarget.removeEventListener('clear', () => { });
    }
}
