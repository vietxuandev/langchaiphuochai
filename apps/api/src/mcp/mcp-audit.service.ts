import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { McpAuthContext } from './api-tokens.service';

/** Ghi nhật ký mọi lần agent gọi tool (thành công, lỗi, bị từ chối). */
@Injectable()
export class McpAuditService {
  private readonly logger = new Logger(McpAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async write(input: {
    auth: McpAuthContext;
    tool: string;
    status: 'ok' | 'error' | 'denied';
    errorCode?: string | null;
    postId?: string | null;
    durationMs: number;
    args?: unknown;
  }): Promise<void> {
    try {
      await this.prisma.mcpAuditLog.create({
        data: {
          tokenId: input.auth.tokenId,
          userId: input.auth.user.id,
          tool: input.tool,
          status: input.status,
          errorCode: input.errorCode ?? null,
          postId: input.postId ?? null,
          durationMs: Math.max(0, Math.round(input.durationMs)),
          args: this.redact(input.args) as Prisma.InputJsonValue,
          ipHash: input.auth.ipHash ?? null,
          userAgent: input.auth.userAgent?.slice(0, 300) ?? null,
        },
      });
    } catch (error) {
      // Audit không được làm hỏng thao tác của agent
      this.logger.warn(`Không ghi được audit log: ${error instanceof Error ? error.message : 'lỗi'}`);
    }
  }

  /** Đếm số bài agent đã tạo trong ngày (để áp quota). */
  async countPostsToday(tokenId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.mcpAuditLog.count({
      where: { tokenId, tool: 'create_post', status: 'ok', createdAt: { gte: startOfDay } },
    });
  }

  /** Rút gọn tham số để không lưu nội dung bài đầy đủ vào log. */
  private redact(args: unknown): unknown {
    if (args === null || args === undefined) return undefined;
    const text = JSON.stringify(args, (_key, value) => {
      if (typeof value === 'string' && value.length > 400) return `${value.slice(0, 400)}...[${value.length} ký tự]`;
      return value;
    });
    return { preview: text.slice(0, 4000) };
  }
}
