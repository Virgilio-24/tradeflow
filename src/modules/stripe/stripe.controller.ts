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

  // Cria sessão de checkout — chamado pelo frontend da landing page
  @Post('checkout')
  async checkout(@Body() body: { price_id: string; account_id: string }) {
    const { price_id, account_id } = body;
    if (!price_id || !account_id) throw new BadRequestException('price_id e account_id obrigatórios');

    const account = await this.firebase.getAccount(account_id);
    if (!account) throw new BadRequestException('Conta não encontrada');

    const url = await this.stripeService.createCheckoutSession(price_id, account_id, account.email);
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
