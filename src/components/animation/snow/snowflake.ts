/**
 * Individual snowflake — independent port of react-snowfall Snowflake physics.
 * @see https://github.com/cahilfoley/react-snowfall
 * @see ./NOTICE.md
 */

import { SnowSpecs } from './snow.specs.js';
import {
  lerp,
  random,
  randomElement,
  sameImages,
  samePair,
  twoPi,
  type NumberPair,
} from './snow.utils.js';

export interface SnowflakeConfig {
  color?: string;
  radius?: NumberPair;
  speed?: NumberPair;
  wind?: NumberPair;
  changeFrequency?: number;
  images?: CanvasImageSource[];
  rotationSpeed?: NumberPair;
  opacity?: NumberPair;
  enable3DRotation?: boolean;
}

interface SnowflakeParams {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  speed: number;
  wind: number;
  nextSpeed: number;
  nextWind: number;
  nextRotationSpeed: number;
  opacity: number;
  hasNextOpacity: boolean;
  rotationX: number;
  rotationY: number;
  rotationSpeedX: number;
  rotationSpeedY: number;
  nextRotationSpeedX: number;
  nextRotationSpeedY: number;
}

type ResolvedConfig = Required<
  Omit<SnowflakeConfig, 'images'>
> & { images?: CanvasImageSource[] };

function resolveConfig(config: SnowflakeConfig = {}): ResolvedConfig {
  return {
    color: config.color ?? SnowSpecs.color,
    radius: config.radius ?? [...SnowSpecs.radius],
    speed: config.speed ?? [...SnowSpecs.speed],
    wind: config.wind ?? [...SnowSpecs.wind],
    changeFrequency: config.changeFrequency ?? SnowSpecs.changeFrequency,
    rotationSpeed: config.rotationSpeed ?? [...SnowSpecs.rotationSpeed],
    opacity: config.opacity ?? [...SnowSpecs.opacity],
    enable3DRotation: config.enable3DRotation ?? SnowSpecs.enable3DRotation,
    images: config.images,
  };
}

/**
 * One flake — update position each frame, draw as circle or image.
 */
export class Snowflake {
  private static offscreenCanvases = new WeakMap<
    CanvasImageSource,
    Record<number, HTMLCanvasElement>
  >();

  static createSnowflakes(
    canvas: HTMLCanvasElement | null,
    amount: number,
    config: SnowflakeConfig,
  ): Snowflake[] {
    if (!canvas) return [];
    const snowflakes: Snowflake[] = [];
    for (let i = 0; i < amount; i++) {
      snowflakes.push(new Snowflake(canvas, config));
    }
    return snowflakes;
  }

  private config!: ResolvedConfig;
  private params!: SnowflakeParams;
  private framesSinceLastUpdate = 0;
  private image?: CanvasImageSource;

  constructor(canvas: HTMLCanvasElement, config: SnowflakeConfig = {}) {
    this.updateConfig(config);
    const { radius, wind, speed, rotationSpeed, opacity, enable3DRotation } =
      this.config;
    const w = Math.max(1, canvas.offsetWidth || canvas.width);
    const h = Math.max(1, canvas.offsetHeight || canvas.height);

    this.params = {
      x: random(0, w),
      y: random(-h, 0),
      rotation: random(0, 360),
      radius: random(...radius),
      speed: random(...speed),
      wind: random(...wind),
      rotationSpeed: random(...rotationSpeed),
      nextSpeed: random(...speed),
      nextWind: random(...wind),
      nextRotationSpeed: random(...rotationSpeed),
      opacity: random(...opacity),
      hasNextOpacity: false,
      rotationX: enable3DRotation ? random(0, 360) : 0,
      rotationY: enable3DRotation ? random(0, 360) : 0,
      rotationSpeedX: enable3DRotation ? random(-2.0, 2.0) : 0,
      rotationSpeedY: enable3DRotation ? random(-2.0, 2.0) : 0,
      nextRotationSpeedX: enable3DRotation ? random(-2.0, 2.0) : 0,
      nextRotationSpeedY: enable3DRotation ? random(-2.0, 2.0) : 0,
    };
  }

  private selectImage(): void {
    if (this.config.images && this.config.images.length > 0) {
      this.image = randomElement(this.config.images);
    } else {
      this.image = undefined;
    }
  }

  updateConfig(config: SnowflakeConfig): void {
    const previous = this.config;
    this.config = resolveConfig(config);
    this.config.changeFrequency = random(
      this.config.changeFrequency,
      this.config.changeFrequency * 1.5,
    );

    if (this.params && !samePair(this.config.radius, previous?.radius)) {
      this.params.radius = random(...this.config.radius);
    }
    if (!sameImages(this.config.images, previous?.images)) {
      this.selectImage();
    }
    if (previous?.opacity && !samePair(this.config.opacity, previous.opacity)) {
      this.params.hasNextOpacity = true;
    }
  }

  private updateTargetParams(): void {
    this.params.nextSpeed = random(...this.config.speed);
    this.params.nextWind = random(...this.config.wind);
    if (this.image) {
      this.params.nextRotationSpeed = random(...this.config.rotationSpeed);
    }
    if (this.config.enable3DRotation) {
      this.params.nextRotationSpeedX = random(-2.0, 2.0);
      this.params.nextRotationSpeedY = random(-2.0, 2.0);
    }
  }

  update(offsetWidth: number, offsetHeight: number, framesPassed = 1): void {
    const {
      x,
      y,
      rotation,
      rotationSpeed,
      nextRotationSpeed,
      wind,
      speed,
      nextWind,
      nextSpeed,
      radius,
    } = this.params;

    this.params.x = (x + wind * framesPassed) % (offsetWidth + radius * 2);
    if (this.params.x > offsetWidth + radius) this.params.x = -radius;
    this.params.y = (y + speed * framesPassed) % (offsetHeight + radius * 2);
    if (this.params.y > offsetHeight + radius) {
      if (this.params.hasNextOpacity) {
        this.params.opacity = random(...this.config.opacity);
        this.params.hasNextOpacity = false;
      }
      this.params.y = -radius;
    }

    if (this.image || this.config.enable3DRotation) {
      this.params.rotation = (rotation + rotationSpeed) % 360;
    }

    if (this.config.enable3DRotation) {
      this.params.rotationX =
        (this.params.rotationX + this.params.rotationSpeedX * framesPassed) %
        360;
      this.params.rotationY =
        (this.params.rotationY + this.params.rotationSpeedY * framesPassed) %
        360;
    }

    this.params.speed = lerp(speed, nextSpeed, 0.01);
    this.params.wind = lerp(wind, nextWind, 0.01);
    this.params.rotationSpeed = lerp(rotationSpeed, nextRotationSpeed, 0.01);

    if (this.config.enable3DRotation) {
      this.params.rotationSpeedX = lerp(
        this.params.rotationSpeedX,
        this.params.nextRotationSpeedX,
        0.01,
      );
      this.params.rotationSpeedY = lerp(
        this.params.rotationSpeedY,
        this.params.nextRotationSpeedY,
        0.01,
      );
    }

    if (this.framesSinceLastUpdate++ > this.config.changeFrequency) {
      this.updateTargetParams();
      this.framesSinceLastUpdate = 0;
    }
  }

  private getImageOffscreenCanvas(
    image: CanvasImageSource,
    size: number,
  ): CanvasImageSource {
    if (image instanceof HTMLImageElement && !image.complete) return image;
    let sizes = Snowflake.offscreenCanvases.get(image);
    if (!sizes) {
      sizes = {};
      Snowflake.offscreenCanvases.set(image, sizes);
    }
    const key = Math.max(1, Math.round(size));
    if (!(key in sizes)) {
      const canvas = document.createElement('canvas');
      canvas.width = key;
      canvas.height = key;
      canvas.getContext('2d')?.drawImage(image, 0, 0, key, key);
      sizes[key] = canvas;
    }
    return sizes[key] ?? image;
  }

  private apply3DTransform(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
  ): void {
    if (this.config.enable3DRotation) {
      const { rotationX, rotationY, rotation } = this.params;
      const radX = (rotationX * Math.PI) / 180;
      const radY = (rotationY * Math.PI) / 180;
      const radZ = (rotation * Math.PI) / 180;
      const cosX = Math.cos(radX);
      const sinX = Math.sin(radX);
      const cosY = Math.cos(radY);
      const sinY = Math.sin(radY);
      const cosZ = Math.cos(radZ);
      const sinZ = Math.sin(radZ);
      const a = cosZ * cosY;
      const b = cosZ * sinY * sinX - sinZ * cosX;
      const c = cosZ * sinY * cosX + sinZ * sinX;
      const d = sinZ * cosY;
      ctx.setTransform(a, b, c, d, x, y);
    } else {
      const radian = (this.params.rotation * Math.PI) / 180;
      const cos = Math.cos(radian);
      const sin = Math.sin(radian);
      ctx.setTransform(cos, sin, -sin, cos, x, y);
    }
  }

  drawCircle(ctx: CanvasRenderingContext2D): void {
    ctx.moveTo(this.params.x, this.params.y);
    ctx.arc(this.params.x, this.params.y, this.params.radius, 0, twoPi);
  }

  drawCircle3D(ctx: CanvasRenderingContext2D, color: string): void {
    const { x, y, radius } = this.params;
    ctx.save();
    if (this.config.enable3DRotation) this.apply3DTransform(ctx, x, y);
    else ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, twoPi);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  drawImage(ctx: CanvasRenderingContext2D): void {
    if (!this.image) return;
    const { x, y, radius } = this.params;
    ctx.save();
    if (this.params.opacity !== 1) ctx.globalAlpha = this.params.opacity;
    this.apply3DTransform(ctx, x, y);
    const image = this.getImageOffscreenCanvas(this.image, radius);
    ctx.drawImage(image, -(radius / 2), -(radius / 2), radius, radius);
    ctx.restore();
  }
}
