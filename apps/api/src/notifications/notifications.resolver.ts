import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Role } from '@phuochai/shared';
import { CurrentUser, Roles } from '../common/decorators';
import { UserEntity } from '../users/entities/user.entity';
import { AdminNotificationFilterInput } from './dto/notification.inputs';
import {
  AdminNotificationEntity,
  AdminNotificationPageEntity,
} from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

@Resolver(() => AdminNotificationEntity)
export class NotificationsResolver {
  constructor(private readonly notifications: NotificationsService) {}

  @Roles(Role.ADMIN, Role.EDITOR)
  @Query(() => AdminNotificationPageEntity, { description: 'Danh sách thông báo của quản trị viên' })
  async adminNotifications(
    @CurrentUser() user: UserEntity,
    @Args('filter', { type: () => AdminNotificationFilterInput, nullable: true })
    filter?: AdminNotificationFilterInput,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 20 }) pageSize = 20,
  ): Promise<AdminNotificationPageEntity> {
    return this.notifications.list(user.id, filter, page, pageSize);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Mutation(() => Boolean, { description: 'Đánh dấu một thông báo đã đọc' })
  async markAdminNotificationRead(
    @CurrentUser() user: UserEntity,
    @Args('id', { type: () => String }) id: string,
  ): Promise<boolean> {
    return this.notifications.markRead(user.id, id);
  }

  @Roles(Role.ADMIN, Role.EDITOR)
  @Mutation(() => Int, { description: 'Đánh dấu tất cả thông báo đã đọc' })
  async markAllAdminNotificationsRead(@CurrentUser() user: UserEntity): Promise<number> {
    return this.notifications.markAllRead(user.id);
  }
}
