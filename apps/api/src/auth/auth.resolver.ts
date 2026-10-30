import { BadRequestException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { zodPipe } from '../common/zod.pipe';
import { CurrentUser, Public } from '../common/decorators';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from '@phuochai/shared';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from '@phuochai/shared';
import { AuthPayload, RegisterResult, UserEntity } from '../users/entities/user.entity';
import {
  ChangePasswordInputType,
  LoginInputType,
  RegisterInputType,
  UpdateProfileInputType,
} from './dto/auth.inputs';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

@Resolver(() => UserEntity)
export class AuthResolver {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @Mutation(() => AuthPayload, { description: 'Đăng nhập bằng email và mật khẩu' })
  async login(@Args('input', { type: () => LoginInputType }, zodPipe(loginSchema)) input: LoginInput): Promise<AuthPayload> {
    return this.auth.login(input);
  }

  @Public()
  @Mutation(() => RegisterResult, {
    description: 'Đăng ký tài khoản mới - tài khoản ở trạng thái chờ quản trị viên duyệt',
  })
  async register(
    @Args('input', { type: () => RegisterInputType }, zodPipe(registerSchema)) input: RegisterInput,
  ): Promise<RegisterResult> {
    return this.auth.register(input);
  }

  @Query(() => UserEntity, { nullable: true, description: 'Thông tin người dùng đang đăng nhập' })
  async me(@CurrentUser() user: UserEntity | null): Promise<UserEntity | null> {
    if (!user) return null;
    return this.auth.me(user.id);
  }

  @Mutation(() => UserEntity, { description: 'Cập nhật hồ sơ cá nhân' })
  async updateProfile(
    @CurrentUser() user: UserEntity,
    @Args('input', { type: () => UpdateProfileInputType }, zodPipe(updateProfileSchema))
    input: UpdateProfileInput,
  ): Promise<UserEntity> {
    const updated = await this.users.updateProfile(user.id, {
      name: input.name,
      avatarUrl: input.avatarUrl,
      bio: input.bio,
      phone: input.phone,
    });
    return updated as UserEntity;
  }

  @Mutation(() => Boolean, { description: 'Đổi mật khẩu' })
  async changePassword(
    @CurrentUser() user: UserEntity,
    @Args('input', { type: () => ChangePasswordInputType }, zodPipe(changePasswordSchema))
    input: ChangePasswordInput,
  ): Promise<boolean> {
    const ok = await this.users.changePassword(user.id, input.currentPassword, input.newPassword);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng');
    return true;
  }
}
