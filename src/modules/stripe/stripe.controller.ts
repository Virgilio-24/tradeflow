import {
  Controller, Post, Body, Headers, RawBodyRequest,
  Req, BadRequestException, Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { FirebaseService } from '../../firebase/firebase.service';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private stripeService: StripeService,
    private firebase: FirebaseService,
  ) {}

  // Cria sessão de checkout — chamado pelo realstiles admin
  @Post('checkout')
  async checkout(@Body() body: {
    price_id?: string;
    plano_id?: string;
    account_id?: string;
    email?: string;
    nome?: string;
    store_url?: string;
    callback_url?: string;
    success_url?: string;
    cancel_url?: string;
  }) {
    const { success_url, cancel_url, callback_url, store_url } = body;

    let price_id = body.price_id;
    if (!price_id && body.plano_id) {
      price_id = this.stripeService.getPriceIdForPlan(body.plano_id) ?? undefined;
    }
    if (!price_id) throw new BadRequestException('price_id ou plano_id obrigatório');

    let account_id = body.account_id;
    let email = body.email;

    // Se não veio account_id, criar conta agora com plano trial (pagamento activa depois via webhook)
    if (!account_id) {
      if (!body.email || !body.nome || !body.plano_id) {
        throw new BadRequestException('account_id ou (email + nome + plano_id) obrigatórios');
      }
      account_id = await this.stripeService.createPendingAccount(body.email, body.nome);
      email = body.email;
    } else {
      const account = await this.firebase.getAccount(account_id);
      if (!account) throw new BadRequestException('Conta não encontrada');
      email = account.email;
    }

    const url = await this.stripeService.createCheckoutSession(
      price_id, account_id, email!,
      success_url, cancel_url,
      { store_url, callback_url, plano_id: body.plano_id },
    );
    return { url };
  }

  // Cancela subscrição no fim do período actual
  @Post('cancel')
  async cancel(@Body() body: { account_id: string }) {
    const { account_id } = body;
    if (!account_id) throw new BadRequestException('account_id obrigatório');
    await this.stripeService.cancelSubscription(account_id);
    return { ok: true };
  }

  // Cria sessão do Customer Portal — permite gerir subscrição
  @Post('portal')
  async portal(@Body() body: { account_id: string; return_url?: string }) {
    const { account_id, return_url } = body;
    if (!account_id) throw new BadRequestException('account_id obrigatório');
    const url = await this.stripeService.createPortalSession(account_id, return_url ?? '');
    return { url };
  }

  // Webhook do Stripe — deve ser raw body para validação da assinatura
  @Post('webhook')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Raw body em falta');
    if (!signature) throw new BadRequestException('stripe-signature em falta');

    try {
      await this.stripeService.handleWebhook(req.rawBody, signature);
      return { received: true };
    } catch (err: any) {
      this.logger.error(`Webhook error: ${err.message}`);
      throw new BadRequestException(err.message);
    }
  }
}
