import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getClientIp } from '../common/client-ip';
import { Public } from '../common/decorators';
import { AffiliateService } from './affiliate.service';

/** Redirect affiliate: /go/:slug -> Shopee, kèm sub_id và log click. */
@Public()
@Controller('go')
export class AffiliateRedirectController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Get(':slug')
  async redirect(
    @Param('slug') slug: string,
    @Query('from') from: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const target = await this.affiliate.resolve(slug, {
        from,
        referrer: typeof req.headers.referer === 'string' ? req.headers.referer : undefined,
        ip: getClientIp(req),
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.redirect(302, target);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex');
      res.status(404).type('text/plain').send('Link affiliate không tồn tại hoặc đã tắt.');
    }
  }
}
