import { Field, InputType, Int } from '@nestjs/graphql';

@InputType('CreateAgentTokenInput')
export class CreateAgentTokenInputType {
  @Field(() => String, { description: 'Tên gợi nhớ, ví dụ "Claude Code - laptop"' })
  name!: string;

  @Field(() => String, { nullable: true, description: 'Tên agent/client để ghi vào bài viết' })
  agentName?: string;

  @Field(() => [String], {
    description: 'Quyền: posts:read, posts:write, posts:publish, media:write',
  })
  scopes!: string[];

  @Field(() => Int, { nullable: true, description: 'Số ngày hiệu lực; bỏ trống = không hết hạn' })
  expiresInDays?: number;
}
