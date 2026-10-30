import { Module } from '@nestjs/common';
import { UploadsModule } from '../uploads/uploads.module';
import { CrawlerResolver } from './crawler.resolver';
import { CrawlerService } from './crawler.service';

/** Tính năng crawl bài mới từ website cũ (quản trị viên). */
@Module({
  imports: [UploadsModule],
  providers: [CrawlerService, CrawlerResolver],
  exports: [CrawlerService],
})
export class CrawlerModule {}
