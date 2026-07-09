import {
  Controller, Post, Get, Query, Body, BadRequestException, HttpCode,
} from '@nestjs/common';
import { AdminService } from '../admin/admin.service';
import { FirebaseService } from '../../firebase/firebase.service';
import { MailService } from '../../mail/mail.service';

const PLANOS_PAGOS = ['starter', 'pro', 'business'];

@Controller('registar')
export class RegistarController {
  constructor(
    private admin: AdminService,
    private firebase: FirebaseService,
    private mail: MailService,
  ) {}

  @Get('verificar')
  async verificarEmail(@Query('email') email: string) {
    if (!email) return { trial_usado: false };
    const existing = await this.firebase.getAccountByEmail(email.trim());
    return { trial_usado: !!existing };
  }

  @Post()
  @HttpCode(201)
  async registar(@Body() body: {
    nome: string;
    email: string;
    store_url: string;
    plano_id: string;
  }) {
    const { nome, email, store_url, plano_id } = body;

    if (!nome?.trim()) throw new BadRequestException('Nome é obrigatório');
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email inválido');
    }
    if (!store_url?.trim()) throw new BadRequestException('URL da loja é obrigatório');

    const plano = plano_id || 'trial';
    const planosPermitidos = ['trial', 'starter', 'pro', 'business'];
    if (!planosPermitidos.includes(plano)) {
      throw new BadRequestException('Plano inválido');
    }

    const result = await this.admin.createAccount(email.trim(), nome.trim(), plano);

    const url = store_url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    await this.firebase.createStore({
      account_id: result.id,
      site_url: url,
      site_nome: url,
      activo: true,
      rate_limit: 10,
    } as any);

    // Email de boas-vindas para todos os planos
    this.mail.enviarBoasVindas({
      nome: nome.trim(),
      email: email.trim(),
      plano,
      license_key: result.license_key,
    });

    // Notificação interna apenas para planos pagos
    if (PLANOS_PAGOS.includes(plano)) {
      this.mail.notificarNovaSubscricao({
        nome: nome.trim(),
        email: email.trim(),
        plano,
        store_url: url,
        license_key: result.license_key,
      });
    }

    return { license_key: result.license_key };
  }
}
