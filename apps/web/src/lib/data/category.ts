import { safeQuery } from '@/lib/apollo/rsc-client';
import { CategoryBySlugDocument, type CategoryBySlugQuery } from '@/generated/graphql';

/** Chi tiết danh mục theo slug (kèm danh mục cha và danh mục con). */
export async function getCategoryBySlug(slug: string) {
  const data = await safeQuery<CategoryBySlugQuery, { slug: string }>(
    CategoryBySlugDocument,
    { slug },
    { category: null } as unknown as CategoryBySlugQuery,
  );
  return data.category ?? null;
}
