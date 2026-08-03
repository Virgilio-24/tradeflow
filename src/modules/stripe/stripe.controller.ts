import {
  Controller, Post, Body, Headers, RawBodyRequest,
  Req, BadRequestException, Logger, UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';
import { FirebaseService } from '../../firebase/firebase.service';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private stripeService: StripeService,
    private firebase: FirebaseService,
    private config: ConfigService,
  ) {}

  private validateAdmin(token: string) {
    if (token !== this.config.get('ADMIN_SECRET')) {
      throw new UnauthorizedException('Invalid admin token');
    }
  }

  // Cria sessão de checkout — chamado pelo realstiles admin
  @Post('checkout')
  async checkout(@Headers('x-admin-token') token: string, @Body() body: {
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
    this.validateAdmin(token);
    const { success_url, cancel_url, callback_url, store_url } = body;

    let price_id = body.price_id;
    if (!price_id && body.plano_id) {
      price_id = this.stripeService.getPriceIdForPlan(body.plano_id) ?? undefined;
    }
    if (!price_id) throw new BadRequestException('price_id ou plano_id obrigatório');

    let account_id = body.account_id ?? null;
    let email = body.email;

    if (account_id) {
      // Upgrade de conta existente
      const account = await this.firebase.getAccount(account_id);
      if (!account) throw new BadRequestException('Conta não encontrada');
      email = account.email;
    } else {
      // Nova subscrição — conta só é criada pelo webhook após pagamento confirmado
      if (!body.email || !body.nome || !body.plano_id) {
        throw new BadRequestException('account_id ou (email + nome + plano_id) obrigatórios');
      }
      email = body.email;
    }

    const url = await this.stripeService.createCheckoutSession(
      price_id, account_id, email!,
      success_url, cancel_url,
      { store_url, callback_url, plano_id: body.plano_id, nome: body.nome },
    );
    return { url };
  }

  // Cancela subscrição no fim do período actual
  @Post('cancel')
  async cancel(@Headers('x-admin-token') token: string, @Body() body: { account_id: string }) {
    this.validateAdmin(token);
    const { account_id } = body;
    if (!account_id) throw new BadRequestException('account_id obrigatório');
    await this.stripeService.cancelSubscription(account_id);
    return { ok: true };
  }

  // Cria sessão do Customer Portal — permite gerir subscrição
  @Post('portal')
  async portal(@Headers('x-admin-token') token: string, @Body() body: { account_id: string; return_url?: string }) {
    this.validateAdmin(token);
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
