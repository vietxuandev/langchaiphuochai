import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PostType, Role } from '@phuochai/shared';
import type { CategoryInput, UpdateCategoryInput } from '@phuochai/shared';
import { categoryInputSchema, updateCategorySchema } from '@phuochai/shared';
import { Public, Roles } from '../common/decorators';
import { zodPipe } from '../common/zod.pipe';
import { CategoriesService } from './categories.service';
import { CategoryInputType, UpdateCategoryInputType } from './dto/category.inputs';
import { CategoryEntity } from './entities/category.entity';

@Resolver(() => CategoryEntity)
export class CategoriesResolver {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Query(() => [CategoryEntity], {
    description: 'Danh sách danh mục kèm số bài viết (mặc định ẩn các trang lọc theo tỉnh/thành)',
  })
  async categories(
    @Args('section', { type: () => PostType, nullable: true }) section?: PostType,
    @Args('includeLocationFilters', { type: () => Boolean, nullable: true, defaultValue: false })
    includeLocationFilters = false,
  ): Promise<CategoryEntity[]> {
    return this.categoriesService.list(section, includeLocationFilters);
  }

  @Public()
  @Query(() => [CategoryEntity], { description: 'Cây danh mục nhiều cấp' })
  async categoryTree(
    @Args('section', { type: () => PostType, nullable: true }) section?: PostType,
  ): Promise<CategoryEntity[]> {
    return this.categoriesService.tree(section);
  }

  @Public()
  @Query(() => CategoryEntity, { description: 'Chi tiết danh mục theo slug' })
  async category(@Args('slug', { type: () => String }) slug: string): Promise<CategoryEntity> {
    return this.categoriesService.findBySlug(slug);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => CategoryEntity, { description: 'Tạo danh mục (quản trị viên)' })
  async createCategory(
    @Args('input', { type: () => CategoryInputType }, zodPipe(categoryInputSchema)) input: CategoryInput,
  ): Promise<CategoryEntity> {
    return this.categoriesService.create(input);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => CategoryEntity, { description: 'Cập nhật danh mục (quản trị viên)' })
  async updateCategory(
    @Args('input', { type: () => UpdateCategoryInputType }, zodPipe(updateCategorySchema))
    input: UpdateCategoryInput,
  ): Promise<CategoryEntity> {
    return this.categoriesService.update(input);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => Boolean, { description: 'Xoá danh mục rỗng (quản trị viên)' })
  async deleteCategory(@Args('id', { type: () => String }) id: string): Promise<boolean> {
    return this.categoriesService.remove(id);
  }
}
