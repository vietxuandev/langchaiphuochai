import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller';
import { AffiliatePublicController } from './affiliate-public.controller';
import { AffiliateRedirectController } from './affiliate-redirect.controller';
import { AffiliateService } from './affiliate.service';

@Module({
  controllers: [AffiliateController, AffiliatePublicController, AffiliateRedirectController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
