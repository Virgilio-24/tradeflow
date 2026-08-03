import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from '../../firebase/firebase.service';
import { MailService } from '../../mail/mail.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private firebase: FirebaseService,
    private mail: MailService,
    private config: ConfigService,
  ) {}

  @Cron('0 8 * * *') // todos os dias às 8h UTC
  async verificarTrials() {
    this.logger.log('A verificar trials...');
    const accounts = await this.firebase.listAccounts();
    const agora = Date.now();
    const tresdiasMs = 3 * 24 * 60 * 60 * 1000;

    for (const account of accounts) {
      if (account.billing_status !== 'trial') continue;

      const expiracaoMs = (account.renovacao_em as any).seconds * 1000;
      const diasRestantes = Math.ceil((expiracaoMs - agora) / (24 * 60 * 60 * 1000));

      if (agora >= expiracaoMs) {
        // Trial expirado — suspender
        this.logger.log(`Trial expirado: ${account.email}`);
        await this.firebase.updateAccount(account.id, {
          billing_status: 'suspended',
          whatsapp_ativo: false,
        } as any);
        await this.mail.enviarTrialExpirado({ nome: account.nome, email: account.email });
        await this.notifyStores(account.id);
      } else if (diasRestantes === 3) {
        // Aviso 3 dias antes — só envia uma vez (quando diasRestantes === 3 exactamente)
        this.logger.log(`Trial a expirar em 3 dias: ${account.email}`);
        await this.mail.enviarAvisoTrialExpira({ nome: account.nome, email: account.email, dias: 3 });
      }
    }
  }

  private async notifyStores(accountId: string): Promise<void> {
    const secret = this.config.get<string>('CALLBACK_SECRET');
    const stores = await this.firebase.listStoresByAccount(accountId);
    for (const store of stores) {
      const callbackUrl = store.callback_url;
      if (!callbackUrl) continue;
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (secret) headers['x-callback-secret'] = secret;
        await fetch(`${callbackUrl}/suspend`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ account_id: accountId }),
        });
      } catch (err: any) {
        this.logger.warn(`Falha ao notificar store ${store.id}: ${err.message}`);
      }
    }
  }
}
