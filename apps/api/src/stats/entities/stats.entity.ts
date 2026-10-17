import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('TypeCount')
export class TypeCount {
  @Field(() => String)
  label!: string;

  @Field(() => String)
  value!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType('StatusCount')
export class StatusCount {
  @Field(() => String)
  label!: string;

  @Field(() => String)
  value!: string;

  @Field(() => Int)
  count!: number;
}

@ObjectType('MonthlyCount')
export class MonthlyCount {
  @Field(() => String)
  month!: string;

  @Field(() => Int)
  count!: number;
}

/** Thống kê cho dashboard quản trị. */
@ObjectType('DashboardStats')
export class DashboardStatsEntity {
  @Field(() => Int)
  totalPosts!: number;

  @Field(() => Int)
  publishedPosts!: number;

  @Field(() => Int)
  draftPosts!: number;

  @Field(() => Int)
  archivedPosts!: number;

  @Field(() => Int)
  totalUsers!: number;

  @Field(() => Int)
  totalCategories!: number;

  @Field(() => Int)
  totalViews!: number;

  @Field(() => [TypeCount])
  postsByType!: TypeCount[];

  @Field(() => [StatusCount])
  postsByStatus!: StatusCount[];

  @Field(() => [MonthlyCount])
  postsByMonth!: MonthlyCount[];
}

/** Thống kê công khai hiển thị ở trang chủ. */
@ObjectType('PublicStats')
export class PublicStatsEntity {
  @Field(() => Int)
  accommodations!: number;

  @Field(() => Int)
  news!: number;

  @Field(() => Int)
  realEstates!: number;

  @Field(() => Int)
  categories!: number;

  @Field(() => Int)
  cities!: number;

  @Field(() => Int)
  totalPosts!: number;
}
