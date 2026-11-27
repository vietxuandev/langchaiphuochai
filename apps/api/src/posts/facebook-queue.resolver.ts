import { BadRequestException } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Role } from '@phuochai/shared';
import { Roles } from '../common/decorators';
import { FacebookQueueRunResultEntity, FacebookQueueStatusEntity } from './entities/facebook-queue.entity';
import { FacebookQueueService } from './facebook-queue.service';

@Resolver()
export class FacebookQueueResolver {
  constructor(private readonly queue: FacebookQueueService) {}

  @Roles(Role.ADMIN)
  @Query(() => FacebookQueueStatusEntity, { description: 'Trạng thái hàng chờ tự đăng Facebook (admin)' })
  facebookQueue(): Promise<FacebookQueueStatusEntity> {
    return this.queue.status();
  }

  @Roles(Role.ADMIN)
  @Mutation(() => FacebookQueueStatusEntity, { description: 'Cập nhật cấu hình hàng chờ tự đăng Facebook (admin)' })
  async updateFacebookQueue(
    @Args('enabled', { type: () => Boolean, nullable: true }) enabled?: boolean,
    @Args('postTimes', { type: () => [String], nullable: true }) postTimes?: string[],
    @Args('onlyNews', { type: () => Boolean, nullable: true }) onlyNews?: boolean,
  ): Promise<FacebookQueueStatusEntity> {
    try {
      return await this.queue.updateConfig({
        enabled: enabled ?? undefined,
        postTimes: postTimes ?? undefined,
        onlyNews: onlyNews ?? undefined,
      });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Roles(Role.ADMIN)
  @Mutation(() => FacebookQueueRunResultEntity, { description: 'Đăng ngay bài kế tiếp trong hàng chờ (admin)' })
  runFacebookQueueNow(): Promise<FacebookQueueRunResultEntity> {
    return this.queue.runNow();
  }
}
