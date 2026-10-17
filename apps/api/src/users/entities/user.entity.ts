import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Role } from '@phuochai/shared';

/** Người dùng trả về qua GraphQL (không bao giờ chứa passwordHash). */
@ObjectType('User')
export class UserEntity {
  @Field()
  id!: string;

  @Field()
  email!: string;

  @Field()
  name!: string;

  @Field(() => Role)
  role!: Role;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field(() => String, { nullable: true })
  bio?: string | null;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Field()
  isActive!: boolean;

  @Field(() => Date, { nullable: true })
  lastLoginAt?: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  /** Số bài viết của người dùng (chỉ tính khi được yêu cầu). */
  @Field(() => Int, { nullable: true })
  postCount?: number;
}

@ObjectType('PaginatedUsers')
export class PaginatedUsers {
  @Field(() => [UserEntity])
  items!: UserEntity[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}

@ObjectType('AuthPayload')
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field(() => UserEntity)
  user!: UserEntity;
}
