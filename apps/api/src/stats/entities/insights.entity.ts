import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('InsightItem')
export class InsightItemEntity {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  title!: string;

  /** Đường dẫn quản trị hoặc slug tuỳ loại mục */
  @Field(() => String, { nullable: true })
  detail?: string | null;
}

/** Một nhóm vấn đề cần xử lý (số lượng + vài mẫu). */
@ObjectType('InsightIssue')
export class InsightIssueEntity {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  label!: string;

  @Field(() => Int)
  count!: number;

  @Field(() => [InsightItemEntity])
  items!: InsightItemEntity[];
}

@ObjectType('DayCount')
export class DayCountEntity {
  @Field(() => String)
  day!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType('MonthTypeCount')
export class MonthTypeCountEntity {
  @Field(() => String)
  month!: string;

  @Field(() => String)
  type!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType('TopPost')
export class TopPostEntity {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String)
  type!: string;

  @Field(() => Int)
  views!: number;

  /** Lượt xem trong 30 ngày gần nhất */
  @Field(() => Int)
  views30d!: number;
}

@ObjectType('ViewsInsight')
export class ViewsInsightEntity {
  @Field(() => Int)
  last7!: number;

  @Field(() => Int)
  last30!: number;

  /** Ngày bắt đầu ghi nhận theo ngày (null nếu chưa có dữ liệu) */
  @Field(() => String, { nullable: true })
  trackedSince?: string | null;

  @Field(() => [DayCountEntity])
  byDay!: DayCountEntity[];

  @Field(() => [TopPostEntity])
  topPosts!: TopPostEntity[];
}

@ObjectType('AffiliateTopLink')
export class AffiliateTopLinkEntity {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => Int)
  clicks!: number;

  @Field(() => Int)
  clicks30d!: number;

  @Field(() => Boolean)
  isActive!: boolean;
}

@ObjectType('AffiliateInsight')
export class AffiliateInsightEntity {
  @Field(() => Int)
  totalLinks!: number;

  @Field(() => Int)
  activeLinks!: number;

  @Field(() => Int)
  totalClicks!: number;

  @Field(() => Int)
  clicks7!: number;

  @Field(() => Int)
  clicks30!: number;

  @Field(() => [DayCountEntity])
  byDay!: DayCountEntity[];

  @Field(() => [AffiliateTopLinkEntity])
  topLinks!: AffiliateTopLinkEntity[];
}

@ObjectType('McpActivity')
export class McpActivityEntity {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  tool!: string;

  @Field(() => String)
  status!: string;

  @Field(() => String, { nullable: true })
  postId?: string | null;

  @Field(() => Int)
  durationMs!: number;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('LastImport')
export class LastImportEntity {
  @Field(() => String)
  source!: string;

  @Field(() => Int)
  created!: number;

  @Field(() => Int)
  updated!: number;

  @Field(() => Int)
  skipped!: number;

  @Field(() => Date)
  startedAt!: Date;

  @Field(() => Date, { nullable: true })
  finishedAt?: Date | null;
}

@ObjectType('ActivityInsight')
export class ActivityInsightEntity {
  @Field(() => [McpActivityEntity])
  recentMcp!: McpActivityEntity[];

  @Field(() => Int)
  mcpCalls7d!: number;

  @Field(() => Int)
  mcpErrors7d!: number;

  @Field(() => LastImportEntity, { nullable: true })
  lastImport?: LastImportEntity | null;
}

/** Số liệu mở rộng cho dashboard: sức khoẻ nội dung, xu hướng, affiliate, hoạt động. */
@ObjectType('DashboardInsights')
export class DashboardInsightsEntity {
  @Field(() => Int)
  publishedChecked!: number;

  @Field(() => [InsightIssueEntity])
  contentHealth!: InsightIssueEntity[];

  @Field(() => [InsightIssueEntity])
  attention!: InsightIssueEntity[];

  @Field(() => ViewsInsightEntity)
  views!: ViewsInsightEntity;

  @Field(() => AffiliateInsightEntity)
  affiliate!: AffiliateInsightEntity;

  @Field(() => ActivityInsightEntity)
  activity!: ActivityInsightEntity;

  @Field(() => [MonthTypeCountEntity])
  postsByMonthType!: MonthTypeCountEntity[];
}
