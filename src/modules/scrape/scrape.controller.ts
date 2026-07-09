import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ScrapeService } from './scrape.service';
import { LicenseGuard } from '../auth/auth.guard';
import { IsUrl, IsNumber, Min, Max } from 'class-validator';

class ScrapeDto {
  @IsUrl({}, { message: 'Invalid URL' })
  url: string;
}

class DeductDto {
  @IsNumber()
  @Min(0.1)
  @Max(5)
  amount: number;

  fonte?: string;
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
      'import',
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

  @Post('usage/deduct')
  @UseGuards(LicenseGuard)
  @HttpCode(200)
  async deductUsage(@Body() dto: DeductDto, @Req() req: any) {
    return this.scrape.deductCredits(req.account, dto.amount, dto.fonte);
  }
}
