/**
 * Spécifications `k3-qr-code` — QR code stylé (motifs, yeux, dégradé, logo, cadre).
 */
import type { QrEcc } from './qr-code.encoder.js';
import { QR_RENDER_DEFAULTS } from './qr-code.render.js';

/** Convention A — XS 96 · SM 128 · MD 192 · LG 256 · XL 320 (dp). */
export type QrCodeSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type QrExportFormat = 'png' | 'svg' | 'jpeg' | 'webp';

export const QrCodeSpecs = {
  defaultEcc: 'M' as QrEcc,
  defaultMargin: QR_RENDER_DEFAULTS.margin,
  defaultSize: 'md' as QrCodeSize,
  /** Display width per size (dp → rem in styles). */
  sizesDp: { xs: 96, sm: 128, md: 192, lg: 256, xl: 320 } as Record<QrCodeSize, number>,
  sizes: ['xs', 'sm', 'md', 'lg', 'xl'] as readonly QrCodeSize[],
  defaultColor: '#000000',
  defaultBackground: '#ffffff',
  defaultExportSize: 1024,
  minExportSize: 64,
  maxExportSize: 4096,
  defaultFilename: 'qr-code',
  exportFormats: ['png', 'svg', 'jpeg', 'webp'] as readonly QrExportFormat[],
  mimeTypes: {
    png: 'image/png',
    svg: 'image/svg+xml',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  } as Record<QrExportFormat, string>,
  extensions: { png: 'png', svg: 'svg', jpeg: 'jpg', webp: 'webp' } as Record<QrExportFormat, string>,
  /** Raster quality for JPEG / WebP. */
  quality: 0.92,
  accessibility: {
    role: 'img' as const,
    ariaLabel: 'QR code',
  },
} as const;

/** Clamp an export width to the supported range. */
export function clampExportSize(value: number): number {
  const n = Math.round(Number.isFinite(value) ? value : QrCodeSpecs.defaultExportSize);
  return Math.min(QrCodeSpecs.maxExportSize, Math.max(QrCodeSpecs.minExportSize, n));
}

/** `qr-code` + `png` → `qr-code.png` (keeps an existing matching extension). */
export function qrFilename(base: string, format: QrExportFormat): string {
  const ext = QrCodeSpecs.extensions[format];
  const clean = (base || QrCodeSpecs.defaultFilename).trim().replace(/[\\/:*?"<>|]+/g, '-');
  const stem = clean.replace(/\.(png|svg|jpe?g|webp)$/i, '');
  return `${stem || QrCodeSpecs.defaultFilename}.${ext}`;
}
