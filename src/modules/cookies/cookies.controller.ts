import { Controller, Post, Get, Body, Param, Headers, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { FirebaseService } from '../../firebase/firebase.service';

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
