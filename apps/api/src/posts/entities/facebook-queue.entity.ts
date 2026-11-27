import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('FacebookQueueStatus')
export class FacebookQueueStatusEntity {
  @Field() enabled!: boolean;
  @Field(() => [String], { description: 'Các khung giờ đăng HH:mm (giờ Việt Nam)' })
  postTimes!: string[];
  @Field(() => Int, { description: 'Số bài đăng mỗi ngày (= số khung giờ)' })
  postsPerDay!: number;
  @Field() onlyNews!: boolean;
  @Field(() => Int, { description: 'Số bài đủ điều kiện đang chờ đăng (đã có caption)' })
  pendingCount!: number;
  @Field(() => Int, { description: 'Số bài chưa đăng nhưng chưa có facebookCaption nên bị bỏ qua' })
  missingCaptionCount!: number;
  @Field(() => String, { nullable: true }) nextPostTitle?: string | null;
  @Field(() => String, { nullable: true, description: 'Khung giờ đăng kế tiếp (YYYY-MM-DD HH:mm)' })
  nextSlot?: string | null;
  @Field(() => Date, { nullable: true }) lastRunAt?: Date | null;
  @Field(() => String, { nullable: true }) lastError?: string | null;
}

@ObjectType('FacebookQueueRunResult')
export class FacebookQueueRunResultEntity {
  @Field() posted!: boolean;
  @Field(() => String, { nullable: true }) title?: string | null;
  @Field(() => String, { nullable: true }) error?: string | null;
}
