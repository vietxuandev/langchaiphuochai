import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { NotificationSeverity, NotificationType } from '@phuochai/shared';

/** Thông báo in-app trả về cho khu vực quản trị. */
@ObjectType('AdminNotification')
export class AdminNotificationEntity {
  @Field(() => ID)
  id!: string;

  @Field(() => NotificationType)
  type!: NotificationType;

  @Field(() => NotificationSeverity)
  severity!: NotificationSeverity;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  body?: string | null;

  @Field(() => String, { nullable: true })
  entityType?: string | null;

  @Field(() => String, { nullable: true })
  entityId?: string | null;

  @Field(() => String, { nullable: true, description: 'Đường dẫn nội bộ trong /quan-tri' })
  actionUrl?: string | null;

  @Field(() => Date, { nullable: true })
  readAt?: Date | null;

  @Field(() => Date)
  createdAt!: Date;
}

@ObjectType('AdminNotificationPage')
export class AdminNotificationPageEntity {
  @Field(() => [AdminNotificationEntity])
  items!: AdminNotificationEntity[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;

  @Field(() => Int, { description: 'Tổng số thông báo chưa đọc của người dùng hiện tại' })
  unreadCount!: number;
}
