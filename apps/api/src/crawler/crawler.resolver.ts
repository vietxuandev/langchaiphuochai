import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Role } from '@phuochai/shared';
import { CurrentUser, Roles } from '../common/decorators';
import { CrawlerService } from './crawler.service';
import { CrawlCheckInputType, CrawlImportInputType } from './dto/crawl.inputs';
import {
  CrawlCandidateEntity,
  CrawlCheckResultEntity,
  CrawlImportResultEntity,
  CrawlPreviewEntity,
} from './entities/crawl-candidate.entity';
import type { UserEntity } from '../users/entities/user.entity';

/**
 * Crawl bài viết mới từ website cũ (phuochai.com) để import dần.
 *
 * Chỉ quản trị viên dùng được: bước 1 kiểm tra (không ghi DB), bước 2 import các bài đã chọn.
 */
@Resolver(() => CrawlCandidateEntity)
export class CrawlerResolver {
  constructor(private readonly crawlerService: CrawlerService) {}

  @Roles(Role.ADMIN)
  @Query(() => CrawlCheckResultEntity, {
    description: 'Kiểm tra bài mới trên website cũ (không ghi vào database)',
  })
  async crawlCheck(
    @Args('input', { type: () => CrawlCheckInputType, nullable: true }) input?: CrawlCheckInputType,
  ): Promise<CrawlCheckResultEntity> {
    return this.crawlerService.check(input ?? {});
  }

  @Roles(Role.ADMIN)
  @Query(() => CrawlPreviewEntity, { description: 'Xem nội dung đầy đủ của một bài đã kiểm tra' })
  async crawlPreview(@Args('id', { type: () => String }) id: string): Promise<CrawlPreviewEntity> {
    return this.crawlerService.previewContent(id);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => CrawlImportResultEntity, { description: 'Import các bài đã chọn vào database' })
  async crawlImport(
    @Args('input', { type: () => CrawlImportInputType }) input: CrawlImportInputType,
    @CurrentUser() user: UserEntity | null,
  ): Promise<CrawlImportResultEntity> {
    return this.crawlerService.import({ ...input, authorId: user?.id ?? null });
  }
}
