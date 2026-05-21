import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ScrapeService } from './scrape.service';
import { LicenseGuard } from '../auth/auth.guard';
import { IsUrl, IsIn, IsOptional } from 'class-validator';

class ScrapeDto {
  @IsUrl({}, { message: 'Invalid URL' })
  url: string;

  @IsOptional()
  @IsIn(['import', 'price_sync', 'stock_sync'])
  tipo?: string;
}

@Controller()
export class ScrapeController {
  constructor(private scrape: ScrapeService) {}

  @Post('scrape')
  @UseGuards(LicenseGuard)
  @HttpCode(202)
  async startScrape(@Body() dto: ScrapeDto, @Req() req: any) {
    const jobId = await this.scrape.createJob(
      dto.url,
      dto.tipo as any ?? 'import',
      req.account,
      req.store,
    );
    return { job_id: jobId, status: 'pending' };
  }

  @Get('job/:id')
  @UseGuards(LicenseGuard)
  async getJob(@Param('id') id: string, @Req() req: any) {
    return this.scrape.getJob(id, req.account.id);
  }

  @Get('usage')
  @UseGuards(LicenseGuard)
  async getUsage(@Req() req: any) {
    return {
      creditos_usados: req.account.creditos_usados,
      creditos_limite: req.account.creditos_limite,
      percentagem: Math.round((req.account.creditos_usados / req.account.creditos_limite) * 100),
      plano: req.account.plano_id,
      renovacao_em: req.account.renovacao_em,
    };
  }
}
