import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql';
import { PostStatus, PostType } from '@phuochai/shared';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { PostSortField, SortDirection } from '../../graphql/enums';
import { GraphQLJSON } from '../../common/scalars/json.scalar';
import { UserEntity } from '../../users/entities/user.entity';

@ObjectType('PostImage')
export class PostImageEntity {
  @Field()
  id!: string;

  /** Đường dẫn ảnh trên server mới: /upload/posts/2026/10/abc.jpg */
  @Field()
  path!: string;

  @Field()
  role!: string;

  @Field(() => String, { nullable: true })
  alt?: string | null;

  @Field(() => Int, { nullable: true })
  bytes?: number | null;

  @Field(() => String, { nullable: true })
  sha256?: string | null;

  @Field(() => Int)
  sortOrder!: number;
}

@ObjectType('Tag')
export class TagEntity {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;
}

@ObjectType('Post')
export class PostEntity {
  @Field()
  id!: string;

  @Field(() => String, { nullable: true })
  sourceKey?: string | null;

  @Field(() => PostType)
  type!: PostType;

  @Field(() => PostStatus)
  status!: PostStatus;

  @Field()
  slug!: string;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string | null;

  @Field(() => String, { nullable: true })
  summary?: string | null;

  @Field(() => String, { nullable: true })
  contentHtml?: string | null;

  @Field(() => String, { nullable: true })
  contentText?: string | null;

  @Field(() => String, { nullable: true })
  code?: string | null;

  @Field(() => Int)
  views!: number;

  // Địa điểm
  @Field(() => String, { nullable: true })
  addressRaw?: string | null;

  @Field(() => String, { nullable: true, description: 'Xã/phường (TP. Hồ Chí Minh)' })
  ward?: string | null;


  @Field(() => String, { nullable: true, description: 'Tỉnh/thành phố - luôn là Thành phố Hồ Chí Minh' })
  city?: string | null;

  // Giá
  @Field(() => String, { nullable: true })
  priceRaw?: string | null;

  @Field(() => Float, { nullable: true })
  priceValue?: number | null;

  @Field(() => String, { nullable: true })
  priceUnit?: string | null;

  @Field(() => String, { nullable: true })
  currency?: string | null;

  @Field(() => String, { nullable: true })
  pricePerM2Raw?: string | null;

  @Field(() => Float, { nullable: true })
  pricePerM2Value?: number | null;

  // Thuộc tính
  @Field(() => Float, { nullable: true })
  areaM2?: number | null;

  @Field(() => String, { nullable: true })
  areaText?: string | null;

  @Field(() => Float, { nullable: true })
  widthM?: number | null;

  @Field(() => Float, { nullable: true })
  lengthM?: number | null;

  @Field(() => String, { nullable: true })
  dimensions?: string | null;

  @Field(() => Int, { nullable: true })
  bedrooms?: number | null;

  @Field(() => Int, { nullable: true })
  bathrooms?: number | null;

  @Field(() => Int, { nullable: true })
  floors?: number | null;

  @Field(() => String, { nullable: true })
  direction?: string | null;

  @Field(() => String, { nullable: true })
  roadWidth?: string | null;

  @Field(() => String, { nullable: true })
  legal?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  attributes?: unknown;

  // Liên hệ
  @Field(() => String, { nullable: true })
  contactName?: string | null;

  @Field(() => String, { nullable: true })
  contactPhone?: string | null;

  @Field(() => String, { nullable: true })
  contactEmail?: string | null;

  @Field(() => String, { nullable: true })
  contactZalo?: string | null;

  @Field(() => Boolean, { nullable: true })
  verified?: boolean | null;

  @Field(() => Boolean, { nullable: true })
  hasManager?: boolean | null;

  @Field(() => GraphQLJSON, { nullable: true })
  seo?: unknown;

  @Field(() => GraphQLJSON, { nullable: true })
  extras?: unknown;

  @Field(() => [String])
  warnings!: string[];

  @Field(() => [String])
  tagsText!: string[];

  @Field(() => String, { nullable: true })
  categoryId?: string | null;

  @Field(() => CategoryEntity, { nullable: true })
  category?: CategoryEntity | null;

  @Field(() => String, { nullable: true })
  authorId?: string | null;

  @Field(() => UserEntity, { nullable: true })
  author?: UserEntity | null;

  @Field(() => [PostImageEntity])
  images!: PostImageEntity[];

  @Field(() => PostImageEntity, { nullable: true })
  heroImage?: PostImageEntity | null;

  @Field(() => [TagEntity])
  tags!: TagEntity[];

  @Field(() => Date, { nullable: true })
  publishedAt?: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType('PaginatedPosts')
export class PaginatedPosts {
  @Field(() => [PostEntity])
  items!: PostEntity[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Boolean)
  hasNextPage!: boolean;
}

/** Bộ lọc danh sách bài viết - khớp 1-1 với `postFilterSchema` trong @phuochai/shared. */
@InputType('PostFilterInput')
export class PostFilterInput {
  @Field(() => PostType, { nullable: true })
  type?: PostType;

  @Field(() => PostStatus, { nullable: true })
  status?: PostStatus;

  @Field(() => String, { nullable: true })
  categoryId?: string;

  @Field(() => String, { nullable: true })
  categorySlug?: string;


  @Field(() => String, { nullable: true, description: 'Lọc theo xã/phường' })
  ward?: string;

  @Field(() => String, { nullable: true })
  tag?: string;

  @Field(() => String, { nullable: true })
  keyword?: string;

  @Field(() => Float, { nullable: true })
  minPrice?: number;

  @Field(() => Float, { nullable: true })
  maxPrice?: number;

  @Field(() => String, { nullable: true })
  authorId?: string;

  @Field(() => Boolean, { nullable: true })
  onlyMine?: boolean;

  /** Chỉ lấy bài có ảnh đại diện (dùng cho các khối trang chủ). */
  @Field(() => Boolean, { nullable: true })
  onlyWithImage?: boolean;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  page?: number;

  @Field(() => Int, { nullable: true, defaultValue: 12 })
  pageSize?: number;

  @Field(() => PostSortField, { nullable: true, defaultValue: PostSortField.CREATED_AT })
  sortBy?: PostSortField;

  @Field(() => SortDirection, { nullable: true, defaultValue: SortDirection.DESC })
  sortOrder?: SortDirection;
}

@ObjectType({ description: 'Số bài viết theo xã/phường' })
export class WardCount {
  @Field(() => String, { description: 'Tên xã/phường chuẩn' })
  ward!: string;

  @Field(() => Int)
  count!: number;
}
