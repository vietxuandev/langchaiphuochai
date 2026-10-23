import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators';

/**
 * Endpoint kiểm tra tình trạng API - dùng cho healthcheck của Docker/Coolify.
 *
 * GET /health  →  { status: 'ok', uptime, timestamp }
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; uptime: number; timestamp: string } {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
