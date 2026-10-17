import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PostType, Prisma } from '@prisma/client';
import type { CategoryInput, UpdateCategoryInput } from '@phuochai/shared';
import { slugify } from '@phuochai/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CategoryEntity } from './entities/category.entity';

/** Danh mục kèm số bài đã xuất bản (cả danh mục cha và con). */
type CategoryNode = Prisma.CategoryGetPayload<{
  include: { _count: { select: { posts: true } } };
}>;

type CategoryWithCounts = CategoryNode & {
  parent?: CategoryNode | null;
  children?: CategoryNode[];
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách danh mục kèm số bài viết, sắp theo section → cấp → thứ tự. */
  async list(section?: PostType, includeLocationFilters = false): Promise<CategoryEntity[]> {
    const where: Prisma.CategoryWhereInput = {};
    if (section) where.section = section;
    if (!includeLocationFilters) where.isLocationFilter = false;

    const categories = await this.prisma.category.findMany({
      where,
      orderBy: [{ section: 'asc' }, { level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { include: { _count: { select: { posts: { where: { status: 'PUBLISHED' } } } } } },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { _count: { select: { posts: { where: { status: 'PUBLISHED' } } } } },
        },
        _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
      },
    });

    const totals = await this.subtreeCounts();
    return categories.map((category) => this.toEntity(category, totals));
  }

  /**
   * Số bài viết **theo cả cây** cho từng danh mục (tổng của chính nó + toàn bộ danh mục con).
   *
   * Nhờ vậy danh mục cha (ví dụ "Nơi lưu trú") hiển thị đúng tổng số bài của các danh mục con,
   * thay vì 0 (bài viết được gán cho danh mục con, không gán trực tiếp cho danh mục cha).
   */
  private async subtreeCounts(): Promise<Map<string, number>> {
    const rows = await this.prisma.category.findMany({
      select: {
        id: true,
        parentId: true,
        _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
      },
    });

    const own = new Map(rows.map((row) => [row.id, row._count.posts]));
    const childrenOf = new Map<string, string[]>();
    for (const row of rows) {
      if (!row.parentId) continue;
      const list = childrenOf.get(row.parentId) ?? [];
      list.push(row.id);
      childrenOf.set(row.parentId, list);
    }

    const totals = new Map<string, number>();
    const compute = (id: string): number => {
      const cached = totals.get(id);
      if (cached !== undefined) return cached;
      let total = own.get(id) ?? 0;
      for (const childId of childrenOf.get(id) ?? []) total += compute(childId);
      totals.set(id, total);
      return total;
    };

    for (const row of rows) compute(row.id);
    return totals;
  }

  /** Cây danh mục: chỉ trả về các danh mục gốc (children đã lồng sẵn). */
  async tree(section?: PostType): Promise<CategoryEntity[]> {
    const all = await this.list(section);
    const ids = new Set(all.map((category) => category.id));
    return all.filter((category) => !category.parentId || !ids.has(category.parentId));
  }

  async findBySlug(slug: string): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: { include: { _count: { select: { posts: { where: { status: 'PUBLISHED' } } } } } },
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { _count: { select: { posts: { where: { status: 'PUBLISHED' } } } } },
        },
        _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
      },
    });
    if (!category) throw new NotFoundException(`Không tìm thấy danh mục "${slug}"`);
    const totals = await this.subtreeCounts();
    return this.toEntity(category, totals);
  }

  async findById(id: string): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: { include: { _count: { select: { posts: true } } } },
        children: { include: { _count: { select: { posts: true } } } },
        _count: { select: { posts: true } },
      },
    });
    if (!category) throw new NotFoundException('Không tìm thấy danh mục');
    const totals = await this.subtreeCounts();
    return this.toEntity(category, totals);
  }

  /** Các danh mục con của một danh mục (dùng để lọc bài viết theo cây). */
  async descendantIds(id: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const result = [id];
    let frontier = [id];
    while (frontier.length > 0) {
      const next = all.filter((category) => category.parentId && frontier.includes(category.parentId)).map((c) => c.id);
      const fresh = next.filter((candidate) => !result.includes(candidate));
      result.push(...fresh);
      frontier = fresh;
    }
    return result;
  }

  async create(input: CategoryInput): Promise<CategoryEntity> {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    const existing = await this.prisma.category.findUnique({ where: { slug } });
    if (existing) throw new BadRequestException(`Slug "${slug}" đã tồn tại`);

    const created = await this.prisma.category.create({
      data: {
        name: input.name,
        slug,
        section: input.section as PostType,
        description: input.description,
        seoTitle: input.seoTitle,
        imagePath: input.imagePath,
        parentId: input.parentId || null,
        sortOrder: input.sortOrder ?? 0,
        level: await this.resolveLevel(input.parentId),
      },
      include: {
        parent: { include: { _count: { select: { posts: true } } } },
        children: { include: { _count: { select: { posts: true } } } },
        _count: { select: { posts: true } },
      },
    });
    await this.refreshChildCounts();
    return this.toEntity(created);
  }

  async update(input: UpdateCategoryInput): Promise<CategoryEntity> {
    const current = await this.prisma.category.findUnique({ where: { id: input.id } });
    if (!current) throw new NotFoundException('Không tìm thấy danh mục');

    if (input.parentId && input.parentId === input.id) {
      throw new BadRequestException('Danh mục không thể là cha của chính nó');
    }

    const slug = input.slug ? slugify(input.slug) : undefined;
    if (slug && slug !== current.slug) {
      const duplicated = await this.prisma.category.findUnique({ where: { slug } });
      if (duplicated) throw new BadRequestException(`Slug "${slug}" đã tồn tại`);
    }

    const updated = await this.prisma.category.update({
      where: { id: input.id },
      data: {
        name: input.name,
        slug,
        section: input.section as PostType | undefined,
        description: input.description,
        seoTitle: input.seoTitle,
        imagePath: input.imagePath,
        parentId: input.parentId === undefined ? undefined : input.parentId || null,
        sortOrder: input.sortOrder,
        level: input.parentId === undefined ? undefined : await this.resolveLevel(input.parentId),
      },
      include: {
        parent: { include: { _count: { select: { posts: true } } } },
        children: { include: { _count: { select: { posts: true } } } },
        _count: { select: { posts: true } },
      },
    });
    await this.refreshChildCounts();
    return this.toEntity(updated);
  }

  async remove(id: string): Promise<boolean> {
    const childCount = await this.prisma.category.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('Danh mục còn danh mục con, hãy xoá hoặc chuyển chúng trước');
    }
    const postCount = await this.prisma.post.count({ where: { categoryId: id } });
    if (postCount > 0) {
      throw new BadRequestException(`Danh mục còn ${postCount} bài viết, hãy chuyển bài viết sang danh mục khác trước`);
    }
    await this.prisma.category.delete({ where: { id } });
    await this.refreshChildCounts();
    return true;
  }

  private async resolveLevel(parentId?: string | null): Promise<number> {
    if (!parentId) return 0;
    const parent = await this.prisma.category.findUnique({ where: { id: parentId }, select: { level: true } });
    if (!parent) throw new BadRequestException('Danh mục cha không tồn tại');
    return parent.level + 1;
  }

  private async refreshChildCounts(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      UPDATE categories c
      SET "childCount" = COALESCE(sub.total, 0)
      FROM (
        SELECT "parentId", COUNT(*)::int AS total
        FROM categories
        WHERE "parentId" IS NOT NULL
        GROUP BY "parentId"
      ) AS sub
      WHERE c.id = sub."parentId"
    `);
    await this.prisma.$executeRawUnsafe(`
      UPDATE categories SET "childCount" = 0
      WHERE id NOT IN (SELECT DISTINCT "parentId" FROM categories WHERE "parentId" IS NOT NULL)
    `);
  }

  /**
   * Chuyển dữ liệu Prisma sang entity GraphQL.
   *
   * Lưu ý: `postCount` của danh mục con và danh mục cha phải lấy từ `_count` đã include,
   * không được hardcode 0 (nếu hardcode, mọi bộ lọc/danh sách hiển thị "0 bài").
   */
  private toEntity(category: CategoryWithCounts, totals?: Map<string, number>): CategoryEntity {
    const { _count, children, parent, ...rest } = category;
    const countOf = (id: string, fallback?: { posts: number }): number =>
      totals?.get(id) ?? fallback?.posts ?? 0;

    return {
      ...rest,
      section: rest.section as unknown as CategoryEntity['section'],
      postCount: countOf(rest.id, _count),
      children: (children ?? []).map((child) => ({
        ...child,
        section: child.section as unknown as CategoryEntity['section'],
        postCount: countOf(child.id, child._count),
        children: [],
      })),
      parent: parent
        ? {
            ...parent,
            section: parent.section as unknown as CategoryEntity['section'],
            postCount: countOf(parent.id, parent._count),
            children: [],
          }
        : null,
    };
  }
}
