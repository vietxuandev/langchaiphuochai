import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Role, UserStatus } from '@phuochai/shared';

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

  @Field(() => UserStatus, { description: 'PENDING = chờ duyệt, ACTIVE = đang hoạt động, REJECTED = bị từ chối' })
  status!: UserStatus;

  @Field(() => Date, { nullable: true, description: 'Thời điểm quản trị viên duyệt tài khoản' })
  approvedAt?: Date | null;

  @Field(() => String, { nullable: true, description: 'Lý do từ chối (nếu có)' })
  reviewNote?: string | null;

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

/** Kết quả đăng ký: tài khoản mới chờ quản trị viên duyệt (không trả token). */
@ObjectType('RegisterResult')
export class RegisterResult {
  @Field(() => UserEntity)
  user!: UserEntity;

  @Field({ description: 'true = tài khoản đang chờ duyệt, chưa đăng nhập được' })
  requiresApproval!: boolean;

  @Field({ description: 'Thông báo hiển thị cho người đăng ký' })
  message!: string;
}
