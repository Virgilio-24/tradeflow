import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { Extractor } from '../base/extractor.interface';
import { ProductData, MarketplaceSource, ProductVariant } from '../../common/types';
import { FirebaseService } from '../../firebase/firebase.service';

const SIDECAR_BRANDS: Record<string, MarketplaceSource> = {
  'shein.com':        'shein',
  'shein.pt':         'shein',
  'temu.com':         'temu',
  'zara.com':         'zara',
  'hm.com':           'hm',
  'zalando.pt':       'zalando',
  'zalando.es':       'zalando',
  'zalando.de':       'zalando',
  'zalando.co.uk':    'zalando',
  'zalando.fr':       'zalando',
  'zalando.it':       'zalando',
  'amazon.es':        'amazon',
  'amazon.de':        'amazon',
  'amazon.co.uk':     'amazon',
  'amazon.fr':        'amazon',
  'amazon.it':        'amazon',
  'pullandbear.com':  'pullandbear',
  'bershka.com':      'bershka',
  'aboutyou.com':     'aboutyou',
};

@Injectable()
export class SidecarExtractor implements Extractor {
  readonly source: MarketplaceSource = 'shein';
  private readonly logger = new Logger(SidecarExtractor.name);

  constructor(private firebase: FirebaseService) {}

  canHandle(url: string): boolean {
    return !!this.sourceForUrl(url);
  }

  sourceForUrl(url: string): MarketplaceSource | undefined {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      for (const [domain, source] of Object.entries(SIDECAR_BRANDS)) {
        if (hostname === domain || hostname.endsWith('.' + domain)) return source;
      }
    } catch { /* URL inválido */ }
    return undefined;
  }

  async extract(url: string, page: Page, options?: { proxyUrls?: string[] }): Promise<ProductData> {
    const sidecarUrl = process.env.SIDECAR_URL;
    const fonte = this.sourceForUrl(url) ?? 'shein';

    if (!sidecarUrl) {
      throw new Error(`SIDECAR_URL not configured — cannot extract ${fonte} product`);
    }

    const domain = new URL(url).hostname.replace(/^www\./, '');
    const cookieString = await this.firebase.getSiteCookies(domain);
    const data = await this.callSidecar(sidecarUrl, url, options?.proxyUrls, cookieString ?? undefined);
    this.logger.log(`Sidecar ok [${data._meta?.sourceChain?.[0] ?? 'unknown'}] — "${(data.title ?? '').slice(0, 60)}"`);
    return this.normalize(data, url, fonte);
  }

  private async callSidecar(sidecarUrl: string, url: string, proxyUrls?: string[], cookieString?: string): Promise<any> {
    const encoded = encodeURIComponent(url);
    let endpoint = `${sidecarUrl}/api/product/auto?url=${encoded}`;
    if (proxyUrls && proxyUrls.length > 0) {
      endpoint += `&proxies=${encodeURIComponent(proxyUrls.join(','))}`;
    }
    const headers: Record<string, string> = {};
    const apiKey = process.env.SIDECAR_API_KEY;
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (cookieString) headers['Cookie'] = cookieString;

    const res = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(60_000),
    });

    if (res.status === 502) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Blocked by upstream: ${body.message ?? 'unknown'}`);
    }
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Sidecar rejected URL: ${body.message ?? 'unsupported'}`);
    }
    if (!res.ok) {
      throw new Error(`Sidecar HTTP ${res.status}`);
    }

    const body = await res.json();
    if (body.status !== 'ok' || !body.data) {
      throw new Error(`Sidecar status=${body.status}`);
    }
    if (!body.data.title && !body.data.id) {
      throw new Error('Sidecar returned empty product data');
    }

    return body.data;
  }

  private normalize(data: any, url: string, fonte: MarketplaceSource): ProductData {
    const preco = parseFloat(String(data.price?.amount ?? '0')) || 0;
    const precoOriginal = parseFloat(String(data.price?.retailAmount ?? '0')) || 0;

    const tamanhos: string[] = (data.sizes ?? []).filter(Boolean);
    const cores: string[] = (data.colors ?? []).filter(Boolean);
    const imagens: string[] = (data.images ?? []).filter(Boolean).slice(0, 8);

    const result: ProductData = {
      nome: data.title ?? '',
      preco,
      moeda: 'EUR',
      imagens,
      variantes: this.buildVariants(tamanhos, cores),
      tamanhos,
      cores,
      tags: [],
      fonte_url: data.url ?? url,
      fonte_site: fonte,
    };

    if (precoOriginal > preco) result.preco_original = precoOriginal;
    if (data.description) result.descricao = data.description;

    return result;
  }

  private buildVariants(tamanhos: string[], cores: string[]): ProductVariant[] {
    if (!tamanhos.length && !cores.length) return [];
    if (tamanhos.length && !cores.length) return tamanhos.map(t => ({ tamanho: t, stock: 1 }));
    if (!tamanhos.length && cores.length) return cores.map(c => ({ cor: c, stock: 1 }));
    return tamanhos.flatMap(t => cores.map(c => ({ tamanho: t, cor: c, stock: 1 })));
  }
}
