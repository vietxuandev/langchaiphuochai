import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { UPLOAD } from '@phuochai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from './uploads.service';

export interface MediaUsage {
  posts: number;
  categories: number;
  users: number;
  total: number;
}

export interface MediaItem {
  path: string;
  filename: string;
  folder: string;
  bytes: number;
  modifiedAt: string;
  usage: MediaUsage;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalBytes: number;
  totalFiles: number;
}

interface MediaListOptions {
  query?: string;
  folder?: string;
  page?: number;
  pageSize?: number;
}

interface ScannedFile {
  path: string;
  filename: string;
  folder: string;
  bytes: number;
  modifiedAt: Date;
}

/** Quản lý thư viện ảnh đã upload và kiểm tra ảnh có đang được dùng hay không. */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  async list(options: MediaListOptions = {}): Promise<MediaPage> {
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 24)));
    const folder = options.folder?.trim();
    const query = options.query?.trim().toLowerCase();

    let files: ScannedFile[] = [];
    try {
      files = await this.scanDirectory(this.uploads.uploadDir);
    } catch {
      // Thư mục upload chưa tồn tại trên máy mới.
      return { items: [], total: 0, page, pageSize, totalPages: 1, totalBytes: 0, totalFiles: 0 };
    }

    const usage = await this.usageMap();
    const filtered = files
      .filter((file) => {
        if (folder && folder !== 'all') {
          const folders = folder === 'categories' ? ['categories', 'category'] : [folder];
          if (!folders.includes(file.folder)) return false;
        }
        if (query && !file.path.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    const total = filtered.length;
    const totalBytes = filtered.reduce((sum, file) => sum + file.bytes, 0);
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize).map((file) => {
      const counts = usage.get(file.path) ?? { posts: 0, categories: 0, users: 0 };
      const totalUsage = counts.posts + counts.categories + counts.users;
      return {
        path: file.path,
        filename: file.filename,
        folder: file.folder,
        bytes: file.bytes,
        modifiedAt: file.modifiedAt.toISOString(),
        usage: { ...counts, total: totalUsage },
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      totalBytes,
      totalFiles: total,
    };
  }

  async remove(path: string): Promise<boolean> {
    const normalized = path.trim();
    if (!normalized.startsWith(`${UPLOAD.publicPrefix}/`)) {
      throw new NotFoundException('Đường dẫn ảnh không hợp lệ');
    }

    const usage = await this.usageMap();
    const counts = usage.get(normalized) ?? { posts: 0, categories: 0, users: 0 };
    const total = counts.posts + counts.categories + counts.users;
    if (total > 0) {
      throw new ConflictException(
        `Không thể xoá: ảnh đang được dùng ở ${counts.posts} bài viết, ${counts.categories} danh mục, ${counts.users} người dùng.`,
      );
    }

    return this.uploads.remove(normalized);
  }

  /** Đếm ảnh đang được tham chiếu trong bài viết, danh mục và avatar. */
  private async usageMap(): Promise<Map<string, { posts: number; categories: number; users: number }>> {
    const [imageRows, categories, users, posts] = await Promise.all([
      this.prisma.postImage.groupBy({ by: ['path'], _count: { _all: true } }),
      this.prisma.category.findMany({
        where: { imagePath: { not: null } },
        select: { imagePath: true },
      }),
      this.prisma.user.findMany({
        where: { avatarUrl: { not: null } },
        select: { avatarUrl: true },
      }),
      this.prisma.post.findMany({
        where: { contentHtml: { contains: `${UPLOAD.publicPrefix}/` } },
        select: { contentHtml: true },
      }),
    ]);

    const map = new Map<string, { posts: number; categories: number; users: number }>();
    const ensure = (path: string) => {
      const current = map.get(path) ?? { posts: 0, categories: 0, users: 0 };
      map.set(path, current);
      return current;
    };

    for (const row of imageRows) {
      if (row.path) ensure(row.path).posts += row._count._all;
    }
    for (const category of categories) {
      if (category.imagePath) ensure(category.imagePath).categories += 1;
    }
    for (const user of users) {
      if (user.avatarUrl) ensure(user.avatarUrl).users += 1;
    }
    for (const post of posts) {
      if (!post.contentHtml) continue;
      const paths = new Set(post.contentHtml.match(/\/upload\/[^\s"'<>)]+/g) ?? []);
      for (const path of paths) ensure(path).posts += 1;
    }

    return map;
  }

  /** Quét đệ quy thư mục upload, chỉ lấy file ảnh. */
  private async scanDirectory(root: string, current = root): Promise<ScannedFile[]> {
    const entries = await readdir(current, { withFileTypes: true });
    const files: ScannedFile[] = [];

    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.scanDirectory(root, absolute)));
        continue;
      }
      if (!entry.isFile() || !/\.(jpe?g|png|webp|gif|avif)$/i.test(entry.name)) continue;

      const fileStat = await stat(absolute);
      const relativePath = relative(root, absolute).split(sep).join('/');
      const [folder] = relativePath.split('/');
      files.push({
        path: `${UPLOAD.publicPrefix}/${relativePath}`,
        filename: entry.name,
        folder,
        bytes: fileStat.size,
        modifiedAt: fileStat.mtime,
      });
    }

    return files;
  }
}
