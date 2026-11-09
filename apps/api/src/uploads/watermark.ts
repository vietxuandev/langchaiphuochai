/**
 * Đóng watermark vào ảnh upload (mặc định: góc phải bên dưới).
 *
 * Ảnh watermark là một badge PNG (logo + tên site + domain) đã được render sẵn,
 * nên không phụ thuộc font của môi trường chạy (container Alpine không có font).
 * Kích thước và lề tính theo tỉ lệ ảnh gốc để ảnh lớn/nhỏ đều cân đối.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import sharp from 'sharp';

const logger = new Logger('Watermark');

/** Ảnh nhỏ hơn ngưỡng này thì bỏ qua watermark (icon, thumbnail...). */
const MIN_IMAGE_WIDTH = 320;
/** Tỉ lệ chiều rộng watermark so với ảnh gốc. */
const WIDTH_RATIO = 0.22;
const MIN_WIDTH = 120;
const MAX_WIDTH = 460;
/** Lề cách mép: 2.5% cạnh ngắn, tối thiểu 16px. */
const MARGIN_RATIO = 0.025;
const MIN_MARGIN = 16;

let cachedWatermark: Buffer | null = null;
let resolvedPath: string | null = null;

/** Tìm file watermark theo thứ tự: env, chạy từ /app, chạy trong apps/api, cạnh file dist. */
function watermarkPath(): string | null {
  if (resolvedPath && existsSync(resolvedPath)) return resolvedPath;

  const candidates = [
    process.env.WATERMARK_IMAGE,
    join(process.cwd(), 'apps/api/assets/watermark.png'),
    join(process.cwd(), 'assets/watermark.png'),
    resolve(__dirname, '../../../assets/watermark.png'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      resolvedPath = candidate;
      return candidate;
    }
  }

  logger.warn('Không tìm thấy file watermark (apps/api/assets/watermark.png) - bỏ qua watermark');
  return null;
}

/** Nạp và cache watermark (đọc đĩa 1 lần). */
function loadWatermark(): Buffer | null {
  if (cachedWatermark) return cachedWatermark;
  const path = watermarkPath();
  if (!path) return null;
  cachedWatermark = readFileSync(path);
  return cachedWatermark;
}

export interface WatermarkResult {
  buffer: Buffer;
  watermarked: boolean;
  width: number;
  height: number;
}

/**
 * Đóng watermark góc phải bên dưới.
 *
 * - Giữ nguyên định dạng ảnh (jpeg/webp/png/avif), tự xoay theo EXIF.
 * - Bỏ qua GIF (ảnh động) và ảnh quá nhỏ.
 * - Nếu xử lý lỗi: trả lại ảnh gốc để upload không bị hỏng.
 */
export async function applyWatermark(input: Buffer, mimetype: string): Promise<WatermarkResult> {
  const watermark = loadWatermark();
  if (!watermark) return { buffer: input, watermarked: false, width: 0, height: 0 };

  // GIF động: composite sẽ làm mất animation -> giữ nguyên ảnh gốc
  if (mimetype === 'image/gif') return { buffer: input, watermarked: false, width: 0, height: 0 };

  try {
    const pipeline = sharp(input, { failOn: 'none' }).rotate();
    const meta = await pipeline.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (!width || !height || width < MIN_IMAGE_WIDTH) {
      return { buffer: input, watermarked: false, width, height };
    }

    const targetWidth = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width * WIDTH_RATIO)));
    const resized = await sharp(watermark).resize({ width: targetWidth, withoutEnlargement: true }).png().toBuffer();
    const wmMeta = await sharp(resized).metadata();
    const wmWidth = wmMeta.width ?? targetWidth;
    const wmHeight = wmMeta.height ?? Math.round(targetWidth * 0.23);

    const margin = Math.max(MIN_MARGIN, Math.round(Math.min(width, height) * MARGIN_RATIO));
    const left = Math.max(0, width - wmWidth - margin);
    const top = Math.max(0, height - wmHeight - margin);

    const composed = pipeline.composite([{ input: resized, left, top }]);
    const buffer = await encode(composed, mimetype);

    return { buffer, watermarked: true, width, height };
  } catch (error) {
    logger.warn(`Không đóng được watermark: ${error instanceof Error ? error.message : 'lỗi'}`);
    return { buffer: input, watermarked: false, width: 0, height: 0 };
  }
}

/** Giữ định dạng gốc, chất lượng đủ tốt để không thấy vỡ ảnh. */
async function encode(pipeline: sharp.Sharp, mimetype: string): Promise<Buffer> {
  switch (mimetype) {
    case 'image/png':
      return pipeline.png({ compressionLevel: 8 }).toBuffer();
    case 'image/webp':
      return pipeline.webp({ quality: 90 }).toBuffer();
    case 'image/avif':
      return pipeline.avif({ quality: 60 }).toBuffer();
    default:
      return pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  }
}
