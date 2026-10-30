import { Field, InputType, Int } from '@nestjs/graphql';
import { PostStatus } from '@phuochai/shared';

/**
 * Input bước kiểm tra bài mới.
 *
 * Có 3 cách dùng (có thể kết hợp):
 *  - `urls`: dán URL/đường dẫn bài viết trên web cũ (vd `/tin-tuc/abc-166.html`)
 *  - `slugs`: dán slug của web cũ (vd `abc-166` hoặc `abc`), hệ thống tra trong danh sách bài
 *  - `scanListings`: tự quét các trang danh sách để tìm bài mới
 */
@InputType('CrawlCheckInput')
export class CrawlCheckInputType {
  @Field(() => [String], { nullable: true, description: 'URL hoặc đường dẫn bài viết trên web cũ' })
  urls?: string[];

  @Field(() => [String], { nullable: true, description: 'Slug bài viết trên web cũ' })
  slugs?: string[];

  @Field(() => Boolean, { nullable: true, description: 'Quét trang danh sách để tìm bài mới' })
  scanListings?: boolean;

  @Field(() => Int, { nullable: true, description: 'Số bài mới tối đa khi quét danh sách (mặc định 12)' })
  listingLimit?: number;
}

/** Input bước import các bài đã chọn. */
@InputType('CrawlImportInput')
export class CrawlImportInputType {
  @Field(() => [String], { description: 'Danh sách id của bài đã kiểm tra' })
  ids!: string[];

  @Field(() => PostStatus, {
    nullable: true,
    description: 'Trạng thái sau khi import: DRAFT (mặc định, cần duyệt tiếp) hoặc PUBLISHED',
  })
  status?: PostStatus;
}
