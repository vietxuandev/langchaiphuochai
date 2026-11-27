import { Module } from '@nestjs/common';
import { InsightsService } from './insights.service';
import { StatsResolver } from './stats.resolver';
import { StatsService } from './stats.service';

@Module({
  providers: [StatsService, InsightsService, StatsResolver],
})
export class StatsModule {}
