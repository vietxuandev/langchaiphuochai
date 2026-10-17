import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { UPLOAD } from '@phuochai/shared';

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
  async save(file: UploadedFileLike | undefined, folder = UPLOAD.postsFolder): Promise<UploadResult> {
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

    const baseName = slugifyFileName(file.originalname.replace(/\.[^.]+$/, ''));
    const fileName = `${baseName}-${randomUUID().slice(0, 8)}.${extension}`;
    await writeFile(join(absoluteDir, fileName), file.buffer);

    // Đường dẫn public luôn dùng dấu "/" bất kể hệ điều hành
    const publicPath = `${UPLOAD.publicPrefix}/${relativeDir.split(sep).join('/')}/${fileName}`;
    this.logger.log(`Đã lưu ảnh ${publicPath} (${(file.size / 1024).toFixed(0)} KB)`);

    return {
      path: publicPath,
      bytes: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
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
