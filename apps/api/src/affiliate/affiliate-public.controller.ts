import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators';
import { AffiliateService } from './affiliate.service';

/** Endpoint public chỉ trả dữ liệu cần cho thẻ sản phẩm; không lộ URL đích. */
@Public()
@Controller('api/affiliate/public')
export class AffiliatePublicController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Get(':slug')
  card(@Param('slug') slug: string) {
    return this.affiliate.publicCard(slug);
  }
}
