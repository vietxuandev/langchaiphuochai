import { getClient, safeQuery, type SafeQueryOptions } from '@/lib/apollo/rsc-client';
import { CategoriesDocument, type CategoriesQuery } from '@/generated/graphql';

/** Lấy danh mục cho menu/footer (lúc build mà API chưa sẵn sàng thì trả mảng rỗng). */
export async function getNavCategories(options?: SafeQueryOptions) {
  const data = await safeQuery<CategoriesQuery, Record<string, never>>(
    CategoriesDocument,
    {},
    { categories: [] } as unknown as CategoriesQuery,
    options,
  );
  return data.categories ?? [];
}

/** Lấy cây danh mục theo loại nội dung. */
export async function getCategoriesBySection(section: 'ACCOMMODATION' | 'NEWS' | 'REAL_ESTATE' | 'PAGE') {
  const all = await getNavCategories();
  return all.filter((category) => category.section === section);
}

export { getClient };
