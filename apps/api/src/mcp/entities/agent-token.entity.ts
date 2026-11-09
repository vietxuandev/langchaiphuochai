import { Field, ObjectType } from '@nestjs/graphql';

/** Token cấp cho AI agent (không bao giờ trả token gốc ở đây). */
@ObjectType('AgentToken')
export class AgentTokenEntity {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  /** Phần hiển thị: phca_ab12cd34 */
  @Field(() => String)
  prefix!: string;

  @Field(() => [String], { description: 'Danh sách quyền, ví dụ posts:read' })
  scopes!: string[];

  @Field(() => String, { nullable: true })
  agentName?: string | null;

  @Field(() => Date, { nullable: true })
  expiresAt?: Date | null;

  @Field(() => Date, { nullable: true })
  lastUsedAt?: Date | null;

  @Field(() => Date, { nullable: true })
  revokedAt?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => String, { nullable: true })
  userEmail?: string | null;

  @Field(() => String, { nullable: true })
  userName?: string | null;

  /** ACTIVE | EXPIRED | REVOKED */
  @Field(() => String)
  status!: string;
}

/** Kết quả tạo token: token gốc chỉ xuất hiện đúng một lần. */
@ObjectType('AgentTokenCreated')
export class AgentTokenCreatedEntity {
  @Field(() => String, { description: 'Token gốc - chỉ hiển thị một lần, hãy lưu ngay' })
  token!: string;

  @Field(() => AgentTokenEntity)
  record!: AgentTokenEntity;
}
