import { Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode } from '@nestjs/common';
import { ScrapeService } from './scrape.service';
import { LicenseGuard } from '../auth/auth.guard';
import { FirebaseService } from '../../firebase/firebase.service';
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
  constructor(private scrape: ScrapeService, private firebase: FirebaseService) {}

  @Get('plans')
  async getPlans() {
    const plans = await this.firebase.listPlans();
    return plans
      .filter(p => p.activo && ['mensal', 'avulso', 'wa'].includes((p as any).tipo))
      .map(p => ({
        id: p.id,
        nome: p.nome,
        preco: p.preco,
        tipo: (p as any).tipo ?? 'mensal',
        creditos_mes: p.creditos_mes ?? 0,
        creditos_pack: (p as any).creditos_pack ?? 0,
        stores_max: p.stores_max,
        fontes: p.fontes,
        whatsapp_incluido: (p as any).whatsapp_incluido ?? false,
        whatsapp_numeros_max: (p as any).whatsapp_numeros_max ?? 0,
      }));
  }

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
