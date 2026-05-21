import { Injectable, NotFoundException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { ExtractorFactory } from '../../extractors/factory/extractor.factory';
import { Account, Store, JobType, JOB_COST } from '../../common/types';

@Injectable()
export class ScrapeService {
  constructor(
    private firebase: FirebaseService,
    private factory: ExtractorFactory,
  ) {}

  async createJob(
    url: string,
    tipo: JobType,
    account: Account,
    store: Store,
  ): Promise<string> {
    // Detectar fonte
    const fonte = this.factory.detectSource(url);
    if (!fonte) {
      throw new HttpException(
        `Marketplace not supported for URL: ${url}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    // Verificar se o plano permite esta fonte
    const plan = await this.firebase.getPlan(account.plano_id);
    if (plan && !plan.fontes.includes(fonte)) {
      throw new ForbiddenException(
        `"${fonte}" not available in plan "${plan.nome}". Upgrade to access.`,
      );
    }

    // Verificar créditos suficientes para esta operação
    const custo = JOB_COST[tipo];
    if (account.creditos_usados + custo > account.creditos_limite) {
      throw new HttpException(
        { error: 'Insufficient credits', needed: custo, available: account.creditos_limite - account.creditos_usados, upgrade: true },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const jobId = await this.firebase.createJob({
      account_id: account.id,
      store_id: store.id,
      url,
      fonte,
      tipo,
      status: 'pending',
      custo,
    });

    await this.firebase.createLog({
      account_id: account.id,
      store_id: store.id,
      job_id: jobId,
      nivel: 'info',
      mensagem: `Job created: ${fonte} — ${url}`,
    });

    return jobId;
  }

  async getJob(jobId: string, accountId: string) {
    const job = await this.firebase.getJob(jobId);
    if (!job) throw new NotFoundException('Job not found');
    if (job.account_id !== accountId) throw new ForbiddenException('Access denied');

    return {
      id: job.id,
      status: job.status,
      fonte: job.fonte,
      tipo: job.tipo,
      custo: job.custo,
      resultado: job.status === 'done' ? job.resultado : undefined,
      erro: job.status === 'error' ? job.erro : undefined,
      criado_em: job.criado_em,
      concluido_em: job.concluido_em,
      duracao_ms: job.duracao_ms,
    };
  }
}
