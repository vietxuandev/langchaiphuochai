import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PostStatus, PostType, type FacebookQueueSetting, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from './facebook.service';

const SETTING_ID = 'default';
const TZ = 'Asia/Ho_Chi_Minh';
/** Bỏ qua khung giờ đã trễ quá lâu (ví dụ server tắt) để không đăng dồn. */
const CATCH_UP_MINUTES = 120;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type FacebookQueueConfig = { enabled: boolean; postTimes: string[]; onlyNews: boolean };

export type FacebookQueueStatus = {
  enabled: boolean;
  postTimes: string[];
  postsPerDay: number;
  onlyNews: boolean;
  pendingCount: number;
  missingCaptionCount: number;
  nextPostTitle: string | null;
  nextSlot: string | null;
  lastRunAt: Date | null;
  lastError: string | null;
};

/** Hàng chờ đăng Facebook: mỗi khung giờ đăng 1 bài cũ nhất chưa đăng (cần có facebookCaption). */
@Injectable()
export class FacebookQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FacebookQueueService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebook: FacebookService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  static parseTimes(raw: string): string[] {
    return [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))].sort();
  }

  /** Chuẩn hoá và kiểm tra danh sách giờ "HH:mm". */
  static normalizeTimes(times: string[]): string[] {
    const list = [...new Set(times.map((t) => t.trim()).filter(Boolean))].sort();
    if (list.length === 0 || list.length > 24 || list.some((t) => !TIME_RE.test(t))) {
      throw new Error('postTimes phải gồm 1-24 giờ dạng HH:mm (giờ Việt Nam), ví dụ 08:00');
    }
    return list;
  }

  private async getRow(): Promise<FacebookQueueSetting> {
    return this.prisma.facebookQueueSetting.upsert({
      where: { id: SETTING_ID },
      create: { id: SETTING_ID },
      update: {},
    });
  }

  async updateConfig(patch: Partial<FacebookQueueConfig>): Promise<FacebookQueueStatus> {
    const data: Prisma.FacebookQueueSettingUpdateInput = {};
    if (patch.enabled !== undefined) data.enabled = patch.enabled;
    if (patch.onlyNews !== undefined) data.onlyNews = patch.onlyNews;
    if (patch.postTimes !== undefined) data.postTimes = FacebookQueueService.normalizeTimes(patch.postTimes).join(',');
    await this.getRow();
    await this.prisma.facebookQueueSetting.update({ where: { id: SETTING_ID }, data });
    return this.status();
  }

  private eligibleWhere(onlyNews: boolean): Prisma.PostWhereInput {
    return {
      status: PostStatus.PUBLISHED,
      type: onlyNews ? PostType.NEWS : { not: PostType.PAGE },
      facebookPostId: null,
      facebookPostedAt: null,
    };
  }

  private withCaption: Prisma.PostWhereInput = {
    AND: [{ facebookCaption: { not: null } }, { facebookCaption: { not: '' } }],
  };

  async status(): Promise<FacebookQueueStatus> {
    const row = await this.getRow();
    const eligible = this.eligibleWhere(row.onlyNews);
    const postTimes = FacebookQueueService.parseTimes(row.postTimes);
    const [pendingCount, missingCaptionCount, next] = await Promise.all([
      this.prisma.post.count({ where: { ...eligible, ...this.withCaption } }),
      this.prisma.post.count({ where: { ...eligible, NOT: this.withCaption } }),
      this.nextPost(row.onlyNews),
    ]);
    return {
      enabled: row.enabled,
      postTimes,
      postsPerDay: postTimes.length,
      onlyNews: row.onlyNews,
      pendingCount,
      missingCaptionCount,
      nextPostTitle: next?.title ?? null,
      nextSlot: this.nextSlot(postTimes),
      lastRunAt: row.lastRunAt,
      lastError: row.lastError,
    };
  }

  private nextPost(onlyNews: boolean) {
    return this.prisma.post.findFirst({
      where: { ...this.eligibleWhere(onlyNews), ...this.withCaption },
      orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, slug: true, type: true, title: true, summary: true, facebookCaption: true },
    });
  }

  /** Đăng bài kế tiếp trong hàng chờ ngay lập tức (không phụ thuộc bật/tắt hay khung giờ). */
  async runNow(): Promise<{ posted: boolean; title: string | null; error: string | null }> {
    const row = await this.getRow();
    return this.postNext(row.onlyNews);
  }

  private async postNext(onlyNews: boolean) {
    const post = await this.nextPost(onlyNews);
    if (!post) {
      await this.record(null);
      return { posted: false, title: null, error: null };
    }
    try {
      await this.facebook.postNow(post);
      await this.record(null);
      this.logger.log(`Hàng chờ Facebook: đã đăng "${post.slug}"`);
      return { posted: true, title: post.title, error: null };
    } catch (err) {
      const message = (err as Error).message;
      await this.record(`${post.slug}: ${message}`);
      this.logger.warn(`Hàng chờ Facebook: đăng "${post.slug}" thất bại: ${message}`);
      return { posted: false, title: post.title, error: message };
    }
  }

  private record(error: string | null) {
    return this.prisma.facebookQueueSetting.update({
      where: { id: SETTING_ID },
      data: { lastRunAt: new Date(), lastError: error },
    });
  }

  /** Giờ Việt Nam hiện tại: ngày "YYYY-MM-DD" và số phút trong ngày. */
  private vnNow(now = new Date()): { date: string; minutes: number } {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
        .formatToParts(now)
        .map((p) => [p.type, p.value]),
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
  }

  private toMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private nextSlot(times: string[]): string | null {
    if (times.length === 0) return null;
    const { date, minutes } = this.vnNow();
    const later = times.find((t) => this.toMinutes(t) > minutes);
    if (later) return `${date} ${later}`;
    const tomorrow = new Date(Date.now() + 24 * 3600_000);
    return `${this.vnNow(tomorrow).date} ${times[0]}`;
  }

  /** Chạy mỗi phút: nếu có khung giờ vừa đến thì đăng 1 bài. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const row = await this.getRow();
      if (!row.enabled) return;
      const { date, minutes } = this.vnNow();
      const due = FacebookQueueService.parseTimes(row.postTimes)
        .filter((t) => TIME_RE.test(t))
        .filter((t) => {
          const diff = minutes - this.toMinutes(t);
          return diff >= 0 && diff <= CATCH_UP_MINUTES;
        })
        .pop();
      if (!due) return;
      const slot = `${date} ${due}`;
      if (row.lastSlot && row.lastSlot >= slot) return;

      // Giành khung giờ nguyên tử để nhiều instance không đăng trùng.
      const claimed = await this.prisma.facebookQueueSetting.updateMany({
        where: { id: SETTING_ID, OR: [{ lastSlot: null }, { lastSlot: { lt: slot } }] },
        data: { lastSlot: slot },
      });
      if (claimed.count === 0) return;
      await this.postNext(row.onlyNews);
    } catch (err) {
      this.logger.error(`Hàng chờ Facebook lỗi: ${(err as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
