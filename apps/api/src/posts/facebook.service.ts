import { Injectable, Logger } from '@nestjs/common';
import { PostType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { PostEntity } from './entities/post.entity';

const GRAPH_VERSION = 'v21.0';

export type FacebookPostInput = Pick<PostEntity, 'id' | 'slug' | 'type' | 'title' | 'summary' | 'facebookCaption'>;

/** Đăng / gỡ bài trên Facebook Page qua Graph API. Đăng tự động do FacebookQueueService phụ trách. */
@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Thu hồi nền: xoá bài trên Page và xoá facebookPostId để có thể đăng lại sau này. */
  retract(postId: string, facebookPostId: string | null | undefined): void {
    if (!facebookPostId) return;
    void this.unpostNow(postId, facebookPostId).catch((err) =>
      this.logger.warn(`Xoá bài Facebook ${facebookPostId} thất bại: ${(err as Error).message}`),
    );
  }

  /** Đăng bài lên Page và trả về ID bài Facebook; ném lỗi nếu thất bại. Bỏ qua khi đã đăng. */
  async postNow(post: FacebookPostInput): Promise<string | null> {
    const pageId = process.env.FB_PAGE_ID;
    const token = process.env.FB_PAGE_TOKEN;
    if (!pageId || !token) throw new Error('Thiếu FB_PAGE_ID hoặc FB_PAGE_TOKEN');

    const existing = await this.prisma.post.findUnique({
      where: { id: post.id },
      select: { facebookPostId: true },
    });
    if (!existing || existing.facebookPostId) return null;

    const url = this.postUrl(post);
    const caption = post.facebookCaption?.trim();
    const message = caption
      ? caption.includes(url)
        ? caption
        : `${caption}\n\n${url}`
      : [post.title, post.summary].filter(Boolean).join('\n\n');
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, link: url, access_token: token }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
    if (!res.ok || !data.id) throw new Error(data.error?.message ?? `HTTP ${res.status}`);

    await this.prisma.post.update({ where: { id: post.id }, data: { facebookPostId: data.id, facebookPostedAt: new Date() } });
    this.logger.log(`Đã đăng "${post.slug}" lên Facebook (${data.id})`);
    return data.id;
  }

  /** Xoá bài trên Page rồi xoá facebookPostId; ném lỗi nếu Facebook từ chối. */
  async unpostNow(postId: string, facebookPostId: string): Promise<void> {
    await this.prisma.post.updateMany({ where: { id: postId }, data: { facebookPostId: null } });
    const token = process.env.FB_PAGE_TOKEN;
    if (!token) return;
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${facebookPostId}?access_token=${encodeURIComponent(token)}`,
      { method: 'DELETE', signal: AbortSignal.timeout(15_000) },
    );
    const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || !data.success) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
    this.logger.log(`Đã xoá bài Facebook ${facebookPostId}`);
  }

  private postUrl(post: FacebookPostInput): string {
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://langchaiphuochai.com').replace(/\/+$/, '');
    const base =
      post.type === PostType.ACCOMMODATION
        ? '/luu-tru'
        : post.type === PostType.NEWS
          ? '/tin-tuc'
          : '/bat-dong-san';
    return `${site}${base}/${post.slug}`;
  }
}
