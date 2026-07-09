import { Injectable, Logger } from '@nestjs/common';
import { Page } from 'playwright';
import { Extractor } from '../base/extractor.interface';
import { ProductData, ProductVariant } from '../../common/types';

@Injectable()
export class SheinExtractor implements Extractor {
  readonly source = 'shein' as const;
  private readonly logger = new Logger(SheinExtractor.name);

  canHandle(url: string): boolean {
    return url.includes('shein.com') || url.includes('shein.pt');
  }

  async extract(url: string, page: Page): Promise<ProductData> {
    const sidecarUrl = process.env.SIDECAR_URL;

    // ── 1. Sidecar (estratégia principal) ──
    if (sidecarUrl) {
      try {
        const data = await this.callSidecar(sidecarUrl, url);
        this.logger.log(`Shein: sidecar ok — "${(data.title ?? '').slice(0, 60)}"`);
        return this.normalizeSidecarData(data, url);
      } catch (err: any) {
        this.logger.warn(`Sidecar failed: ${err.message}`);
      }
    } else {
      this.logger.warn('SIDECAR_URL not set — falling back to direct browser');
    }

    // ── 2. Fallback: browser directo (intercepção BFF) ──
    return this.extractWithBrowser(url, page);
  }

  private async callSidecar(sidecarUrl: string, url: string): Promise<any> {
    const encoded = encodeURIComponent(url);
    const headers: Record<string, string> = {};
    const apiKey = process.env.SIDECAR_API_KEY;
    if (apiKey) headers['X-API-Key'] = apiKey;

    const res = await fetch(`${sidecarUrl}/api/product?url=${encoded}`, {
      headers,
      signal: AbortSignal.timeout(60_000),
    });

    if (res.status === 502) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Sidecar blocked by upstream: ${body.message ?? 'unknown'}`);
    }

    if (!res.ok) {
      throw new Error(`Sidecar HTTP ${res.status}`);
    }

    const body = await res.json();
    if (body.status !== 'ok' || !body.data) {
      throw new Error(`Sidecar returned status=${body.status}`);
    }

    if (!body.data.title && !body.data.goodsId) {
      throw new Error('Sidecar returned empty product data');
    }

    return body.data;
  }

  private normalizeSidecarData(data: any, url: string): ProductData {
    const preco = parseFloat(String(data.price?.amount ?? '0')) || 0;
    const precoOriginal = parseFloat(String(data.price?.retailAmount ?? '0')) || 0;

    const tamanhos: string[] = (data.sizes ?? []).filter(Boolean);
    const cores: string[] = (data.colors ?? []).filter(Boolean);
    const imagens: string[] = (data.images ?? []).filter(Boolean).slice(0, 8);
    const variantes = this.buildVariants(tamanhos, cores);

    const result: ProductData = {
      nome: data.title ?? '',
      preco,
      moeda: 'EUR',
      imagens,
      variantes,
      tamanhos,
      cores,
      tags: [],
      fonte_url: url,
      fonte_site: 'shein',
    };

    if (precoOriginal > preco) result.preco_original = precoOriginal;

    return result;
  }

  // ── Fallback browser (usado quando SIDECAR_URL não está definido) ──

  private async extractWithBrowser(url: string, page: Page): Promise<ProductData> {
    let capturedData: any = null;

    await page.route('**/bff-api/product/get_goods_detail_realtime_data**', async (route) => {
      try {
        const response = await route.fetch();
        const json = await response.json();
        const info = json?.info ?? json?.data;
        if (info?.goods_name || info?.goodsName) {
          capturedData = info;
          this.logger.log('BFF realtime_data intercepted');
        }
        await route.continue();
      } catch { await route.continue(); }
    });

    await page.route('**/bff-api/**', async (route) => {
      try {
        const response = await route.fetch();
        const ct = response.headers()['content-type'] ?? '';
        if (ct.includes('json') && !capturedData) {
          const json = await response.json();
          const found = this.findProductInJson(json);
          if (found) {
            capturedData = found;
            this.logger.log(`BFF captured: ${route.request().url().split('/').slice(-1)[0].split('?')[0]}`);
          }
        }
        await route.continue();
      } catch { await route.continue(); }
    });

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    } catch (err: any) {
      if (!err.message?.includes('Timeout')) throw err;
    }

    try {
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 8_000 });
    } catch { /* ignorar */ }
    await page.waitForTimeout(3000 + Math.random() * 2000);

    const pageTitle = await page.title().catch(() => '');
    const finalUrl = page.url();
    this.logger.log(`Browser page: "${pageTitle.slice(0, 60)}" — ${finalUrl.split('?')[0]}`);

    if (capturedData) {
      return this.normalizeFromBff(capturedData, url);
    }

    this.logger.warn(`Browser fallback: no BFF data for ${url.split('?')[0].split('/').pop()}`);
    const meta = await page.evaluate(() => ({
      title: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? document.title ?? '',
      description: document.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? '',
      image: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
    })).catch(() => ({ title: '', description: '', image: '' }));

    return {
      nome: meta.title,
      descricao: meta.description,
      preco: 0,
      moeda: 'EUR',
      imagens: meta.image ? [meta.image] : [],
      variantes: [],
      tamanhos: [],
      cores: [],
      tags: [],
      fonte_url: url,
      fonte_site: 'shein',
    };
  }

  private findProductInJson(obj: any, depth = 0): any {
    if (depth > 6 || !obj || typeof obj !== 'object') return null;
    if ((obj.goods_name || obj.goodsName) && (obj.goods_imgs || obj.goodsImgs || obj.salePrice || obj.priceInfo)) return obj;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      const found = this.findProductInJson(val, depth + 1);
      if (found) return found;
    }
    return null;
  }

  private normalizeFromBff(data: any, url: string): ProductData {
    const preco = parseFloat(String(data.salePrice?.amount ?? data.sale_price?.amount ?? '0')) || 0;
    const precoOriginal = parseFloat(String(data.retailPrice?.amount ?? data.retail_price?.amount ?? '0')) || 0;

    const imgList = data.goods_imgs ?? data.goodsImgs ?? data.images ?? [];
    const imagens: string[] = imgList
      .map((i: any) => { const s = typeof i === 'string' ? i : (i.origin_image ?? i.originImage ?? i.medium_image ?? ''); return s.startsWith('//') ? 'https:' + s : s; })
      .filter(Boolean).slice(0, 8);

    const tamanhos: string[] = (data.attrSizeList ?? data.sizeAttrList ?? [])
      .map((s: any) => s.attr_value_name ?? s.attrValueName ?? s.attr_value ?? '').filter(Boolean);
    const cores: string[] = (data.colorList ?? data.color_list ?? [])
      .map((c: any) => c.color_name ?? c.colorName ?? '').filter(Boolean);

    const result: ProductData = {
      nome: data.goods_name ?? data.goodsName ?? '',
      preco,
      moeda: data.salePrice?.currency ?? 'EUR',
      imagens,
      variantes: this.buildVariants(tamanhos, cores),
      tamanhos,
      cores,
      tags: [],
      fonte_url: url,
      fonte_site: 'shein',
    };

    if (precoOriginal > preco) result.preco_original = precoOriginal;
    const descricao = data.goods_desc ?? data.goodsDesc ?? '';
    if (descricao) result.descricao = descricao;
    const categoria = data.cat_name ?? data.catName ?? '';
    if (categoria) result.categoria = categoria;

    return result;
  }

  private buildVariants(tamanhos: string[], cores: string[]): ProductVariant[] {
    if (!tamanhos.length && !cores.length) return [];
    if (tamanhos.length && !cores.length) return tamanhos.map(t => ({ tamanho: t, stock: 1 }));
    if (!tamanhos.length && cores.length) return cores.map(c => ({ cor: c, stock: 1 }));
    return tamanhos.flatMap(t => cores.map(c => ({ tamanho: t, cor: c, stock: 1 })));
  }
}
