import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { UPLOAD } from '@phuochai/shared';
import { applyWatermark } from './watermark';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadResult {
  /** Đường dẫn public dùng trực tiếp trong DB/HTML: /upload/posts/2026/10/abc.jpg */
  path: string;
  bytes: number;
  mimeType: string;
  originalName: string;
  /** Ảnh đã được đóng watermark (logo + tên miền, góc phải dưới) hay chưa. */
  watermarked: boolean;
}

export interface UploadOptions {
  /** `false` để bỏ watermark cho lần upload này; mặc định lấy từ WATERMARK_ENABLED. */
  watermark?: boolean;
}

/** Thư mục được đóng watermark (avatar người dùng thì không). */
const WATERMARKED_FOLDERS = new Set<string>([UPLOAD.postsFolder, UPLOAD.categoriesFolder]);

/** Mặc định có watermark; tắt toàn bộ bằng WATERMARK_ENABLED=false. */
function watermarkEnabledByDefault(): boolean {
  return process.env.WATERMARK_ENABLED !== 'false';
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const ALLOWED_FOLDERS = new Set<string>([
  UPLOAD.postsFolder,
  UPLOAD.categoriesFolder,
  UPLOAD.avatarsFolder,
]);

/** Bỏ dấu tiếng Việt để tên file an toàn trên mọi hệ điều hành. */
function slugifyFileName(input: string, maxLength = 60): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'anh').slice(0, maxLength).replace(/-+$/g, '');
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  /** Thư mục gốc chứa ảnh upload (mặc định <repo>/data/upload). */
  readonly uploadDir: string;

  constructor() {
    this.uploadDir = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), '../../data/upload'));
  }

  /** Lưu file người dùng tải lên và trả về đường dẫn public. */
  async save(
    file: UploadedFileLike | undefined,
    folder = UPLOAD.postsFolder,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    if (!file) throw new BadRequestException('Thiếu file ảnh (trường "file")');
    if (!ALLOWED_FOLDERS.has(folder)) {
      throw new BadRequestException(`Thư mục không hợp lệ. Chỉ chấp nhận: ${[...ALLOWED_FOLDERS].join(', ')}`);
    }
    if (file.size > UPLOAD.maxBytes) {
      throw new BadRequestException(
        `Ảnh vượt quá dung lượng cho phép (${Math.round(UPLOAD.maxBytes / 1024 / 1024)}MB)`,
      );
    }
    const extension = EXTENSION_BY_MIME[file.mimetype] ?? extname(file.originalname).replace('.', '').toLowerCase();
    if (!(UPLOAD.allowedMimeTypes as readonly string[]).includes(file.mimetype)) {
      throw new BadRequestException(
        `Định dạng ảnh không được hỗ trợ (${file.mimetype}). Chỉ nhận: ${UPLOAD.allowedMimeTypes.join(', ')}`,
      );
    }
    if (!extension || !['jpg', 'png', 'webp', 'gif', 'avif'].includes(extension)) {
      throw new BadRequestException('Không xác định được định dạng ảnh');
    }

    const now = new Date();
    const relativeDir = join(folder, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
    const absoluteDir = join(this.uploadDir, relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    // Đóng watermark (mặc định bật, trừ avatar hoặc khi người dùng tắt)
    const wantsWatermark = options.watermark ?? watermarkEnabledByDefault();
    let buffer = file.buffer;
    let watermarked = false;

    if (wantsWatermark && WATERMARKED_FOLDERS.has(folder)) {
      const result = await applyWatermark(file.buffer, file.mimetype);
      buffer = result.buffer;
      watermarked = result.watermarked;
    }

    const baseName = slugifyFileName(file.originalname.replace(/\.[^.]+$/, ''));
    const fileName = `${baseName}-${randomUUID().slice(0, 8)}.${extension}`;
    await writeFile(join(absoluteDir, fileName), buffer);

    // Đường dẫn public luôn dùng dấu "/" bất kể hệ điều hành
    const publicPath = `${UPLOAD.publicPrefix}/${relativeDir.split(sep).join('/')}/${fileName}`;
    this.logger.log(
      `Đã lưu ảnh ${publicPath} (${(buffer.length / 1024).toFixed(0)} KB${watermarked ? ', có watermark' : ''})`,
    );

    return {
      path: publicPath,
      bytes: buffer.length,
      mimeType: file.mimetype,
      originalName: file.originalname,
      watermarked,
    };
  }

  /** Xoá ảnh đã upload (chỉ trong thư mục upload, chống path traversal). */
  async remove(publicPath: string): Promise<boolean> {
    if (!publicPath?.startsWith(`${UPLOAD.publicPrefix}/`)) {
      throw new BadRequestException('Đường dẫn ảnh không hợp lệ');
    }
    const relative = publicPath.slice(UPLOAD.publicPrefix.length + 1);
    const absolute = resolve(this.uploadDir, normalize(relative));
    if (!absolute.startsWith(this.uploadDir + sep)) {
      throw new BadRequestException('Đường dẫn ảnh không hợp lệ');
    }
    if (!existsSync(absolute)) throw new NotFoundException('Không tìm thấy ảnh');

    await unlink(absolute);
    this.logger.log(`Đã xoá ảnh ${publicPath}`);
    return true;
  }
}
