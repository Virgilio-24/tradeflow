import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe = require('stripe');
import * as admin from 'firebase-admin';
import { FirebaseService } from '../../firebase/firebase.service';

// Mapeamento Price ID → créditos e permissões
// Preencher com os IDs reais do Stripe Dashboard
interface PriceConfig {
  creditos: number;
  whatsapp: boolean;
  whatsapp_numeros_max: number; // -1 = ilimitado
  tipo: 'mensal' | 'avulso' | 'wa';
  plano_id?: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;
  private priceMap: Record<string, PriceConfig>;

  constructor(
    private config: ConfigService,
    private firebase: FirebaseService,
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY')!);

    this.priceMap = {
      [this.config.get('STRIPE_PRICE_STARTER')!]: {
        creditos: 800, whatsapp: true, whatsapp_numeros_max: -1,
        tipo: 'mensal', plano_id: 'starter',
      },
      [this.config.get('STRIPE_PRICE_PRO')!]: {
        creditos: 2500, whatsapp: true, whatsapp_numeros_max: -1,
        tipo: 'mensal', plano_id: 'pro',
      },
      [this.config.get('STRIPE_PRICE_BUSINESS')!]: {
        creditos: 8000, whatsapp: true, whatsapp_numeros_max: -1,
        tipo: 'mensal', plano_id: 'business',
      },
      [this.config.get('STRIPE_PRICE_PACK_S')!]: {
        creditos: 400, whatsapp: false, whatsapp_numeros_max: 0,
        tipo: 'avulso',
      },
      [this.config.get('STRIPE_PRICE_PACK_M')!]: {
        creditos: 1200, whatsapp: false, whatsapp_numeros_max: 0,
        tipo: 'avulso',
      },
      [this.config.get('STRIPE_PRICE_PACK_L')!]: {
        creditos: 3500, whatsapp: false, whatsapp_numeros_max: 0,
        tipo: 'avulso',
      },
      [this.config.get('STRIPE_PRICE_WHATSAPP')!]: {
        creditos: 0, whatsapp: true, whatsapp_numeros_max: -1,
        tipo: 'wa',
      },
    };
  }

  // Cria uma sessão de checkout no Stripe
  getPriceIdForPlan(planoId: string): string | null {
    const entry = Object.entries(this.priceMap).find(([, cfg]) => cfg.plano_id === planoId);
    return entry ? entry[0] : null;
  }

  async createCheckoutSession(
    priceId: string,
    accountId: string,
    email: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<string> {
    const cfg = this.priceMap[priceId];
    if (!cfg) throw new BadRequestException('Plano inválido');

    const mode = cfg.tipo === 'avulso' ? 'payment' : 'subscription';

    const session = await this.stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      metadata: { account_id: accountId, price_id: priceId },
      // Para subscrições mensais: propagar account_id para o objecto Subscription
      // para que invoice.paid consiga identificar a conta
      ...(mode === 'subscription' ? {
        subscription_data: { metadata: { account_id: accountId } },
      } : {}),
      success_url: successUrl ?? `${this.config.get('APP_URL')}/registar?sucesso=1`,
      cancel_url: cancelUrl ?? `${this.config.get('APP_URL')}/#precos`,
    });

    return session.url!;
  }

  // Processa webhook recebido do Stripe
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')!;
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      throw new BadRequestException('Webhook signature inválida');
    }

    if (event.type === 'checkout.session.completed') {
      await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    } else if (event.type === 'invoice.paid') {
      await this.onInvoicePaid(event.data.object as Stripe.Invoice);
    } else if (event.type === 'customer.subscription.deleted') {
      await this.onSubscriptionCancelled(event.data.object as Stripe.Subscription);
    }
  }

  // Pagamento único (packs avulso) ou primeira renovação de subscrição
  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const accountId = session.metadata?.account_id;
    const priceId = session.metadata?.price_id;
    if (!accountId || !priceId) return;

    const cfg = this.priceMap[priceId];
    if (!cfg) {
      this.logger.error(`Price ID desconhecido: ${priceId}`);
      return;
    }

    this.logger.log(`Checkout completed — account: ${accountId}, tipo: ${cfg.tipo}, créditos: ${cfg.creditos}`);

    if (cfg.tipo === 'avulso') {
      // Pack de créditos: soma ao extra (nunca expira)
      await this.firebase.addCreditsExtra(accountId, cfg.creditos);
    } else if (cfg.tipo === 'wa') {
      // Add-on WhatsApp: activa sem alterar créditos
      const renovacao = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      );
      await this.firebase.activateWhatsapp(accountId, {
        renovacao,
        numeros_max: cfg.whatsapp_numeros_max,
      });
    } else if (cfg.tipo === 'mensal') {
      // Plano mensal: activar imediatamente no checkout completed
      // (invoice.paid fará o mesmo na renovação — idempotente)
      const renovacao = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      );
      const stripeCustomerId = session.customer as string | null;
      const stripeSubscriptionId = session.subscription as string | null;
      await this.firebase.updateAccount(accountId, {
        plano_id: cfg.plano_id as any,
        billing_status: 'active',
        creditos_usados: 0,
        creditos_limite: cfg.creditos,
        whatsapp_ativo: cfg.whatsapp,
        whatsapp_numeros_max: cfg.whatsapp_numeros_max,
        renovacao_em: renovacao,
        ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
        ...(stripeSubscriptionId ? { stripe_subscription_id: stripeSubscriptionId } : {}),
      });
      this.logger.log(`Plan activated on checkout — account: ${accountId}, plano: ${cfg.plano_id}`);
    }
  }

  // Renovação mensal de subscrição
  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = (invoice as any).subscription as string | null;
    if (!subscriptionId) return;

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price.id;
    const accountId = (subscription.metadata?.account_id as string | undefined)
      ?? (await this.getAccountByCustomer(subscription.customer as string));

    if (!accountId || !priceId) return;

    const cfg = this.priceMap[priceId];
    if (!cfg || cfg.tipo !== 'mensal') return;

    this.logger.log(`Invoice paid — account: ${accountId}, plano: ${cfg.plano_id}, créditos: ${cfg.creditos}`);

    const periodEnd = (subscription as any).current_period_end as number;

    await this.firebase.updateAccount(accountId, {
      plano_id: cfg.plano_id as any,
      billing_status: 'active',
      creditos_usados: 0,
      creditos_limite: cfg.creditos,
      whatsapp_ativo: cfg.whatsapp,
      whatsapp_numeros_max: cfg.whatsapp_numeros_max,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      renovacao_em: admin.firestore.Timestamp.fromMillis(periodEnd * 1000),
    });
  }

  // Subscrição cancelada
  private async onSubscriptionCancelled(subscription: Stripe.Subscription): Promise<void> {
    const accountId = subscription.metadata?.account_id
      ?? (await this.getAccountByCustomer(subscription.customer as string));
    if (!accountId) return;

    this.logger.log(`Subscription cancelled — account: ${accountId}`);
    await this.firebase.updateAccount(accountId, {
      billing_status: 'suspended',
      plano_id: 'trial',
      creditos_limite: 20,
    } as any);
    await this.firebase.deactivateWhatsapp(accountId);
  }

  async createPortalSession(accountId: string, returnUrl: string): Promise<string> {
    const account = await this.firebase.getAccount(accountId);
    if (!account?.stripe_customer_id) throw new BadRequestException('Sem customer Stripe associado');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: account.stripe_customer_id,
      return_url: returnUrl || `${this.config.get('APP_URL')}/admin/tradeflow`,
    });
    return session.url;
  }

  private async getAccountByCustomer(customerId: string): Promise<string | null> {
    const accounts = await this.firebase.listAccounts();
    const match = accounts.find(a => a.stripe_customer_id === customerId);
    return match?.id ?? null;
  }
}
