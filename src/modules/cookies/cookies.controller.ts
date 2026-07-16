import { Controller, Post, Get, Body, Param, Headers, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { FirebaseService } from '../../firebase/firebase.service';

// Mapeamento de domínio → site key do sidecar
const DOMAIN_TO_SITE: Record<string, string> = {
  'pt.shein.com': 'shein-pt',
  'www.shein.com': 'shein-www',
  'shein.com': 'shein-pt',
  'www.temu.com': 'temu',
  'temu.com': 'temu',
  'www.amazon.es': 'amazon-pt',
  'www.amazon.com': 'amazon-com',
  'www.amazon.co.uk': 'amazon-uk',
  'www.zalando.pt': 'zalando',
  'www.zara.com': 'zara',
  'www.hm.com': 'hm',
  'pt.aliexpress.com': 'aliexpress',
  'www.pullandbear.com': 'pullandbear',
  'www.bershka.com': 'bershka',
};

@Controller('cookies')
export class CookiesController {
  constructor(private firebase: FirebaseService) {}

  @Post()
  async saveCookies(
    @Body() body: { domain: string; cookies: string; token: string },
    @Res() res: Response,
    @Req() _req: Request,
  ) {
    const expected = process.env.COOKIE_CAPTURE_TOKEN;
    if (!expected || body.token !== expected) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (!body.domain || !body.cookies) {
      return res.status(400).json({ error: 'domain e cookies obrigatórios' });
    }

    const domain = body.domain.replace(/^www\./, '');
    await this.firebase.setSiteCookies(domain, body.cookies);
    return res.json({ ok: true, domain });
  }

  // Chamado pelo sidecar após save-vnc — guarda cookies do Playwright storageState
  @Post('sync')
  async syncCookies(
    @Body() body: { domain: string; cookies: string },
    @Headers('x-admin-token') token: string,
    @Res() res: Response,
  ) {
    const expected = process.env.TRADEFLOW_ADMIN_TOKEN || process.env.ADMIN_SECRET;
    if (!expected || token !== expected) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!body.domain || !body.cookies) {
      return res.status(400).json({ error: 'domain e cookies obrigatórios' });
    }
    const domain = body.domain.replace(/^www\./, '');
    await this.firebase.setSiteCookies(domain, body.cookies);
    return res.json({ ok: true, domain });
  }

  // ── Sessão VNC — proxy para o sidecar ────────────────────────────────────

  @Post('session/capture')
  async sessionCapture(
    @Body() body: { url: string },
    @Headers('x-license-key') licenseKey: string,
    @Res() res: Response,
  ) {
    const sidecarUrl = process.env.SIDECAR_URL;
    if (!sidecarUrl) return res.status(503).json({ error: 'SIDECAR_URL não configurado' });
    if (!body.url) return res.status(400).json({ error: 'url obrigatório' });

    let domain: string;
    try { domain = new URL(body.url).hostname; } catch { return res.status(400).json({ error: 'URL inválido' }); }

    const site = DOMAIN_TO_SITE[domain] || DOMAIN_TO_SITE[domain.replace(/^www\./, '')];
    if (!site) return res.status(400).json({ error: `Site não suportado: ${domain}` });

    const novncUrl = process.env.NOVNC_URL || sidecarUrl.replace(/^https?:\/\//, 'http://').replace(/:\d+$/, '') + ':6080/vnc.html';

    const r = await fetch(`${sidecarUrl}/api/session/capture-vnc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site, url: body.url }),
    });
    const data = await r.json();
    return res.status(r.status).json({ ...data, site, novncUrl });
  }

  @Post('session/save')
  async sessionSave(
    @Body() body: { url: string },
    @Res() res: Response,
  ) {
    const sidecarUrl = process.env.SIDECAR_URL;
    if (!sidecarUrl) return res.status(503).json({ error: 'SIDECAR_URL não configurado' });
    if (!body.url) return res.status(400).json({ error: 'url obrigatório' });

    let domain: string;
    try { domain = new URL(body.url).hostname; } catch { return res.status(400).json({ error: 'URL inválido' }); }

    const site = DOMAIN_TO_SITE[domain] || DOMAIN_TO_SITE[domain.replace(/^www\./, '')];
    if (!site) return res.status(400).json({ error: `Site não suportado: ${domain}` });

    const r = await fetch(`${sidecarUrl}/api/session/save-vnc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site }),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  }

  @Get(':domain')
  async getCookies(
    @Param('domain') domain: string,
    @Headers('x-admin-token') token: string,
    @Res() res: Response,
  ) {
    const expected = process.env.TRADEFLOW_ADMIN_TOKEN || process.env.ADMIN_SECRET;
    if (token !== expected) return res.status(401).json({ error: 'Unauthorized' });
    const cookies = await this.firebase.getSiteCookies(domain.replace(/^www\./, ''));
    return res.json({ cookies });
  }
}
