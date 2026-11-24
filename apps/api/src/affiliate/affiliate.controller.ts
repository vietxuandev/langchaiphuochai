import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@phuochai/shared';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards';
import { AffiliateService, type AffiliateLinkInput } from './affiliate.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.EDITOR)
@Controller('api/affiliate')
export class AffiliateController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Get('stats')
  stats() {
    return this.affiliate.stats();
  }

  @Get()
  list(
    @Query('query') query?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.affiliate.list({
      query,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('metadata')
  metadata(@Body() body: { url?: string }) {
    if (!body.url?.trim()) throw new BadRequestException('Thiếu URL');
    return this.affiliate.fetchMetadata(body.url.trim());
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.affiliate.get(id);
  }

  @Post()
  create(@Body() body: AffiliateLinkInput) {
    return this.affiliate.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: AffiliateLinkInput) {
    return this.affiliate.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.affiliate.remove(id);
  }
}
