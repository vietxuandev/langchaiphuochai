import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PostStatus, PostType } from '@phuochai/shared';
import type { PostInput } from '@phuochai/shared';
import { createPostSchema, postFilterSchema, updatePostSchema } from '@phuochai/shared';
import { CurrentUser, OptionalAuth, Public, Roles } from '../common/decorators';
import { zodPipe } from '../common/zod.pipe';
import { Role } from '@phuochai/shared';
import { PostInputType, UpdatePostInputType } from './dto/post.inputs';
import { PaginatedPosts, PostEntity, PostFilterInput, WardCount } from './entities/post.entity';
import { PostsService, type Viewer } from './posts.service';
import { UsersService } from '../users/users.service';
import type { UserEntity } from '../users/entities/user.entity';
import { Role as PrismaRole } from '@prisma/client';

/** Filter có giá trị mặc định để query `posts` không truyền filter vẫn chạy đúng. */
const postFilterWithDefaults = postFilterSchema.default({});

@Resolver(() => PostEntity)
export class PostsResolver {
  constructor(
    private readonly postsService: PostsService,
    private readonly users: UsersService,
  ) {}

  /** Chuyển entity người dùng thành "người xem" cho tầng service. */
  private async toViewer(user: UserEntity | null): Promise<Viewer | null> {
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name, role: user.role as unknown as PrismaRole };
  }

  /* ------------------------------- Truy vấn ------------------------------ */

  @OptionalAuth()
  @Query(() => PaginatedPosts, {
    description: 'Danh sách bài viết có phân trang, lọc theo loại/danh mục/giá/khu vực/từ khoá',
  })
  async posts(
    @Args('filter', { type: () => PostFilterInput, nullable: true }, zodPipe(postFilterWithDefaults))
    filter: PostFilterInput,
    @CurrentUser() user: UserEntity | null = null,
  ): Promise<PaginatedPosts> {
    return this.postsService.list(filter, await this.toViewer(user));
  }

  @OptionalAuth()
  @Query(() => PostEntity, { description: 'Chi tiết bài viết theo slug (tự tăng lượt xem)' })
  async post(
    @Args('slug', { type: () => String }) slug: string,
    @CurrentUser() user: UserEntity | null = null,
    @Args('countView', { type: () => Boolean, nullable: true, defaultValue: false }) countView = false,
  ): Promise<PostEntity> {
    const post = await this.postsService.findBySlug(slug, await this.toViewer(user));
    if (countView) await this.postsService.incrementViews(post.id);
    return post;
  }

  @OptionalAuth()
  @Query(() => PostEntity, { description: 'Chi tiết bài viết theo id' })
  async postById(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: UserEntity | null = null,
  ): Promise<PostEntity> {
    return this.postsService.findById(id, await this.toViewer(user));
  }

  @Public()
  @Query(() => [PostEntity], { description: 'Bài viết liên quan' })
  async relatedPosts(
    @Args('slug', { type: () => String }) slug: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 4 }) limit = 4,
  ): Promise<PostEntity[]> {
    return this.postsService.related(slug, limit);
  }

  @Public()
  @Query(() => [PostEntity], { description: 'Bài nổi bật theo loại (dùng cho trang chủ)' })
  async featuredPosts(
    @Args('type', { type: () => PostType }) type: PostType,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 8 }) limit = 8,
  ): Promise<PostEntity[]> {
    return this.postsService.featured(type, limit);
  }

  @Public()
  @Query(() => [PostEntity], { description: 'Bài mới nhất theo loại' })
  async latestPosts(
    @Args('type', { type: () => PostType }) type: PostType,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 6 }) limit = 6,
  ): Promise<PostEntity[]> {
    return this.postsService.latest(type, limit);
  }

  @Public()
  @Query(() => [WardCount], {
    description: 'Số bài theo xã/phường (chỉ các xã/phường đang có bài) - dùng cho bộ lọc',
  })
  async postWards(
    @Args('type', { type: () => PostType, nullable: true }) type?: PostType,
  ): Promise<WardCount[]> {
    return this.postsService.wardCounts(type);
  }

  /* ------------------------------ Thao tác ghi --------------------------- */

  @Mutation(() => PostEntity, { description: 'Tạo bài viết mới (thành viên tạo bản nháp, editor có thể xuất bản)' })
  async createPost(
    @Args('input', { type: () => PostInputType }, zodPipe(createPostSchema)) input: PostInput,
    @CurrentUser() user: UserEntity,
  ): Promise<PostEntity> {
    return this.postsService.create(input, (await this.toViewer(user))!);
  }

  @Mutation(() => PostEntity, { description: 'Cập nhật bài viết' })
  async updatePost(
    @Args('input', { type: () => UpdatePostInputType }, zodPipe(updatePostSchema))
    input: PostInput & { id: string },
    @CurrentUser() user: UserEntity,
  ): Promise<PostEntity> {
    return this.postsService.update(input, (await this.toViewer(user))!);
  }

  @Mutation(() => Boolean, { description: 'Xoá bài viết' })
  async deletePost(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<boolean> {
    return this.postsService.remove(id, (await this.toViewer(user))!);
  }

  @Roles(Role.EDITOR)
  @Mutation(() => PostEntity, { description: 'Xuất bản bài viết (editor/admin)' })
  async publishPost(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<PostEntity> {
    return this.postsService.setStatus(id, PostStatus.PUBLISHED, (await this.toViewer(user))!);
  }

  @Roles(Role.EDITOR)
  @Mutation(() => PostEntity, { description: 'Chuyển bài viết về bản nháp (editor/admin)' })
  async unpublishPost(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<PostEntity> {
    return this.postsService.setStatus(id, PostStatus.DRAFT, (await this.toViewer(user))!);
  }

  @Roles(Role.EDITOR)
  @Mutation(() => PostEntity, { description: 'Lưu trữ bài viết (editor/admin)' })
  async archivePost(
    @Args('id', { type: () => String }) id: string,
    @CurrentUser() user: UserEntity,
  ): Promise<PostEntity> {
    return this.postsService.setStatus(id, PostStatus.ARCHIVED, (await this.toViewer(user))!);
  }

  @Public()
  @Mutation(() => Boolean, { description: 'Tăng lượt xem bài viết' })
  async incrementPostViews(@Args('id', { type: () => String }) id: string): Promise<boolean> {
    await this.postsService.incrementViews(id);
    return true;
  }
}
