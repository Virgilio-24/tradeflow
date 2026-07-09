import { Page } from 'playwright';
import { MarketplaceSource, ProductData } from '../../common/types';

export interface Extractor {
  readonly source: MarketplaceSource;
  canHandle(url: string): boolean;
  extract(url: string, page: Page, options?: { proxyUrls?: string[] }): Promise<ProductData>;
  sourceForUrl?(url: string): MarketplaceSource | undefined;
}
