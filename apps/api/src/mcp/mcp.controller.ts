import { Controller, Delete, Get, Logger, Post, Req, Res } from '@nestjs/common';
import { Public } from '../common/decorators';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ApiTokensService, hashIp } from './api-tokens.service';
import { McpRateLimitService } from './mcp-rate-limit.service';
import { McpServerFactory } from './mcp-server.factory';
import { mcpConfig } from './mcp.config';
import { McpScope } from '@phuochai/shared';

/** Lấy Bearer token từ header Authorization. */
function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.trim().split(/\s+/, 2);
  if (!scheme || !value || scheme.toLowerCase() !== 'bearer') return undefined;
  return value;
}

/**
 * MCP server (Model Context Protocol) cho AI agent tạo nội dung.
 *
 *   POST   /mcp   : endpoint Streamable HTTP (stateless)
 *   GET    /mcp   : 405 (không dùng SSE stream thường trực)
 *   DELETE /mcp   : 405 (stateless, không có session để xoá)
 *   GET    /.well-known/oauth-protected-resource : metadata theo RFC 9728
 *
 * Xác thực: `Authorization: Bearer phca_<id>_<secret>`.
 * Giai đoạn 1 dùng personal access token; OAuth 2.1 sẽ bổ sung ở Phase 3.
 */
@Controller()
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly tokens: ApiTokensService,
    private readonly rateLimit: McpRateLimitService,
    private readonly serverFactory: McpServerFactory,
  ) {}

  @Public()
  @Post('mcp')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!mcpConfig.enabled) {
      res.status(404).json({ error: 'MCP server đang tắt (MCP_ENABLED=false)' });
      return;
    }

    const { auth, reason } = await this.tokens.verify(extractBearer(req.headers.authorization));
    if (!auth) {
      this.unauthorized(res, reason ?? 'Cần token hợp lệ');
      return;
    }

    auth.ipHash = hashIp(req.ip);
    auth.userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    const limit = this.rateLimit.hit(auth.tokenId);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      res.status(429).json({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32002, message: `Vượt giới hạn ${mcpConfig.rateLimitPerMin} request/phút. Thử lại sau.` },
      });
      return;
    }

    const server = this.serverFactory.create(auth);
    const transport = new StreamableHTTPServerTransport({
      // Stateless: mỗi request độc lập, không lưu session trong RAM
      sessionIdGenerator: undefined,
      // Trả JSON thay vì SSE: đơn giản cho agent và dễ kiểm thử
      enableJsonResponse: true,
      // Chống DNS rebinding: chỉ nhận Host/Origin đã cấu hình
      enableDnsRebindingProtection: true,
      allowedHosts: [...mcpConfig.hosts],
      allowedOrigins: [...mcpConfig.origins],
    });

    res.on('close', () => {
      void transport.close().catch(() => undefined);
      void server.close().catch(() => undefined);
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      this.logger.error(`MCP request lỗi: ${message}`);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Lỗi MCP server' } });
      }
    }
  }

  @Public()
  @Get('mcp')
  methodNotAllowed(@Res() res: Response): void {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'MCP server chạy stateless: chỉ hỗ trợ POST /mcp' },
    });
  }

  @Public()
  @Delete('mcp')
  deleteNotAllowed(@Res() res: Response): void {
    res.setHeader('Allow', 'POST');
    res.status(405).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'MCP server chạy stateless: không có session để xoá' },
    });
  }

  /** Metadata theo RFC 9728 (Protected Resource Metadata). */
  @Public()
  @Get('.well-known/oauth-protected-resource')
  resourceMetadata(): Record<string, unknown> {
    return this.buildResourceMetadata();
  }

  @Public()
  @Get('.well-known/oauth-protected-resource/mcp')
  resourceMetadataForMcp(): Record<string, unknown> {
    return this.buildResourceMetadata();
  }

  /** Trả 401 kèm WWW-Authenticate để client biết nơi lấy metadata và scope cần có. */
  private unauthorized(res: Response, reason: string): void {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${mcpConfig.resourceMetadataUrl}", scope="${Object.values(McpScope).join(' ')}"`,
    );
    res.status(401).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32001, message: `Unauthorized: ${reason}` },
    });
  }

  private buildResourceMetadata(): Record<string, unknown> {
    return {
      resource: mcpConfig.publicUrl,
      resource_documentation: `${mcpConfig.publicUrl}/mcp`,
      bearer_methods_supported: ['header'],
      scopes_supported: Object.values(McpScope),
      // Phase 3 mới có OAuth authorization server; giai đoạn này dùng personal access token.
      authorization_servers: [],
    };
  }
}
