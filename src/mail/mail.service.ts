import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const user = this.config.get('GMAIL_USER');
    const pass = this.config.get('GMAIL_APP_PASSWORD');
    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
    } else {
      this.logger.warn('GMAIL_USER ou GMAIL_APP_PASSWORD não configurados — emails desactivados');
    }
  }

  async enviarBoasVindas(dados: {
    nome: string;
    email: string;
    plano: string;
    license_key: string;
  }) {
    if (!this.transporter) return;

    const limites: Record<string, string> = {
      trial: '20 produtos/mês',
      starter: '800 produtos/mês',
      pro: '2 500 produtos/mês',
      business: '8 000 produtos/mês',
    };

    try {
      await this.transporter.sendMail({
        from: `"TradeFlow" <${this.config.get('GMAIL_USER')}>`,
        to: dados.email,
        subject: `A tua license key TradeFlow — Plano ${dados.plano.toUpperCase()}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
            <div style="background:#6366f1;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;margin:0;font-size:22px">⚡ TradeFlow</h1>
              <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Conta criada com sucesso</p>
            </div>
            <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
              <p style="font-size:15px;margin:0 0 24px">Olá <strong>${dados.nome}</strong>,</p>
              <p style="font-size:14px;color:#475569;margin:0 0 24px">A tua conta TradeFlow está activa. Aqui está a tua license key — guarda-a num lugar seguro, precisas dela para autenticar todos os pedidos à API.</p>

              <div style="background:#1e1b4b;border-radius:10px;padding:20px 24px;margin-bottom:24px">
                <p style="font-size:11px;font-weight:700;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">License Key</p>
                <p style="font-family:monospace;font-size:14px;color:#fff;margin:0;word-break:break-all;line-height:1.6">${dados.license_key}</p>
              </div>

              <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:120px">Plano</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#6366f1">${dados.plano.toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:13px;color:#64748b">Limite mensal</td>
                  <td style="padding:10px 0;font-size:13px;font-weight:600">${limites[dados.plano] ?? ''}</td>
                </tr>
              </table>

              <div style="background:#ede9fe;border-radius:8px;padding:16px;font-size:13px;color:#5b21b6;margin-bottom:24px;line-height:1.7">
                <strong>Como usar:</strong> inclui o header <code style="background:rgba(99,102,241,0.15);padding:1px 6px;border-radius:4px;font-family:monospace">x-license-key</code> em todos os pedidos à API.<br><br>
                <strong>Tens um e-commerce desenvolvido pela nossa equipa?</strong> A integração com o TradeFlow já está feita — não precisas de fazer mais nada. A importação de produtos funciona directamente no teu painel de administração.
              </div>

              <p style="font-size:13px;color:#94a3b8;margin:0">Dúvidas? Responde a este email.<br>— Equipa TradeFlow</p>
            </div>
          </div>
        `,
      });
      this.logger.log(`Boas-vindas enviado para ${dados.email}`);
    } catch (err: any) {
      this.logger.error(`Falha ao enviar boas-vindas para ${dados.email}: ${err.message}`);
    }
  }

  async notificarNovaSubscricao(dados: {
    nome: string;
    email: string;
    plano: string;
    store_url: string;
    license_key: string;
  }) {
    if (!this.transporter) return;

    const destino = this.config.get('NOTIFY_EMAIL');
    const precos: Record<string, string> = {
      starter: '12€/mês',
      pro: '29€/mês',
      business: '89€/mês',
    };

    try {
      await this.transporter.sendMail({
        from: `"TradeFlow" <${this.config.get('GMAIL_USER')}>`,
        to: destino,
        subject: `🎉 Nova subscrição ${dados.plano.toUpperCase()} — ${dados.nome}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
            <div style="background:#6366f1;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;margin:0;font-size:22px">⚡ TradeFlow</h1>
              <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Nova subscrição recebida</p>
            </div>
            <div style="background:#f8fafc;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
              <table style="width:100%;border-collapse:collapse">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;width:120px">Plano</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:700;color:#6366f1">
                    ${dados.plano.toUpperCase()} — ${precos[dados.plano] ?? ''}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Nome</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:600">${dados.nome}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Email</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px">${dados.email}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">Loja</td>
                  <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:14px">${dados.store_url}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:14px;color:#64748b">License key</td>
                  <td style="padding:10px 0;font-size:13px;font-family:monospace;color:#0f172a">${dados.license_key}</td>
                </tr>
              </table>
              <div style="margin-top:24px;padding:16px;background:#ede9fe;border-radius:8px;font-size:13px;color:#5b21b6">
                Vai ao painel de admin para gerir esta conta: <strong>localhost:3001/admin</strong>
              </div>
            </div>
          </div>
        `,
      });
      this.logger.log(`Notificação enviada para ${destino} — ${dados.plano} (${dados.email})`);
    } catch (err: any) {
      this.logger.error(`Falha ao enviar email: ${err.message}`);
    }
  }
}
