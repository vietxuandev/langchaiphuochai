import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService, TelegramService, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
