import { createHmac, timingSafeEqual } from 'node:crypto';
import { Body, Controller, ForbiddenException, Get, HttpCode, Logger, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

interface FeedChange {
  field?: string;
  value?: {
    item?: string;
    verb?: string;
    post_id?: string;
    comment_id?: string;
    message?: string;
    from?: { name?: string };
  };
}

interface WebhookPayload {
  object?: string;
  entry?: Array<{ id?: string; changes?: FeedChange[] }>;
}

/**
 * Webhook của Facebook cho Page:
 * - GET  /webhooks/facebook  : xác minh khi đăng ký (hub.verify_token = FB_WEBHOOK_VERIFY_TOKEN)
 * - POST /webhooks/facebook  : nhận sự kiện, kiểm tra chữ ký bằng FB_APP_SECRET
 * Khi bài bị xoá trực tiếp trên Facebook thì xoá facebookPostId để hàng chờ/admin biết bài không còn trên Page.
 */
@Controller('webhooks/facebook')
export class FacebookWebhookController {
  private readonly logger = new Logger(FacebookWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ): string {
    const expected = process.env.FB_WEBHOOK_VERIFY_TOKEN;
    if (mode !== 'subscribe' || !expected || token !== expected) throw new ForbiddenException();
    return challenge ?? '';
  }

  @Public()
  @Post()
  @HttpCode(200)
  async receive(@Req() req: Request & { rawBody?: Buffer }, @Body() body: WebhookPayload): Promise<{ received: true }> {
    if (!this.validSignature(req)) throw new ForbiddenException('Chữ ký không hợp lệ');
    if (body.object !== 'page') return { received: true };

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'feed' || !change.value) continue;
        const { item, verb, post_id: postId, message, from } = change.value;
        if (item === 'status' && verb === 'remove' && postId) {
          const res = await this.prisma.post.updateMany({
            where: { facebookPostId: postId },
            data: { facebookPostId: null, facebookScheduledAt: null },
          });
          if (res.count) this.logger.log(`Bài ${postId} bị xoá trên Facebook, đã xoá facebookPostId`);
        } else if (item === 'comment' && verb === 'add') {
          this.logger.log(
            `Bình luận mới trên ${postId} từ ${from?.name ?? 'ẩn danh'}: ${(message ?? '').slice(0, 200)}`,
          );
        }
      }
    }
    return { received: true };
  }

  private validSignature(req: Request & { rawBody?: Buffer }): boolean {
    const secret = process.env.FB_APP_SECRET;
    const header = req.header('x-hub-signature-256');
    if (!secret || !header || !req.rawBody) return false;
    const expected = `sha256=${createHmac('sha256', secret).update(req.rawBody).digest('hex')}`;
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
