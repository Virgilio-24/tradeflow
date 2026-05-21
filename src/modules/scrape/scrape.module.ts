import { Module } from '@nestjs/common';
import { ScrapeController } from './scrape.controller';
import { ScrapeService } from './scrape.service';
import { LicenseGuard } from '../auth/auth.guard';
import { SheinExtractor } from '../../extractors/shein/shein.extractor';
import { ExtractorFactory } from '../../extractors/factory/extractor.factory';
import { ImportWorker } from '../../workers/import.worker';

@Module({
  controllers: [ScrapeController],
  providers: [
    ScrapeService,
    LicenseGuard,
    SheinExtractor,
    ExtractorFactory,
    ImportWorker,
  ],
})
export class ScrapeModule {}
