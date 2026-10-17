import { Field, InputType, Int, PartialType } from '@nestjs/graphql';
import { PostType } from '@phuochai/shared';

@InputType('CategoryInput')
export class CategoryInputType {
  @Field(() => String)
  name!: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => PostType)
  section!: PostType;

  @Field(() => String, { nullable: true })
  description?: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string;

  @Field(() => String, { nullable: true })
  imagePath?: string;

  @Field(() => String, { nullable: true })
  parentId?: string;

  // Không đặt defaultValue để cập nhật một phần không vô tình reset thứ tự.
  @Field(() => Int, { nullable: true })
  sortOrder?: number;
}

@InputType('UpdateCategoryInput')
export class UpdateCategoryInputType extends PartialType(CategoryInputType) {
  @Field(() => String)
  id!: string;
}
