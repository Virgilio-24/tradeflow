import { Injectable, Logger } from '@nestjs/common';
import { Extractor } from '../base/extractor.interface';
import { SheinExtractor } from '../shein/shein.extractor';
import { MarketplaceSource } from '../../common/types';

@Injectable()
export class ExtractorFactory {
  private readonly logger = new Logger(ExtractorFactory.name);
  private readonly extractors: Extractor[];

  constructor(private shein: SheinExtractor) {
    this.extractors = [shein];
  }

  getExtractor(url: string): Extractor {
    const extractor = this.extractors.find(e => e.canHandle(url));
    if (!extractor) {
      throw new Error(`No extractor available for: ${url}`);
    }
    this.logger.debug(`Using ${extractor.source} extractor for ${url}`);
    return extractor;
  }

  detectSource(url: string): MarketplaceSource | null {
    const extractor = this.extractors.find(e => e.canHandle(url));
    return extractor?.source ?? null;
  }

  getSupportedSources(): MarketplaceSource[] {
    return this.extractors.map(e => e.source);
  }
}
