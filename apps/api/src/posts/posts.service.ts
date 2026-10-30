import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PostStatus, PostType, Prisma, Role } from '@prisma/client';
import { hasAtLeastRole, canPublish, slugify } from '@phuochai/shared';
import type { PostInput } from '@phuochai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import type { PostEntity, PostFilterInput, PostImageEntity, TagEntity } from './entities/post.entity';
import type { UserEntity } from '../users/entities/user.entity';

/** Dữ liệu kèm theo mỗi lần truy vấn bài viết. */
const POST_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: 'asc' } },
  tags: true,
  author: true,
} satisfies Prisma.PostInclude;

type PostWithRelations = Prisma.PostGetPayload<{ include: typeof POST_INCLUDE }>;

export interface Viewer {
  id: string;
  role: Role;
  email: string;
  name: string;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  /* ------------------------------------------------------------------ */
  /*                            Truy vấn                                */
  /* ------------------------------------------------------------------ */

  async list(filter: PostFilterInput, viewer?: Viewer | null) {
    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 12));
    const where = await this.buildWhere(filter, viewer);

    const orderBy = this.buildOrderBy(filter);

    const [total, posts] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: POST_INCLUDE,
      }),
    ]);

    return {
      items: posts.map((post) => this.toEntity(post)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hasNextPage: page * pageSize < total,
    };
  }

  async findBySlug(slug: string, viewer?: Viewer | null): Promise<PostEntity> {
    const post = await this.prisma.post.findUnique({ where: { slug }, include: POST_INCLUDE });
    if (!post) throw new NotFoundException(`Không tìm thấy bài viết "${slug}"`);
    this.assertCanView(post, viewer);
    return this.toEntity(post);
  }

  async findById(id: string, viewer?: Viewer | null): Promise<PostEntity> {
    const post = await this.prisma.post.findUnique({ where: { id }, include: POST_INCLUDE });
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    this.assertCanView(post, viewer);
    return this.toEntity(post);
  }

  /** Bài viết liên quan: cùng loại, ưu tiên cùng danh mục. */
  async related(slug: string, limit = 4): Promise<PostEntity[]> {
    const current = await this.prisma.post.findUnique({
      where: { slug },
      select: { id: true, type: true, categoryId: true },
    });
    if (!current) return [];

    const posts = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        type: current.type,
        id: { not: current.id },
        ...(current.categoryId ? { categoryId: current.categoryId } : {}),
      },
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      include: POST_INCLUDE,
    });

    if (posts.length >= limit || !current.categoryId) return posts.map((post) => this.toEntity(post));

    // Nếu chưa đủ, bổ sung bài cùng loại ở danh mục khác.
    const extra = await this.prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHED,
        type: current.type,
        id: { notIn: [current.id, ...posts.map((post) => post.id)] },
      },
      orderBy: [{ views: 'desc' }],
      take: limit - posts.length,
      include: POST_INCLUDE,
    });
    return [...posts, ...extra].map((post) => this.toEntity(post));
  }

  /** Bài nổi bật cho trang chủ (ưu tiên bài có ảnh và nhiều lượt xem). */
  async featured(type: PostType, limit = 8): Promise<PostEntity[]> {
    const posts = await this.prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED, type, images: { some: {} } },
      orderBy: [{ views: 'desc' }, { publishedAt: 'desc' }],
      take: limit,
      include: POST_INCLUDE,
    });
    return posts.map((post) => this.toEntity(post));
  }

  /** Đếm số bài đã xuất bản theo xã/phường (dùng cho bộ lọc). */
  async wardCounts(type?: PostType): Promise<{ ward: string; count: number }[]> {
    const rows = await this.prisma.post.groupBy({
      by: ['ward'],
      where: { status: PostStatus.PUBLISHED, ward: { not: null }, ...(type ? { type } : {}) },
      _count: { _all: true },
      orderBy: { _count: { ward: 'desc' } },
    });
    return rows
      .filter((row) => !!row.ward)
      .map((row) => ({ ward: row.ward as string, count: row._count._all }));
  }

  async latest(type: PostType, limit = 6): Promise<PostEntity[]> {
    const posts = await this.prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED, type },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: POST_INCLUDE,
    });
    return posts.map((post) => this.toEntity(post));
  }


  async incrementViews(id: string): Promise<void> {
    try {
      await this.prisma.post.update({ where: { id }, data: { views: { increment: 1 } } });
    } catch {
      // Bỏ qua nếu bài viết đã bị xoá
    }
  }

  /* ------------------------------------------------------------------ */
  /*                         Thao tác ghi                               */
  /* ------------------------------------------------------------------ */

  async create(input: PostInput, viewer: Viewer): Promise<PostEntity> {
    const status = this.resolveStatus(input.status as PostStatus | undefined, viewer);
    const slug = await this.uniqueSlug(input.slug || input.title);
    const categoryId = await this.resolveCategoryId(input.categoryId);

    const created = await this.prisma.post.create({
      data: {
        ...this.buildScalarData(input),
        status,
        slug,
        type: input.type as PostType,
        title: input.title,
        categoryId,
        authorId: viewer.id,
        publishedAt: status === PostStatus.PUBLISHED ? this.parseDate(input.publishedAt) ?? new Date() : null,
        images: {
          create: (input.images ?? []).map((image, index) => ({
            path: image.path,
            role: image.role ?? 'gallery',
            alt: image.alt,
            sortOrder: image.sortOrder ?? index,
          })),
        },
        tags: { connect: await this.resolveTags(input.tags ?? []) },
      } as Prisma.PostUncheckedCreateInput,
      include: POST_INCLUDE,
    });

    return this.toEntity(created);
  }

  async update(input: PostInput & { id: string }, viewer: Viewer): Promise<PostEntity> {
    const current = await this.prisma.post.findUnique({ where: { id: input.id } });
    if (!current) throw new NotFoundException('Không tìm thấy bài viết');
    this.assertCanEdit(current.authorId, viewer);

    const status = input.status ? this.resolveStatus(input.status as PostStatus, viewer, current.status) : undefined;
    const slug = input.slug || input.title ? await this.uniqueSlug(input.slug || input.title || current.title, current.id) : undefined;

    const updated = await this.prisma.post.update({
      where: { id: current.id },
      data: {
        ...this.buildScalarData(input),
        status,
        slug,
        type: input.type as PostType | undefined,
        title: input.title,
        categoryId: input.categoryId === undefined ? undefined : await this.resolveCategoryId(input.categoryId),
        publishedAt:
          status === PostStatus.PUBLISHED
            ? (this.parseDate(input.publishedAt) ?? current.publishedAt ?? new Date())
            : status === PostStatus.DRAFT
              ? null
              : undefined,
        ...(input.images
          ? {
              images: {
                deleteMany: {},
                create: input.images.map((image, index) => ({
                  path: image.path,
                  role: image.role ?? 'gallery',
                  alt: image.alt,
                  sortOrder: image.sortOrder ?? index,
                })),
              },
            }
          : {}),
        ...(input.tags ? { tags: { set: await this.resolveTags(input.tags) } } : {}),
      } as Prisma.PostUncheckedUpdateInput,
      include: POST_INCLUDE,
    });

    return this.toEntity(updated);
  }

  async remove(id: string, viewer: Viewer): Promise<boolean> {
    const current = await this.prisma.post.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy bài viết');
    this.assertCanEdit(current.authorId, viewer);
    await this.prisma.post.delete({ where: { id } });
    return true;
  }

  /** Đổi trạng thái nhanh (xuất bản / lưu trữ). */
  async setStatus(id: string, status: PostStatus, viewer: Viewer): Promise<PostEntity> {
    const current = await this.prisma.post.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Không tìm thấy bài viết');
    this.assertCanEdit(current.authorId, viewer);
    if (status === PostStatus.PUBLISHED && !canPublish(viewer.role)) {
      throw new ForbiddenException('Bạn không có quyền xuất bản bài viết');
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        status,
        publishedAt: status === PostStatus.PUBLISHED ? (current.publishedAt ?? new Date()) : null,
      },
      include: POST_INCLUDE,
    });
    return this.toEntity(updated);
  }

  /* ------------------------------------------------------------------ */
  /*                          Hàm hỗ trợ                                */
  /* ------------------------------------------------------------------ */

  private assertCanView(post: { status: PostStatus; authorId: string | null }, viewer?: Viewer | null): void {
    if (post.status === PostStatus.PUBLISHED) return;
    if (!viewer) throw new NotFoundException('Bài viết chưa được xuất bản');
    if (hasAtLeastRole(viewer.role as Role, Role.EDITOR)) return;
    if (post.authorId === viewer.id) return;
    throw new ForbiddenException('Bạn không có quyền xem bài viết này');
  }

  private assertCanEdit(authorId: string | null, viewer: Viewer): void {
    if (hasAtLeastRole(viewer.role as Role, Role.EDITOR)) return;
    if (authorId === viewer.id) return;
    throw new ForbiddenException('Bạn chỉ có thể sửa bài viết của chính mình');
  }

  /**
   * Trạng thái thực tế được phép lưu.
   * Thành viên (USER) không có quyền xuất bản: yêu cầu PUBLISHED sẽ tự động hạ về DRAFT
   * (bản nháp chờ biên tập viên duyệt) thay vì báo lỗi.
   */
  private resolveStatus(
    requested: PostStatus | undefined,
    viewer: Viewer,
    current?: PostStatus,
  ): PostStatus {
    const target = requested ?? current ?? PostStatus.DRAFT;
    if (target === PostStatus.PUBLISHED && !canPublish(viewer.role as Role)) {
      return current === PostStatus.PUBLISHED ? PostStatus.PUBLISHED : PostStatus.DRAFT;
    }
    return target;
  }

  /**
   * Dựng điều kiện truy vấn Prisma từ filter + quyền của người xem.
   * Quy tắc hiển thị:
   *  - Khách: chỉ bài PUBLISHED
   *  - Thành viên (USER): bài PUBLISHED + bài của chính mình
   *  - EDITOR/ADMIN: tất cả trạng thái
   */
  private async buildWhere(filter: PostFilterInput, viewer?: Viewer | null): Promise<Prisma.PostWhereInput> {
    const where: Prisma.PostWhereInput = {};
    const and: Prisma.PostWhereInput[] = [];
    const isPrivileged = !!viewer && hasAtLeastRole(viewer.role as Role, Role.EDITOR);

    if (filter.type) where.type = filter.type as PostType;
    if (filter.ward) where.ward = filter.ward;
    if (filter.authorId) where.authorId = filter.authorId;
    if (filter.tag) where.tags = { some: { slug: filter.tag } };

    if (filter.categoryId) {
      const ids = await this.categories.descendantIds(filter.categoryId);
      where.categoryId = { in: ids };
    } else if (filter.categorySlug) {
      const category = await this.prisma.category.findUnique({
        where: { slug: filter.categorySlug },
        select: { id: true },
      });
      if (!category) return { id: '__khong_ton_tai__' };
      const ids = await this.categories.descendantIds(category.id);
      where.categoryId = { in: ids };
    }

    if (filter.minPrice != null || filter.maxPrice != null) {
      where.priceValue = {
        ...(filter.minPrice != null ? { gte: BigInt(Math.round(filter.minPrice)) } : {}),
        ...(filter.maxPrice != null ? { lte: BigInt(Math.round(filter.maxPrice)) } : {}),
      };
    }

    if (filter.onlyWithImage) and.push({ images: { some: {} } });

    if (filter.keyword) {
      const keyword = filter.keyword.trim();
      and.push({
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { summary: { contains: keyword, mode: 'insensitive' } },
          { contentText: { contains: keyword, mode: 'insensitive' } },
          { addressRaw: { contains: keyword, mode: 'insensitive' } },
          // Khớp theo thẻ: link tag trên bài viết trỏ tới /tim-kiem?q=<tên tag>,
          // nếu không tìm trong tags thì bấm vào tag sẽ không ra bài nào.
          { tags: { some: { name: { contains: keyword, mode: 'insensitive' } } } },
        ],
      });
    }

    if (filter.onlyMine) {
      if (!viewer) return { id: '__khong_ton_tai__' };
      where.authorId = viewer.id;
      if (filter.status) where.status = filter.status as PostStatus;
    } else if (isPrivileged) {
      if (filter.status) where.status = filter.status as PostStatus;
    } else if (viewer) {
      if (filter.status && filter.status !== PostStatus.PUBLISHED) {
        // Thành viên chỉ xem được bản nháp của chính mình.
        where.authorId = viewer.id;
        where.status = filter.status as PostStatus;
      } else {
        and.push({ OR: [{ status: PostStatus.PUBLISHED }, { authorId: viewer.id }] });
      }
    } else {
      where.status = PostStatus.PUBLISHED;
    }

    if (and.length > 0) where.AND = and;
    return where;
  }

  private buildOrderBy(filter: PostFilterInput): Prisma.PostOrderByWithRelationInput[] {
    const direction = filter.sortOrder === 'ASC' ? 'asc' : 'desc';
    switch (filter.sortBy) {
      case 'PRICE':
        return [{ priceValue: direction }, { createdAt: 'desc' }];
      case 'VIEWS':
        return [{ views: direction }, { publishedAt: 'desc' }];
      case 'TITLE':
        return [{ title: direction }];
      case 'PUBLISHED_AT':
        return [{ publishedAt: direction }, { createdAt: 'desc' }];
      default:
        return [{ createdAt: direction }];
    }
  }

  private buildScalarData(input: Partial<PostInput>): Record<string, unknown> {
    const date = this.parseDate(input.publishedAt);
    return {
      title: input.title,
      seoTitle: input.seoTitle,
      summary: input.summary,
      contentHtml: input.contentHtml,
      contentText: input.contentHtml ? this.htmlToText(input.contentHtml) : undefined,
      addressRaw: input.addressRaw,
      ward: input.ward,
      city: input.city,
      priceRaw: input.priceRaw,
      priceValue: input.priceValue != null ? BigInt(Math.round(input.priceValue)) : undefined,
      priceUnit: input.priceUnit,
      pricePerM2Value: input.pricePerM2Value != null ? BigInt(Math.round(input.pricePerM2Value)) : undefined,
      areaM2: input.areaM2,
      areaText: input.areaText,
      widthM: input.widthM,
      lengthM: input.lengthM,
      dimensions: input.dimensions,
      bedrooms: input.bedrooms != null ? Math.round(input.bedrooms) : undefined,
      bathrooms: input.bathrooms != null ? Math.round(input.bathrooms) : undefined,
      floors: input.floors != null ? Math.round(input.floors) : undefined,
      direction: input.direction,
      roadWidth: input.roadWidth,
      legal: input.legal,
      attributes: (input.attributes ?? undefined) as Prisma.InputJsonValue | undefined,
      contactName: input.contactName,
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      contactZalo: input.contactZalo,
      verified: input.verified,
      hasManager: input.hasManager,
      tagsText: input.tags ?? undefined,
      ...(date ? { publishedAt: date } : {}),
    };
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private async uniqueSlug(source: string, excludeId?: string): Promise<string> {
    const base = slugify(source) || `bai-viet-${Date.now()}`;
    let candidate = base;
    let counter = 2;
    for (;;) {
      const existing = await this.prisma.post.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!existing || existing.id === excludeId) return candidate;
      candidate = `${base}-${counter}`;
      counter += 1;
      if (counter > 50) return `${base}-${Date.now()}`;
    }
  }

  private async resolveCategoryId(categoryId?: string | null): Promise<string | null> {
    if (!categoryId) return null;
    const category = await this.prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) throw new BadRequestException('Danh mục không tồn tại');
    return category.id;
  }

  private async resolveTags(names: string[]): Promise<{ id: string }[]> {
    const cleaned = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 30);
    const tags = await Promise.all(
      cleaned.map((name) => {
        const slug = slugify(name);
        return this.prisma.tag.upsert({
          where: { slug },
          update: { name },
          create: { name, slug },
          select: { id: true },
        });
      }),
    );
    return tags;
  }

  /** Chuyển bản ghi Prisma sang entity GraphQL (BigInt → number, thêm ảnh đại diện). */
  private toEntity(post: PostWithRelations): PostEntity {
    const images: PostImageEntity[] = post.images.map((image) => ({
      id: image.id,
      path: image.path,
      role: image.role,
      alt: image.alt,
      bytes: image.bytes,
      sha256: image.sha256,
      sortOrder: image.sortOrder,
    }));

    const hero =
      images.find((image) => image.role === 'hero') ??
      images.find((image) => image.role === 'gallery') ??
      images[0] ??
      null;

    return {
      id: post.id,
      sourceKey: post.sourceKey,
      type: post.type as unknown as PostEntity['type'],
      status: post.status as unknown as PostEntity['status'],
      slug: post.slug,
      title: post.title,
      seoTitle: post.seoTitle,
      summary: post.summary,
      contentHtml: post.contentHtml,
      contentText: post.contentText,
      code: post.code,
      views: post.views,
      addressRaw: post.addressRaw,
      ward: post.ward,
      city: post.city,
      priceRaw: post.priceRaw,
      priceValue: post.priceValue != null ? Number(post.priceValue) : null,
      priceUnit: post.priceUnit,
      currency: post.currency,
      pricePerM2Raw: post.pricePerM2Raw,
      pricePerM2Value: post.pricePerM2Value != null ? Number(post.pricePerM2Value) : null,
      areaM2: post.areaM2,
      areaText: post.areaText,
      widthM: post.widthM,
      lengthM: post.lengthM,
      dimensions: post.dimensions,
      bedrooms: post.bedrooms,
      bathrooms: post.bathrooms,
      floors: post.floors,
      direction: post.direction,
      roadWidth: post.roadWidth,
      legal: post.legal,
      attributes: post.attributes,
      contactName: post.contactName,
      contactPhone: post.contactPhone,
      contactEmail: post.contactEmail,
      contactZalo: post.contactZalo,
      verified: post.verified,
      hasManager: post.hasManager,
      seo: post.seo,
      extras: post.extras,
      warnings: post.warnings,
      tagsText: post.tagsText,
      categoryId: post.categoryId,
      category: post.category
        ? {
            ...post.category,
            section: post.category.section as unknown as PostEntity['type'] as never,
            postCount: 0,
            children: [],
            parent: null,
          }
        : null,
      authorId: post.authorId,
      author: post.author
        ? {
            id: post.author.id,
            email: post.author.email,
            name: post.author.name,
            role: post.author.role as unknown as UserEntity['role'],
            avatarUrl: post.author.avatarUrl,
            bio: post.author.bio,
            phone: post.author.phone,
            isActive: post.author.isActive,
            status: post.author.status as unknown as UserEntity['status'],
            approvedAt: post.author.approvedAt,
            reviewNote: post.author.reviewNote,
            lastLoginAt: post.author.lastLoginAt,
            createdAt: post.author.createdAt,
            updatedAt: post.author.updatedAt,
          }
        : null,
      images,
      heroImage: hero,
      tags: post.tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })) as TagEntity[],
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
