import { Module } from '@nestjs/common';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { PostsModule } from '../posts/posts.module';
import { AgentTokensResolver } from './agent-tokens.resolver';
import { ApiTokensService } from './api-tokens.service';
import { McpAuditService } from './mcp-audit.service';
import { McpController } from './mcp.controller';
import { McpRateLimitService } from './mcp-rate-limit.service';
import { McpServerFactory } from './mcp-server.factory';
import { McpToolsService } from './mcp-tools.service';

/**
 * MCP server + quản lý token cho AI agent.
 *
 * Phase 1 + quản lý bài: personal access token, 11 tool (whoami, list_categories,
 * list_wards, search_posts, get_post, create_post, update_post, set_post_status,
 * list_affiliate_links, validate_affiliate_links, delete_post), audit log, rate limit, idempotency.
 */
@Module({
  imports: [PostsModule, AffiliateModule],
  controllers: [McpController],
  providers: [
    ApiTokensService,
    McpAuditService,
    McpRateLimitService,
    McpToolsService,
    McpServerFactory,
    AgentTokensResolver,
  ],
  exports: [ApiTokensService],
})
export class McpModule {}
