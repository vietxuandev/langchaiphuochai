import { BadRequestException } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Role, UserStatus } from '@phuochai/shared';
import type { AdminCreateUserInput, UpdateUserInput } from '@phuochai/shared';
import { adminCreateUserSchema, updateUserSchema } from '@phuochai/shared';
import { CurrentUser, Roles } from '../common/decorators';
import { zodPipe } from '../common/zod.pipe';
import { AdminCreateUserInputType, UpdateUserInputType } from '../auth/dto/auth.inputs';
import { PaginatedUsers, UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

@Resolver(() => UserEntity)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Query(() => PaginatedUsers, { description: 'Danh sách người dùng (quản trị viên)' })
  async users(
    @Args('keyword', { type: () => String, nullable: true }) keyword?: string,
    @Args('role', { type: () => Role, nullable: true }) role?: Role,
    @Args('isActive', { type: () => Boolean, nullable: true }) isActive?: boolean,
    @Args('status', { type: () => UserStatus, nullable: true, description: 'Lọc theo trạng thái duyệt' })
    status?: UserStatus,
    @Args('page', { type: () => Int, nullable: true, defaultValue: 1 }) page = 1,
    @Args('pageSize', { type: () => Int, nullable: true, defaultValue: 20 }) pageSize = 20,
  ): Promise<PaginatedUsers> {
    return this.usersService.list({ keyword, role, isActive, status, page, pageSize });
  }

  @Roles(Role.ADMIN)
  @Query(() => Int, { description: 'Số tài khoản đang chờ duyệt' })
  async pendingUserCount(): Promise<number> {
    return this.usersService.countPending();
  }

  @Roles(Role.ADMIN)
  @Mutation(() => UserEntity, { description: 'Duyệt tài khoản đăng ký mới (có thể cấp vai trò)' })
  async approveUser(
    @Args('id', { type: () => String }) id: string,
    @Args('role', { type: () => Role, nullable: true, description: 'Vai trò cấp khi duyệt' }) role?: Role,
  ): Promise<UserEntity> {
    return (await this.usersService.approve(id, role)) as UserEntity;
  }

  @Roles(Role.ADMIN)
  @Mutation(() => Boolean, { description: 'Xoá tài khoản (từ chối/chờ duyệt, không có bài viết)' })
  async removeUser(@Args('id', { type: () => String }) id: string): Promise<boolean> {
    return this.usersService.remove(id);
  }

  @Roles(Role.ADMIN)
  @Mutation(() => UserEntity, { description: 'Từ chối tài khoản đăng ký mới' })
  async rejectUser(
    @Args('id', { type: () => String }) id: string,
    @Args('note', { type: () => String, nullable: true, description: 'Lý do từ chối' }) note?: string,
  ): Promise<UserEntity> {
    return (await this.usersService.reject(id, note)) as UserEntity;
  }

  @Roles(Role.ADMIN)
  @Query(() => UserEntity, { description: 'Chi tiết người dùng (quản trị viên)' })
  async user(@Args('id', { type: () => String }) id: string): Promise<UserEntity> {
    return (await this.usersService.getPublicById(id)) as UserEntity;
  }

  @Roles(Role.ADMIN)
  @Mutation(() => UserEntity, { description: 'Tạo người dùng mới (quản trị viên)' })
  async createUser(
    @Args('input', { type: () => AdminCreateUserInputType }, zodPipe(adminCreateUserSchema))
    input: AdminCreateUserInput,
  ): Promise<UserEntity> {
    return (await this.usersService.create(input)) as UserEntity;
  }

  @Roles(Role.ADMIN)
  @Mutation(() => UserEntity, { description: 'Cập nhật vai trò / trạng thái người dùng' })
  async updateUser(
    @CurrentUser() current: UserEntity,
    @Args('input', { type: () => UpdateUserInputType }, zodPipe(updateUserSchema))
    input: UpdateUserInput,
  ): Promise<UserEntity> {
    if (current.id === input.id && input.role && input.role !== current.role) {
      throw new BadRequestException('Bạn không thể tự thay đổi vai trò của chính mình');
    }
    return (await this.usersService.update(input.id, input)) as UserEntity;
  }

  @Roles(Role.ADMIN)
  @Mutation(() => UserEntity, { description: 'Vô hiệu hoá người dùng' })
  async deactivateUser(
    @CurrentUser() current: UserEntity,
    @Args('id', { type: () => String }) id: string,
  ): Promise<UserEntity> {
    if (current.id === id) throw new BadRequestException('Bạn không thể tự vô hiệu hoá tài khoản của mình');
    return (await this.usersService.deactivate(id)) as UserEntity;
  }
}
