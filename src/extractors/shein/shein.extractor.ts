import { Injectable, Logger } from '@nestjs/common';
import { Page, Route } from 'playwright';
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
    let capturedData: any = null;
    let capturedImages: string[] = [];

    // ── 1. Interceptar chamadas à API interna da Shein ──
    // Mais fiável do que parse de HTML — apanha o JSON real
    await page.route('**/api/productInfo/v3/**', async (route: Route) => {
      try {
        const response = await route.fetch();
        const json = await response.json();
        if (json?.info || json?.data?.info) {
          capturedData = json.info ?? json.data?.info ?? json.data;
          this.logger.debug(`Shein API intercepted: ${Object.keys(capturedData).join(', ')}`);
        }
        await route.continue();
      } catch {
        await route.continue();
      }
    });

    // Interceptar pedidos de imagens do CDN para colecionar URLs
    await page.route('**/img.ltwebstatic.com/**', async (route: Route) => {
      const req = route.request();
      const imgUrl = req.url();
      if (imgUrl.match(/\.(jpg|jpeg|webp|png)/i) && !imgUrl.includes('/60/') && !imgUrl.includes('/80/')) {
        capturedImages.push(imgUrl);
      }
      await route.continue();
    });

    // ── 2. Navegar para a página ──
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Delay aleatório — comportamento humano
    await page.waitForTimeout(1000 + Math.random() * 1500);

    // ── 3. Se a API foi interceptada, normalizar directamente ──
    if (capturedData) {
      return this.normalizeFromApi(capturedData, url, capturedImages);
    }

    // ── 4. Fallback: extrair do DOM renderizado ──
    this.logger.warn(`Shein API not intercepted for ${url}, falling back to DOM`);
    return this.extractFromDom(page, url);
  }

  private normalizeFromApi(data: any, url: string, extraImages: string[]): ProductData {
    // Preço
    const preco = parseFloat(data.salePrice?.amount ?? data.retailPrice?.amount ?? '0');
    const precoOriginal = parseFloat(data.retailPrice?.amount ?? '0');

    // Imagens — preferir da API, complementar com interceptadas
    const apiImages: string[] = (data.goods_imgs ?? data.images ?? [])
      .map((i: any) => {
        const src = typeof i === 'string' ? i : (i.origin_image ?? i.medium_image ?? i.thumbnail ?? '');
        return src.startsWith('//') ? 'https:' + src : src;
      })
      .filter(Boolean);

    const allImages = [...new Set([...apiImages, ...extraImages])].slice(0, 8);

    // Variantes (tamanhos/cores)
    const tamanhos: string[] = (data.attrSizeList ?? data.sizeAttrList ?? [])
      .map((s: any) => s.attr_value_name ?? s.attr_value ?? s.name ?? '')
      .filter(Boolean);

    const cores: string[] = (data.colorList ?? data.color_list ?? [])
      .map((c: any) => c.color_name ?? c.goods_color_name ?? '')
      .filter(Boolean);

    const variantes: ProductVariant[] = this.buildVariants(tamanhos, cores);

    const tags: string[] = (data.productTagInfoList ?? data.tag_list ?? [])
      .map((t: any) => t.tagName ?? t.tag_name ?? '')
      .filter(Boolean);

    return {
      nome: data.goods_name ?? '',
      descricao: data.goods_desc ?? '',
      preco,
      preco_original: precoOriginal > preco ? precoOriginal : undefined,
      moeda: 'USD',
      imagens: allImages,
      variantes,
      tamanhos,
      cores,
      tags,
      categoria: data.cat_name ?? '',
      fonte_url: url,
      fonte_site: 'shein',
      raw_data: data,
    };
  }

  private async extractFromDom(page: Page, url: string): Promise<ProductData> {
    const data = await page.evaluate(() => {
      // Tentar encontrar dados em variáveis globais
      const win = window as any;
      const sources = [
        win.gbSsrData,
        win.SaPageInfo,
        win.__INITIAL_STATE__,
        win.gbRawData,
      ];

      for (const src of sources) {
        if (!src) continue;
        const found = findProduct(src, 0);
        if (found) return found;
      }

      function findProduct(obj: any, depth: number): any {
        if (depth > 6 || !obj || typeof obj !== 'object') return null;
        if (obj.goods_name && (obj.goods_imgs || obj.salePrice)) return obj;
        if (obj.detail?.goods_name) return obj.detail;
        for (const key of Object.keys(obj)) {
          if (Array.isArray(obj[key])) continue;
          const found = findProduct(obj[key], depth + 1);
          if (found) return found;
        }
        return null;
      }

      return null;
    });

    if (data) {
      return this.normalizeFromApi(data, url, []);
    }

    // Último recurso — meta tags
    const meta = await this.extractMeta(page);
    return {
      nome: meta.title,
      descricao: meta.description,
      preco: 0,
      moeda: 'USD',
      imagens: meta.image ? [meta.image] : [],
      variantes: [],
      tamanhos: [],
      cores: [],
      tags: [],
      fonte_url: url,
      fonte_site: 'shein',
    };
  }

  private async extractMeta(page: Page) {
    return page.evaluate(() => ({
      title: document.querySelector('meta[property="og:title"]')
        ?.getAttribute('content') ?? document.title ?? '',
      description: document.querySelector('meta[property="og:description"]')
        ?.getAttribute('content') ?? '',
      image: document.querySelector('meta[property="og:image"]')
        ?.getAttribute('content') ?? '',
    }));
  }

  private buildVariants(tamanhos: string[], cores: string[]): ProductVariant[] {
    if (!tamanhos.length && !cores.length) return [];
    if (tamanhos.length && !cores.length) {
      return tamanhos.map(t => ({ tamanho: t, stock: 1 }));
    }
    if (!tamanhos.length && cores.length) {
      return cores.map(c => ({ cor: c, stock: 1 }));
    }
    // Combinação tamanho × cor
    return tamanhos.flatMap(t =>
      cores.map(c => ({ tamanho: t, cor: c, stock: 1 }))
    );
  }
}
