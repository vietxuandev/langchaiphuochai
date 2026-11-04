import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationSeverity as PrismaNotificationSeverity,
  NotificationType as PrismaNotificationType,
  Role,
  UserStatus,
  type Prisma,
} from '@prisma/client';
import { NotificationSeverity, NotificationType } from '@phuochai/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminNotificationFilterInput } from './dto/notification.inputs';
import type { AdminNotificationPageEntity } from './entities/notification.entity';
import { TelegramService } from './telegram.service';

export interface NotifyAdminsInput {
  roles: Role[];
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  dedupeKey?: string | null;
  metadata?: Prisma.InputJsonValue;
  excludeUserIds?: string[];
}

const NOTIFICATION_TTL_DAYS = 90;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /** Tạo thông báo cho tất cả người dùng thuộc các vai trò chỉ định. */
  async notifyAdmins(input: NotifyAdminsInput): Promise<number> {
    const recipients = await this.prisma.user.findMany({
      where: {
        role: { in: input.roles },
        isActive: true,
        status: UserStatus.ACTIVE,
        ...(input.excludeUserIds?.length ? { id: { notIn: input.excludeUserIds } } : {}),
      },
      select: { id: true },
    });

    if (recipients.length === 0) return 0;

    const actionUrl = this.safeActionUrl(input.actionUrl);
    const expiresAt = new Date(Date.now() + NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.prisma.notification.createMany({
      data: recipients.map(({ id }) => ({
        userId: id,
        type: input.type as PrismaNotificationType,
        severity: (input.severity ?? NotificationSeverity.INFO) as PrismaNotificationSeverity,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        actionUrl,
        metadata: input.metadata,
        dedupeKey: input.dedupeKey ?? null,
        expiresAt,
      })),
      skipDuplicates: true,
    });

    if (result.count > 0) {
      // Không chặn request chính (đăng ký/đăng nhập/tạo bài) vì Telegram chậm.
      // In-app notification đã là nguồn sự thật; Telegram chỉ là kênh phụ.
      void this.telegram
        .sendAdminMessage({
          title: input.title,
          body: input.body,
          actionUrl,
          severity: input.severity,
        })
        .catch(() => undefined);
    }

    return result.count;
  }

  async list(
    userId: string,
    filter: AdminNotificationFilterInput | undefined,
    pageArg: number,
    pageSizeArg: number,
  ): Promise<AdminNotificationPageEntity> {
    const page = Math.max(1, pageArg);
    const pageSize = Math.min(50, Math.max(1, pageSizeArg));

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(filter?.unreadOnly ? { readAt: null } : {}),
      ...(filter?.type ? { type: filter.type as PrismaNotificationType } : {}),
      ...(filter?.severity ? { severity: filter.severity as PrismaNotificationSeverity } : {}),
    };

    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        type: item.type as unknown as NotificationType,
        severity: item.severity as unknown as NotificationSeverity,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }

    return true;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return result.count;
  }

  /** Chỉ cho phép link nội bộ trong khu vực quản trị. */
  private safeActionUrl(url?: string | null): string | null {
    if (!url) return null;
    return url.startsWith('/quan-tri') ? url : null;
  }
}
