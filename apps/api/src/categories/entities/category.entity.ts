import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PostType } from '@phuochai/shared';

/** Danh mục (cây nhiều cấp). */
@ObjectType('Category')
export class CategoryEntity {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  slug!: string;

  @Field(() => PostType)
  section!: PostType;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => String, { nullable: true })
  seoTitle?: string | null;

  @Field(() => String, { nullable: true })
  imagePath?: string | null;

  @Field(() => String, { nullable: true })
  sourceUrl?: string | null;

  @Field(() => Int)
  level!: number;

  @Field(() => Int)
  sortOrder!: number;

  @Field(() => Int, { nullable: true })
  declaredCount?: number | null;

  @Field(() => Int, { nullable: true })
  discoveredCount?: number | null;

  @Field(() => Int)
  childCount!: number;

  @Field()
  isLocationFilter!: boolean;

  @Field(() => String, { nullable: true })
  parentId?: string | null;

  @Field(() => CategoryEntity, { nullable: true })
  parent?: CategoryEntity | null;

  @Field(() => [CategoryEntity])
  children!: CategoryEntity[];

  /** Số bài viết đã xuất bản trong danh mục. */
  @Field(() => Int)
  postCount!: number;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}

/** Số bài theo danh mục (dùng cho menu/khối thống kê). */
@ObjectType('CategoryCount')
export class CategoryCount {
  @Field(() => CategoryEntity)
  category!: CategoryEntity;

  @Field(() => Int)
  count!: number;
}
