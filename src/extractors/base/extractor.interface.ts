import { Page } from 'playwright';
import { MarketplaceSource, ProductData } from '../../common/types';

export interface Extractor {
  readonly source: MarketplaceSource;
  canHandle(url: string): boolean;
  extract(url: string, page: Page): Promise<ProductData>;
}
