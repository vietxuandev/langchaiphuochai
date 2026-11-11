import { Injectable, Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { PostStatus, PostType } from '@phuochai/shared';
import { z } from 'zod';
import type { McpAuthContext } from './api-tokens.service';
import { McpAuditService } from './mcp-audit.service';
import { McpToolsService, McpToolError } from './mcp-tools.service';
import { mcpConfig } from './mcp.config';

/** Hướng dẫn cho agent ngay khi kết nối (hiển thị trong client). */
const INSTRUCTIONS = `MCP server của website Làng Chài Phước Hải (du lịch, lưu trú, bất động sản).

Quy trình viết bài:
1. Gọi list_categories để chọn đúng categorySlug, list_wards để chọn đúng xã/phường.
2. Gọi search_posts để chắc chắn bài chưa tồn tại.
3. Gọi create_post với contentMarkdown. Nội dung sẽ được chuyển sang HTML và lưu ở trạng thái BẢN NHÁP.
4. Dùng update_post để sửa bài còn ở trạng thái nháp.
5. Chỉ dùng set_post_status khi người quản trị yêu cầu rõ ràng việc xuất bản, thu hồi hoặc lưu trữ.
6. Chỉ ADMIN được dùng delete_post; mặc định ưu tiên ARCHIVED thay vì xoá vĩnh viễn.

Quy ước nội dung:
- Viết tiếng Việt, giọng gần gũi, không bịa số liệu/giá nếu không có nguồn.
- Dùng gạch nối "-", không dùng gạch dài.
- Địa chỉ theo xã/phường (TP. Hồ Chí Minh), không dùng quận/huyện.
- Ảnh: nhờ người quản trị thêm trong trang quản trị.
- Gọi create_post kèm idempotencyKey để retry an toàn.`;

const POST_TYPE_VALUES = [PostType.ACCOMMODATION, PostType.NEWS, PostType.REAL_ESTATE, PostType.PAGE] as const;
const POST_STATUS_VALUES = [PostStatus.DRAFT, PostStatus.PUBLISHED, PostStatus.ARCHIVED] as const;

/**
 * Kiểu đăng ký tool rút gọn.
 *
 * SDK định nghĩa generic rất sâu cho `registerTool` (ZodRawShapeCompat -> ShapeOutput),
 * gây lỗi "Type instantiation is excessively deep" với zod 3.25. Ta giữ nguyên hành vi
 * runtime (SDK vẫn validate bằng zod và sinh JSON Schema) nhưng ép kiểu ở biên.
 */
type RegisterTool = (
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: z.ZodRawShape;
    annotations?: Record<string, unknown>;
  },
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>,
) => unknown;

@Injectable()
export class McpServerFactory {
  private readonly logger = new Logger(McpServerFactory.name);

  constructor(
    private readonly tools: McpToolsService,
    private readonly audit: McpAuditService,
  ) {}

  /**
   * Tạo MCP server cho một request (stateless): mỗi lần gọi có auth context riêng
   * nên tool biết token/người dùng nào đang thao tác.
   */
  create(auth: McpAuthContext): McpServer {
    const server = new McpServer({ name: 'langchaiphuochai-mcp', version: '1.1.0' }, { instructions: INSTRUCTIONS });
    const register = server.registerTool.bind(server) as unknown as RegisterTool;

    const run = async <T>(
      tool: string,
      args: unknown,
      scope: string | null,
      fn: () => Promise<T>,
      postId?: (result: T) => string | null,
    ): Promise<CallToolResult> => {
      const started = Date.now();

      if (scope && !auth.scopes.includes(scope)) {
        const message = `Token thiếu quyền "${scope}" cho tool ${tool}.`;
        await this.audit.write({
          auth,
          tool,
          status: 'denied',
          errorCode: 'FORBIDDEN',
          durationMs: Date.now() - started,
          args,
        });
        return this.error(message, 'FORBIDDEN');
      }

      try {
        const result = await fn();
        await this.audit.write({
          auth,
          tool,
          status: 'ok',
          durationMs: Date.now() - started,
          args,
          postId: postId?.(result) ?? null,
        });
        return this.ok(result);
      } catch (error) {
        const code = error instanceof McpToolError ? error.code : 'ERROR';
        const message = error instanceof Error ? error.message : 'Lỗi không xác định';
        this.logger.warn(`MCP ${tool} lỗi (${code}): ${message.slice(0, 200)}`);
        await this.audit.write({
          auth,
          tool,
          status: 'error',
          errorCode: code,
          durationMs: Date.now() - started,
          args,
        });
        return this.error(message, code);
      }
    };

    register(
      'whoami',
      {
        title: 'Thông tin token và giới hạn',
        description:
          'Cho biết tài khoản, scope của token, giới hạn (số bài/ngày, số request/phút) và quy trình viết bài.',
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      () => run('whoami', {}, null, () => this.tools.whoami(auth)),
    );

    register(
      'list_categories',
      {
        title: 'Danh sách danh mục',
        description: 'Trả về danh mục (slug, tên, loại nội dung, số bài) để chọn categorySlug khi tạo bài.',
        inputSchema: { section: z.enum(POST_TYPE_VALUES).optional().describe('Lọc theo loại nội dung') },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        run('list_categories', args, 'posts:read', () =>
          this.tools.listCategories({ section: (args.section as PostType | undefined) ?? null }),
        ),
    );

    register(
      'list_wards',
      {
        title: 'Danh sách xã/phường',
        description: '168 xã/phường của TP. Hồ Chí Minh. Dùng để truyền đúng tham số ward khi tạo bài.',
        inputSchema: { query: z.string().max(60).optional().describe('Từ khoá tìm nhanh (không dấu cũng được)') },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        run('list_wards', args, 'posts:read', () =>
          this.tools.listWards({ query: typeof args.query === 'string' ? args.query : null }),
        ),
    );

    register(
      'search_posts',
      {
        title: 'Tìm bài viết đã có',
        description: 'Tìm bài theo từ khoá/loại/trạng thái. BẮT BUỘC gọi trước khi tạo bài để tránh trùng nội dung.',
        inputSchema: {
          keyword: z.string().max(200).optional(),
          type: z.enum(POST_TYPE_VALUES).optional(),
          status: z.enum(POST_STATUS_VALUES).optional(),
          limit: z.number().int().min(1).max(30).optional(),
        },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        run('search_posts', args, 'posts:read', () =>
          this.tools.searchPosts({
            keyword: typeof args.keyword === 'string' ? args.keyword : null,
            type: (args.type as PostType | undefined) ?? null,
            status: (args.status as PostStatus | undefined) ?? null,
            limit: typeof args.limit === 'number' ? args.limit : null,
          }),
        ),
    );

    register(
      'get_post',
      {
        title: 'Chi tiết bài viết',
        description: 'Đọc một bài theo id hoặc slug (nội dung HTML, danh mục, tag, ảnh).',
        inputSchema: { id: z.string().max(40).optional(), slug: z.string().max(300).optional() },
        annotations: { readOnlyHint: true },
      },
      (args) =>
        run('get_post', args, 'posts:read', () =>
          this.tools.getPost({
            id: typeof args.id === 'string' ? args.id : null,
            slug: typeof args.slug === 'string' ? args.slug : null,
          }),
        ),
    );

    register(
      'create_post',
      {
        title: 'Tạo bài viết (bản nháp)',
        description:
          'Tạo bài mới ở trạng thái BẢN NHÁP. Nội dung nhận Markdown (khuyến nghị) hoặc HTML đã sạch. ' +
          'Danh mục phải tồn tại, xã/phường phải thuộc 168 đơn vị TP.HCM. Truyền idempotencyKey để retry an toàn.',
        inputSchema: {
          type: z.enum(POST_TYPE_VALUES).describe('Loại nội dung'),
          title: z.string().min(5).max(300),
          slug: z.string().max(300).optional().describe('Bỏ trống để tự sinh từ tiêu đề'),
          summary: z.string().max(1000).optional().describe('Mô tả ngắn (SEO description)'),
          contentMarkdown: z.string().max(200_000).optional().describe('Nội dung Markdown (khuyến nghị)'),
          contentHtml: z.string().max(200_000).optional().describe('Nội dung HTML (sẽ được sanitize)'),
          categorySlug: z.string().max(160).describe('Slug danh mục, lấy từ list_categories'),
          tags: z.array(z.string().min(1).max(80)).max(20).optional(),
          ward: z.string().max(120).optional().describe('Xã/phường, lấy từ list_wards'),
          addressRaw: z.string().max(300).optional().describe('Địa chỉ chi tiết (số nhà, đường)'),
          priceRaw: z.string().max(120).optional().describe('Giá hiển thị, ví dụ "320.000đ"'),
          areaText: z.string().max(80).optional().describe('Diện tích hiển thị, ví dụ "25 m²"'),
          bedrooms: z.number().int().min(0).max(50).optional(),
          bathrooms: z.number().int().min(0).max(50).optional(),
          seoTitle: z.string().max(300).optional(),
          idempotencyKey: z.string().min(4).max(120).optional().describe('Khoá chống tạo trùng khi retry'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      },
      (args) =>
        run(
          'create_post',
          args,
          'posts:write',
          () =>
            this.tools.createPost(auth, {
              type: args.type as PostType,
              title: String(args.title ?? ''),
              slug: (args.slug as string | undefined) ?? null,
              summary: (args.summary as string | undefined) ?? null,
              contentMarkdown: (args.contentMarkdown as string | undefined) ?? null,
              contentHtml: (args.contentHtml as string | undefined) ?? null,
              categorySlug: String(args.categorySlug ?? ''),
              tags: Array.isArray(args.tags) ? (args.tags as string[]) : [],
              ward: (args.ward as string | undefined) ?? null,
              addressRaw: (args.addressRaw as string | undefined) ?? null,
              priceRaw: (args.priceRaw as string | undefined) ?? null,
              areaText: (args.areaText as string | undefined) ?? null,
              bedrooms: typeof args.bedrooms === 'number' ? args.bedrooms : null,
              bathrooms: typeof args.bathrooms === 'number' ? args.bathrooms : null,
              seoTitle: (args.seoTitle as string | undefined) ?? null,
              idempotencyKey: (args.idempotencyKey as string | undefined) ?? null,
            }),
          (result) => result.id,
        ),
    );

    register(
      'update_post',
      {
        title: 'Cập nhật bài nháp',
        description:
          'Cập nhật bài đang ở trạng thái DRAFT. Truyền id hoặc slug để chọn bài; chỉ các trường được gửi mới thay đổi. ' +
          'Không dùng tool này để đổi trạng thái, dùng set_post_status.',
        inputSchema: {
          id: z.string().max(40).optional(),
          slug: z.string().max(300).optional().describe('Slug hiện tại của bài'),
          newSlug: z.string().max(300).optional().describe('Slug mới nếu muốn đổi URL'),
          title: z.string().min(5).max(300).optional(),
          summary: z.string().max(1000).optional(),
          contentMarkdown: z.string().max(200_000).optional(),
          contentHtml: z.string().max(200_000).optional(),
          categorySlug: z.string().max(160).optional(),
          tags: z.array(z.string().min(1).max(80)).max(20).optional(),
          ward: z.string().max(120).optional(),
          addressRaw: z.string().max(300).optional(),
          priceRaw: z.string().max(120).optional(),
          areaText: z.string().max(80).optional(),
          bedrooms: z.number().int().min(0).max(50).optional(),
          bathrooms: z.number().int().min(0).max(50).optional(),
          seoTitle: z.string().max(300).optional(),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      },
      (args) =>
        run(
          'update_post',
          args,
          'posts:write',
          () =>
            this.tools.updatePost(auth, {
              id: (args.id as string | undefined) ?? null,
              slug: (args.slug as string | undefined) ?? null,
              newSlug: (args.newSlug as string | undefined) ?? null,
              title: (args.title as string | undefined) ?? null,
              summary: (args.summary as string | undefined) ?? null,
              contentMarkdown: (args.contentMarkdown as string | undefined) ?? null,
              contentHtml: (args.contentHtml as string | undefined) ?? null,
              categorySlug: (args.categorySlug as string | undefined) ?? null,
              tags: Array.isArray(args.tags) ? (args.tags as string[]) : null,
              ward: (args.ward as string | undefined) ?? null,
              addressRaw: (args.addressRaw as string | undefined) ?? null,
              priceRaw: (args.priceRaw as string | undefined) ?? null,
              areaText: (args.areaText as string | undefined) ?? null,
              bedrooms: typeof args.bedrooms === 'number' ? args.bedrooms : null,
              bathrooms: typeof args.bathrooms === 'number' ? args.bathrooms : null,
              seoTitle: (args.seoTitle as string | undefined) ?? null,
            }),
          (result) => result.id,
        ),
    );

    register(
      'set_post_status',
      {
        title: 'Đổi trạng thái bài viết',
        description:
          'Xuất bản (PUBLISHED), thu hồi về nháp (DRAFT) hoặc lưu trữ (ARCHIVED). ' +
          'Cần scope posts:publish; dùng khi người quản trị yêu cầu rõ ràng.',
        inputSchema: {
          id: z.string().max(40).optional(),
          slug: z.string().max(300).optional(),
          status: z.enum(POST_STATUS_VALUES).describe('PUBLISHED, DRAFT hoặc ARCHIVED'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      (args) =>
        run(
          'set_post_status',
          args,
          'posts:publish',
          () =>
            this.tools.setPostStatus(auth, {
              id: (args.id as string | undefined) ?? null,
              slug: (args.slug as string | undefined) ?? null,
              status: args.status as PostStatus,
            }),
          (result) => result.id,
        ),
    );

    register(
      'delete_post',
      {
        title: 'Xoá bài viết',
        description:
          'Xoá VĨNH VIỄN một bài viết. Chỉ ADMIN. Bắt buộc truyền confirmSlug trùng đúng slug hiện tại để tránh xoá nhầm. ' +
          'Không thể hoàn tác; nếu chỉ muốn ẩn bài, dùng set_post_status với ARCHIVED.',
        inputSchema: {
          id: z.string().max(40).optional(),
          slug: z.string().max(300).optional(),
          confirmSlug: z.string().min(1).max(300).describe('Nhập đúng slug của bài cần xoá'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      },
      (args) =>
        run(
          'delete_post',
          args,
          'posts:write',
          () =>
            this.tools.deletePost(auth, {
              id: (args.id as string | undefined) ?? null,
              slug: (args.slug as string | undefined) ?? null,
              confirmSlug: String(args.confirmSlug ?? ''),
            }),
          (result) => result.id,
        ),
    );

    return server;
  }

  /** Trả kết quả dạng JSON text cho agent. */
  private ok(data: unknown): CallToolResult {
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  }

  /** Trả lỗi kèm mã để agent xử lý (isError = true theo spec). */
  private error(message: string, code: string): CallToolResult {
    return {
      isError: true,
      content: [{ type: 'text', text: JSON.stringify({ error: { code, message } }, null, 2) }],
    };
  }
}
