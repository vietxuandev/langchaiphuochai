import { Field, ObjectType } from '@nestjs/graphql';
import { PostType } from '@phuochai/shared';
import { CrawlCandidateStatus } from '../crawl-status.enum';

/** Một bài viết tìm thấy trên website cũ, chờ admin duyệt trước khi import. */
@ObjectType('CrawlCandidate')
export class CrawlCandidateEntity {
  @Field(() => String, { description: 'URL bài viết đã mã hoá base64url (dùng để import)' })
  id!: string;

  @Field(() => String, { description: 'URL bài viết trên website cũ' })
  url!: string;

  @Field(() => String, { description: 'Khoá gốc, ví dụ "news:166"' })
  sourceKey!: string;

  @Field(() => String, { description: 'Slug gốc trên website cũ' })
  slug!: string;

  @Field(() => String)
  title!: string;

  @Field(() => PostType)
  type!: PostType;

  @Field(() => String, { nullable: true, description: 'Loại nội dung gốc trên site cũ' })
  itemType!: string | null;

  @Field(() => String, { nullable: true, description: 'Mô tả ngắn của bài (không phải nội dung)' })
  description!: string | null;

  @Field(() => String, { nullable: true, description: 'Ảnh đại diện (og:image) trên site cũ' })
  thumbnailUrl!: string | null;

  @Field(() => Date, { nullable: true })
  publishedAt!: Date | null;

  @Field(() => CrawlCandidateStatus, { description: 'NEW = bài mới, EXISTING = đã có, ERROR = lỗi' })
  status!: CrawlCandidateStatus;

  @Field(() => String, { nullable: true, description: 'ID bài đã có trong database (status = EXISTING)' })
  existingPostId!: string | null;

  @Field(() => String, { nullable: true })
  existingPostSlug!: string | null;

  @Field(() => String, { nullable: true, description: 'Lý do lỗi (status = ERROR)' })
  error!: string | null;
}

/** Kết quả bước kiểm tra bài mới. */
@ObjectType('CrawlCheckResult')
export class CrawlCheckResultEntity {
  @Field(() => Number)
  checked!: number;

  @Field(() => [CrawlCandidateEntity])
  candidates!: CrawlCandidateEntity[];

  @Field(() => [String], { description: 'Cảnh báo (slug không tìm thấy, danh sách trống...)' })
  warnings!: string[];
}

/** Kết quả import. */
@ObjectType('CrawlImportResult')
export class CrawlImportResultEntity {
  @Field(() => [CrawlCandidateEntity], { description: 'Các bài đã tạo' })
  created!: CrawlCandidateEntity[];

  @Field(() => [String], { description: 'Bài bị bỏ qua (đã tồn tại)' })
  skipped!: string[];

  @Field(() => [String], { description: 'Bài lỗi kèm lý do' })
  errors!: string[];
}

/** Nội dung đầy đủ của một bài đã kiểm tra (xem trước khi import). */
@ObjectType('CrawlPreview')
export class CrawlPreviewEntity {
  @Field(() => String, { nullable: true })
  html!: string | null;

  @Field(() => String, { nullable: true })
  text!: string | null;
}
