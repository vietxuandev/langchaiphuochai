import { registerEnumType } from '@nestjs/graphql';

/** Trạng thái của một bài trong danh sách chờ duyệt. */
export enum CrawlCandidateStatus {
  /** Bài có trên web cũ nhưng chưa có trong database -> có thể import. */
  NEW = 'NEW',
  /** Bài đã có trong database -> không import lại. */
  EXISTING = 'EXISTING',
  /** Không tải/parse được trang. */
  ERROR = 'ERROR',
}

registerEnumType(CrawlCandidateStatus, {
  name: 'CrawlCandidateStatus',
  description: 'Trạng thái bài viết trong danh sách chờ duyệt crawl',
  valuesMap: {
    NEW: { description: 'Bài mới, có thể import' },
    EXISTING: { description: 'Đã có trong database' },
    ERROR: { description: 'Không tải hoặc không parse được' },
  },
});
