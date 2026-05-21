import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from '../firebase/firebase.service';
import { BrowserService } from '../browser/browser.service';
import { ExtractorFactory } from '../extractors/factory/extractor.factory';
import { JOB_COST } from '../common/types';

@Injectable()
export class ImportWorker {
  private readonly logger = new Logger(ImportWorker.name);
  private processing = false;

  constructor(
    private firebase: FirebaseService,
    private browser: BrowserService,
    private factory: ExtractorFactory,
  ) {}

  // Verificar fila a cada 3 segundos
  @Cron('*/3 * * * * *')
  async tick() {
    if (this.processing) return;
    if (this.browser.availablePages() === 0) return;

    const job = await this.firebase.getNextPendingJob();
    if (!job) return;

    this.processing = true;
    await this.processJob(job.id);
    this.processing = false;
  }

  private async processJob(jobId: string) {
    const job = await this.firebase.getJob(jobId);
    if (!job || job.status !== 'pending') return;

    const startedAt = Date.now();
    this.logger.log(`Processing job ${jobId} — ${job.url}`);

    await this.firebase.updateJobStatus(jobId, 'processing');

    let page = null;
    try {
      // Verificar se a fonte é suportada
      const extractor = this.factory.getExtractor(job.url);

      // Verificar se o plano da conta permite esta fonte
      const account = await this.firebase.getAccount(job.account_id);
      const plan = await this.firebase.getPlan(account!.plano_id);

      if (plan && !plan.fontes.includes(job.fonte)) {
        throw new Error(
          `Source "${job.fonte}" not available in plan "${plan.nome}". Upgrade to access.`,
        );
      }

      // Adquirir página do pool
      page = await this.browser.acquirePage();

      // Delay humano antes de começar
      await this.sleep(500 + Math.random() * 1000);

      // Extrair
      const resultado = await extractor.extract(job.url, page);

      const duracao = Date.now() - startedAt;
      await this.firebase.completeJob(jobId, resultado, duracao);

      // Decrementar créditos
      const custo = JOB_COST[job.tipo];
      await this.firebase.decrementCredits(job.account_id, custo);

      await this.firebase.createLog({
        account_id: job.account_id,
        store_id: job.store_id,
        job_id: jobId,
        nivel: 'info',
        mensagem: `Job completed in ${duracao}ms — ${resultado.nome}`,
      });

      this.logger.log(`Job ${jobId} done in ${duracao}ms`);

    } catch (error: any) {
      const msg = error?.message ?? 'Unknown error';
      this.logger.error(`Job ${jobId} failed: ${msg}`);

      await this.firebase.failJob(jobId, msg);
      await this.firebase.createLog({
        account_id: job.account_id,
        store_id: job.store_id,
        job_id: jobId,
        nivel: 'error',
        mensagem: msg,
        stack: error?.stack,
      });

    } finally {
      if (page) await this.browser.releasePage(page);
    }
  }

  private sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}
