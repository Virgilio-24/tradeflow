import { Module } from '@nestjs/common';
import { ScrapeController } from './scrape.controller';
import { ScrapeService } from './scrape.service';
import { LicenseGuard } from '../auth/auth.guard';
import { SidecarExtractor } from '../../extractors/sidecar/sidecar.extractor';
import { ClaudeExtractor } from '../../extractors/claude/claude.extractor';
import { ExtractorFactory } from '../../extractors/factory/extractor.factory';
import { ImportWorker } from '../../workers/import.worker';

@Module({
  controllers: [ScrapeController],
  providers: [
    ScrapeService,
    LicenseGuard,
    SidecarExtractor,
    ClaudeExtractor,
    ExtractorFactory,
    ImportWorker,
  ],
})
export class ScrapeModule {}
