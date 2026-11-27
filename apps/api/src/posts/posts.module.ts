import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { FacebookQueueResolver } from './facebook-queue.resolver';
import { FacebookQueueService } from './facebook-queue.service';
import { FacebookWebhookController } from './facebook-webhook.controller';
import { FacebookService } from './facebook.service';
import { PostsResolver } from './posts.resolver';
import { PostsService } from './posts.service';

@Module({
  imports: [CategoriesModule, UsersModule, NotificationsModule],
  controllers: [FacebookWebhookController],
  providers: [PostsService, PostsResolver, FacebookService, FacebookQueueService, FacebookQueueResolver],
  exports: [PostsService, FacebookService, FacebookQueueService],
})
export class PostsModule {}
