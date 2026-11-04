import { Injectable, Logger } from '@nestjs/common';
import { NotificationSeverity } from '@phuochai/shared';

interface TelegramMessageInput {
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  severity?: NotificationSeverity | null;
}

const SEVERITY_ICON: Record<NotificationSeverity, string> = {
  [NotificationSeverity.INFO]: '🔔',
  [NotificationSeverity.WARNING]: '⚠️',
  [NotificationSeverity.URGENT]: '🚨',
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

/**
 * Gửi thông báo quản trị qua Telegram Bot API.
 *
 * Cấu hình:
 *   TELEGRAM_BOT_TOKEN=123:abc
 *   TELEGRAM_CHAT_ID=123456789
 *   ADMIN_BASE_URL=https://langchaiphuochai.com
 *
 * Có thể truyền nhiều chat id, phân tách bằng dấu phẩy. Nếu thiếu cấu hình,
 * service bỏ qua và chỉ giữ thông báo in-app.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  async sendAdminMessage(input: TelegramMessageInput): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatIds = (process.env.TELEGRAM_CHAT_ID ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!token || chatIds.length === 0) return;

    const baseUrl = (process.env.ADMIN_BASE_URL ?? 'https://langchaiphuochai.com').replace(/\/+$/, '');
    const link =
      input.actionUrl && input.actionUrl.startsWith('/') ? `${baseUrl}${input.actionUrl}` : null;
    const icon = SEVERITY_ICON[input.severity ?? NotificationSeverity.INFO] ?? '🔔';
    const body = input.body?.trim().slice(0, 1200);

    const text = [
      `<b>${icon} ${escapeHtml(input.title)}</b>`,
      body ? escapeHtml(body) : null,
      link ? `<a href="${escapeAttribute(link)}">Mở trang quản trị</a>` : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    await Promise.all(
      chatIds.map(async (chatId) => {
        try {
          const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            }),
            signal: AbortSignal.timeout(5_000),
          });

          if (!response.ok) {
            const detail = (await response.text()).slice(0, 300);
            this.logger.warn(`Telegram trả lỗi ${response.status}: ${detail}`);
          }
        } catch (error) {
          this.logger.warn(`Không gửi được Telegram: ${(error as Error).message}`);
        }
      }),
    );
  }
}
