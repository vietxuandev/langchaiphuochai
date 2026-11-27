import { Args, Query, Resolver } from '@nestjs/graphql';
import { Role } from '@phuochai/shared';
import { Public, Roles } from '../common/decorators';
import { DashboardStatsEntity, PublicStatsEntity } from './entities/stats.entity';
import { StatsService } from './stats.service';

@Resolver()
export class StatsResolver {
  constructor(private readonly stats: StatsService) {}

  @Public()
  @Query(() => PublicStatsEntity, { description: 'Thống kê công khai cho trang chủ' })
  async publicStats(): Promise<PublicStatsEntity> {
    return this.stats.publicStats();
  }

  @Roles(Role.EDITOR)
  @Query(() => DashboardStatsEntity, { description: 'Thống kê dashboard (editor/admin)' })
  async dashboardStats(): Promise<DashboardStatsEntity> {
    return this.stats.dashboard();
  }

  @Roles(Role.EDITOR)
  @Query(() => String, { description: 'Kiểm tra API đang chạy' })
  async apiHealth(): Promise<string> {
    return `ok - ${new Date().toISOString()}`;
  }

  @Public()
  @Query(() => String, { description: 'Kiểm tra API công khai' })
  async ping(@Args('echo', { type: () => String, nullable: true }) echo?: string): Promise<string> {
    return echo ? `pong: ${echo}` : 'pong';
  }
}
