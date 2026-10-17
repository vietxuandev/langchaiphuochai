import { Field, Float, InputType, Int, PartialType } from '@nestjs/graphql';
import { PostStatus, PostType } from '@phuochai/shared';
import { GraphQLJSON } from '../../common/scalars/json.scalar';

@InputType('PostImageInput')
export class PostImageInputType {
  /** Đường dẫn ảnh trên server mới (/upload/...) - lấy từ API upload ảnh. */
  @Field(() => String)
  path!: string;

  @Field(() => String, { nullable: true, defaultValue: 'gallery' })
  role?: string;

  @Field(() => String, { nullable: true })
  alt?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  sortOrder?: number;
}

/** Input tạo/cập nhật bài viết - cấu trúc khớp với `postInputSchema` trong @phuochai/shared. */
@InputType('PostInput')
export class PostInputType {
  @Field(() => PostType)
  type!: PostType;

  // Không đặt defaultValue: nếu để mặc định, mọi mutation update không truyền `status`
  // sẽ vô tình đưa bài về DRAFT. Giá trị mặc định do zod xử lý khi tạo mới.
  @Field(() => PostStatus, { nullable: true })
  status?: PostStatus;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  slug?: string;

  @Field(() => String, { nullable: true })
  summary?: string;

  @Field(() => String, { nullable: true })
  contentHtml?: string;

  @Field(() => String, { nullable: true })
  seoTitle?: string;

  @Field(() => String, { nullable: true })
  seoDescription?: string;

  @Field(() => String, { nullable: true })
  categoryId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => String, { nullable: true })
  publishedAt?: string;

  // Địa điểm
  @Field(() => String, { nullable: true })
  addressRaw?: string;

  @Field(() => String, { nullable: true, description: 'Xã/phường - phải thuộc danh mục TP. Hồ Chí Minh' })
  ward?: string;


  @Field(() => String, { nullable: true })
  city?: string;

  // Giá
  @Field(() => String, { nullable: true })
  priceRaw?: string;

  @Field(() => Float, { nullable: true })
  priceValue?: number;

  @Field(() => String, { nullable: true })
  priceUnit?: string;

  @Field(() => Float, { nullable: true })
  pricePerM2Value?: number;

  // Thuộc tính
  @Field(() => Float, { nullable: true })
  areaM2?: number;

  @Field(() => String, { nullable: true })
  areaText?: string;

  @Field(() => Float, { nullable: true })
  widthM?: number;

  @Field(() => Float, { nullable: true })
  lengthM?: number;

  @Field(() => String, { nullable: true })
  dimensions?: string;

  @Field(() => Int, { nullable: true })
  bedrooms?: number;

  @Field(() => Int, { nullable: true })
  bathrooms?: number;

  @Field(() => Int, { nullable: true })
  floors?: number;

  @Field(() => String, { nullable: true })
  direction?: string;

  @Field(() => String, { nullable: true })
  roadWidth?: string;

  @Field(() => String, { nullable: true })
  legal?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  attributes?: Record<string, string>;

  // Liên hệ
  @Field(() => String, { nullable: true })
  contactName?: string;

  @Field(() => String, { nullable: true })
  contactPhone?: string;

  @Field(() => String, { nullable: true })
  contactEmail?: string;

  @Field(() => String, { nullable: true })
  contactZalo?: string;

  @Field(() => Boolean, { nullable: true })
  verified?: boolean;

  @Field(() => Boolean, { nullable: true })
  hasManager?: boolean;

  @Field(() => [PostImageInputType], { nullable: true })
  images?: PostImageInputType[];
}

@InputType('UpdatePostInput')
export class UpdatePostInputType extends PartialType(PostInputType) {
  @Field(() => String)
  id!: string;
}
