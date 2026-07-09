import { Injectable, Logger } from '@nestjs/common';
import { Extractor } from '../base/extractor.interface';
import { SidecarExtractor } from '../sidecar/sidecar.extractor';
import { ClaudeExtractor } from '../claude/claude.extractor';
import { MarketplaceSource } from '../../common/types';

@Injectable()
export class ExtractorFactory {
  private readonly logger = new Logger(ExtractorFactory.name);
  private readonly extractors: Extractor[];

  constructor(private sidecar: SidecarExtractor, private claude: ClaudeExtractor) {
    // Claude é o último fallback — aceita qualquer URL
    this.extractors = [sidecar, claude];
  }

  getExtractor(url: string): Extractor {
    const extractor = this.extractors.find(e => e.canHandle(url));
    if (!extractor) throw new Error(`No extractor available for: ${url}`);
    const source = extractor.sourceForUrl?.(url) ?? extractor.source;
    this.logger.debug(`Using ${source} extractor for ${url}`);
    return extractor;
  }

  detectSource(url: string): MarketplaceSource | null {
    const extractor = this.extractors.find(e => e.canHandle(url));
    return extractor?.sourceForUrl?.(url) ?? extractor?.source ?? null;
  }

  getSupportedSources(): MarketplaceSource[] {
    return this.extractors.flatMap(e =>
      e.sourceForUrl ? [] : [e.source],
    );
  }
}
