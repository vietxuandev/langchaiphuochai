import { getClient, safeQuery } from '@/lib/apollo/rsc-client';
import { CategoriesDocument, type CategoriesQuery } from '@/generated/graphql';

/** Lấy danh mục cho menu/footer; trả về mảng rỗng nếu API chưa sẵn sàng. */
export async function getNavCategories() {
  const data = await safeQuery<CategoriesQuery, Record<string, never>>(
    CategoriesDocument,
    {},
    { categories: [] } as unknown as CategoriesQuery,
  );
  return data.categories ?? [];
}

/** Lấy cây danh mục theo loại nội dung. */
export async function getCategoriesBySection(section: 'ACCOMMODATION' | 'NEWS' | 'REAL_ESTATE' | 'PAGE') {
  const all = await getNavCategories();
  return all.filter((category) => category.section === section);
}

export { getClient };
