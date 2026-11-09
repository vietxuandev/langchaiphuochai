import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { McpScope } from '@phuochai/shared';
import { Role } from '@phuochai/shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ApiTokensService } from './api-tokens.service';
import { CreateAgentTokenInputType } from './dto/agent-token.inputs';
import { AgentTokenCreatedEntity, AgentTokenEntity } from './entities/agent-token.entity';
import type { UserEntity } from '../users/entities/user.entity';

/** Quản lý token cho AI agent (chỉ ADMIN). */
@Resolver(() => AgentTokenEntity)
export class AgentTokensResolver {
  constructor(private readonly tokens: ApiTokensService) {}

  @Roles(Role.ADMIN)
  @Query(() => [AgentTokenEntity], { description: 'Danh sách token MCP đã cấp cho agent' })
  async agentTokens(): Promise<AgentTokenEntity[]> {
    return (await this.tokens.list()) as unknown as AgentTokenEntity[];
  }

  @Roles(Role.ADMIN)
  @Mutation(() => AgentTokenCreatedEntity, {
    description: 'Tạo token MCP mới (token gốc chỉ trả về một lần)',
  })
  async createAgentToken(
    @Args('input', { type: () => CreateAgentTokenInputType }) input: CreateAgentTokenInputType,
    @CurrentUser() user: UserEntity,
  ): Promise<AgentTokenCreatedEntity> {
    const created = await this.tokens.create({
      userId: user.id,
      name: input.name,
      agentName: input.agentName ?? null,
      scopes: (input.scopes ?? []) as McpScope[],
      expiresInDays: input.expiresInDays ?? null,
    });
    return created as unknown as AgentTokenCreatedEntity;
  }

  @Roles(Role.ADMIN)
  @Mutation(() => Boolean, { description: 'Thu hồi token MCP (hiệu lực ngay)' })
  async revokeAgentToken(@Args('id', { type: () => String }) id: string): Promise<boolean> {
    return this.tokens.revoke(id);
  }
}
