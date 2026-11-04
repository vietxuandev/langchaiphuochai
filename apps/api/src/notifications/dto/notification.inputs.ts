import { Field, InputType } from '@nestjs/graphql';
import { NotificationSeverity, NotificationType } from '@phuochai/shared';

@InputType()
export class AdminNotificationFilterInput {
  @Field(() => Boolean, { nullable: true })
  unreadOnly?: boolean;

  @Field(() => NotificationType, { nullable: true })
  type?: NotificationType;

  @Field(() => NotificationSeverity, { nullable: true })
  severity?: NotificationSeverity;
}
