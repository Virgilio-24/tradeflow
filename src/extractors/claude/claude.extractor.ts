import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { Extractor } from '../base/extractor.interface';
import { ProductData, MarketplaceSource, ProductVariant } from '../../common/types';

@Injectable()
export class ClaudeExtractor implements Extractor {
  readonly source: MarketplaceSource = 'shein';
  private readonly logger = new Logger(ClaudeExtractor.name);
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  canHandle(url: string): boolean {
    // Suporta qualquer URL — é o fallback universal
    return true;
  }

  sourceForUrl(url: string): MarketplaceSource | undefined {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const map: Record<string, MarketplaceSource> = {
        'shein.com': 'shein', 'shein.pt': 'shein',
        'temu.com': 'temu',
        'zara.com': 'zara',
        'hm.com': 'hm',
        'zalando.pt': 'zalando', 'zalando.es': 'zalando', 'zalando.de': 'zalando',
        'amazon.es': 'amazon', 'amazon.de': 'amazon', 'amazon.co.uk': 'amazon',
        'amazon.fr': 'amazon', 'amazon.it': 'amazon',
        'pullandbear.com': 'pullandbear',
        'bershka.com': 'bershka',
        'aboutyou.com': 'aboutyou',
        'shopee.pt': 'shopee',
        'aliexpress.com': 'aliexpress',
      };
      for (const [domain, source] of Object.entries(map)) {
        if (hostname === domain || hostname.endsWith('.' + domain)) return source;
      }
    } catch { /* URL inválido */ }
    return undefined;
  }

  // Remove parâmetros de tracking mantendo apenas o essencial para o produto
  private cleanUrl(url: string): string {
    try {
      const u = new URL(url);
      // Parâmetros que identificam o produto em cada loja
      const keepParams: Record<string, string[]> = {
        'shein.com': [], // Shein usa path — limpa tudo
        'temu.com': ['goods_id'],
        'amazon.': ['dp'],
        'zalando.': [],
      };
      const host = u.hostname.replace(/^www\./, '');
      const keep = Object.entries(keepParams).find(([k]) => host.includes(k))?.[1];
      if (keep !== undefined) {
        const clean = new URL(u.origin + u.pathname);
        keep.forEach(k => { if (u.searchParams.has(k)) clean.searchParams.set(k, u.searchParams.get(k)!); });
        this.logger.debug(`URL limpa: ${clean.toString()}`);
        return clean.toString();
      }
    } catch { /* URL inválido */ }
    return url;
  }

  async extract(url: string, _page: Page, options?: { proxyUrls?: string[] }): Promise<ProductData> {
    const fonte = this.sourceForUrl(url) ?? 'shein';
    const cleanedUrl = this.cleanUrl(url);
    this.logger.log(`Claude fallback extractor — ${fonte} — ${cleanedUrl}`);

    // Tier 3: Evomi + Claude
    let product = await this.tryExtract(cleanedUrl, 'evomi', options?.proxyUrls);

    // Tier 4: fetch direto + Claude (se Evomi falhou ou devolveu página errada)
    if (!product?.nome) {
      this.logger.warn(`Evomi+Claude não extraiu produto — a tentar fetch direto`);
      product = await this.tryExtract(cleanedUrl, 'direct');
    }

    if (!product?.nome) {
      throw new Error('Não foi possível extrair o produto desta página. O site pode estar a bloquear o acesso.');
    }

    this.logger.log(`Claude extracted — "${product.nome.slice(0, 60)}"`);
    return { ...product, fonte_url: cleanedUrl, fonte_site: fonte };
  }

  private async tryExtract(url: string, method: 'evomi' | 'direct', proxyUrls?: string[]): Promise<Omit<ProductData, 'fonte_url' | 'fonte_site'> | null> {
    try {
      let html: string;
      if (method === 'evomi') {
        const evomiKey = process.env.EVOMI_API_KEY;
        if (!evomiKey) return null;
        html = await this.fetchViaEvomi(url, evomiKey);
      } else {
        html = await this.fetchDirect(url);
      }

      this.logger.debug(`Conteúdo (${method}): ${html.length} chars — início: ${html.slice(0, 200).replace(/\s+/g, ' ')}`);
      // Evomi já devolve Markdown limpo; direct devolve HTML que precisamos de trim
      const trimmed = method === 'evomi' ? html.slice(0, 40_000) : this.trimHtml(html);
      this.logger.debug(`Trimmed (${method}): ${trimmed.length} chars`);

      if (trimmed.length < 200 || /captcha|robot|challenge|verify you are human/i.test(trimmed)) {
        this.logger.warn(`${method}: página de bot-check detectada`);
        return null;
      }

      const product = await this.extractWithClaude(trimmed, url);
      this.logger.debug(`Claude (${method}): nome="${product.nome}" preco=${product.preco} imagens=${product.imagens.length}`);
      return product;
    } catch (err: any) {
      this.logger.warn(`tryExtract(${method}) falhou: ${err?.message}`);
      return null;
    }
  }

  private async fetchDirect(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Direct fetch HTTP ${res.status}`);
    return res.text();
  }

  private async fetchViaEvomi(url: string, apiKey: string): Promise<string> {
    this.logger.log(`Fetching via Evomi (markdown) — ${url}`);
    const res = await fetch('https://scrape.evomi.com/api/v1/scraper/realtime', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        mode: 'residential',
        delivery: 'json',
        content: 'markdown',
        include_content: true,
        proxy_country: 'PT',
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) throw new Error(`Evomi HTTP ${res.status}`);

    const data = await res.json();
    this.logger.debug(`Evomi resposta: success=${data.success} status=${data.status_code} credits=${data.credits_used}`);

    if (!data.success) {
      throw new Error(`Evomi falhou: ${data.error ?? data.message ?? 'unknown'}`);
    }

    // Resposta síncrona com conteúdo inline
    const content = data.content ?? data.markdown ?? data.body ?? data.html;
    if (content) {
      this.logger.log(`Evomi markdown recebido: ${content.length} chars`);
      return content;
    }

    // Resposta assíncrona — polling pela result_url
    const resultUrl = data.result_url ?? data.polling_url;
    if (resultUrl) {
      this.logger.log(`Evomi async — polling ${resultUrl}`);
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const poll = await fetch(resultUrl, {
          headers: { 'x-api-key': apiKey },
          signal: AbortSignal.timeout(15_000),
        });
        if (!poll.ok) continue;
        const pollData = await poll.json();
        if (pollData.status === 'done' || pollData.content || pollData.markdown) {
          const c = pollData.content ?? pollData.markdown ?? pollData.html ?? '';
          return c;
        }
        if (pollData.status === 'error' || pollData.status === 'failed') {
          throw new Error(`Evomi job falhou: ${pollData.message ?? 'unknown'}`);
        }
      }
      throw new Error('Evomi async timeout');
    }

    throw new Error(`Evomi sem conteúdo: ${JSON.stringify(data).slice(0, 120)}`);
  }

  // Extrai dados estruturados úteis e reduz HTML para ~10k tokens
  private trimHtml(html: string): string {
    const extratos: string[] = [];

    // 1. JSON-LD (dados estruturados de produto)
    const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const [, content] of jsonLdBlocks) {
      try {
        const data = JSON.parse(content);
        const obj = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'Product') : data;
        if (obj?.['@type'] === 'Product') {
          extratos.push('<!-- JSON-LD -->\n' + JSON.stringify(obj).slice(0, 8_000));
        }
      } catch { /* continua */ }
    }

    // 2. SSR data da Shein (window.gbSsrData, __INITIAL_STATE__, __NEXT_DATA__)
    const ssrPatterns = [
      /window\.gbSsrData\s*=\s*(\{[\s\S]{0,20000}?\});?\s*(?:window|<\/script>)/,
      /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]{0,20000}?\});?\s*(?:window|<\/script>)/,
      /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    ];
    for (const pattern of ssrPatterns) {
      const m = html.match(pattern);
      if (m?.[1] && extratos.length < 2) {
        extratos.push('<!-- SSR -->\n' + m[1].slice(0, 8_000));
        break;
      }
    }

    // 3. HTML limpo (sem scripts/estilos/comentários)
    const htmlLimpo = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 20_000);

    return [...extratos, htmlLimpo].join('\n\n').slice(0, 40_000);
  }

  private async extractWithClaude(html: string, url: string): Promise<Omit<ProductData, 'fonte_url' | 'fonte_site'>> {
    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: `És um extractor de produtos de e-commerce. Extrais dados de HTML de páginas de produtos e devolves JSON estruturado. Devolve APENAS JSON válido, sem explicações.`,
      messages: [{
        role: 'user',
        content: `Extrai os dados deste produto do HTML abaixo e devolve JSON com este formato exacto:
{
  "nome": "string",
  "descricao": "string ou null",
  "preco": number,
  "preco_original": number ou null,
  "moeda": "EUR",
  "imagens": ["url1", "url2"],
  "tamanhos": ["XS","S","M","L","XL"],
  "cores": ["Preto","Branco"],
  "variantes": [{"tamanho": "M", "cor": "Preto", "stock": 1}],
  "tags": [],
  "categoria": "string ou null"
}

URL do produto: ${url}

HTML:
${html}`,
      }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude returned no JSON');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      nome: parsed.nome ?? '',
      descricao: parsed.descricao ?? undefined,
      preco: Number(parsed.preco) || 0,
      preco_original: parsed.preco_original ? Number(parsed.preco_original) : undefined,
      moeda: parsed.moeda ?? 'EUR',
      imagens: Array.isArray(parsed.imagens) ? parsed.imagens : [],
      tamanhos: Array.isArray(parsed.tamanhos) ? parsed.tamanhos : [],
      cores: Array.isArray(parsed.cores) ? parsed.cores : [],
      variantes: Array.isArray(parsed.variantes) ? parsed.variantes as ProductVariant[] : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      categoria: parsed.categoria ?? undefined,
    };
  }
}
