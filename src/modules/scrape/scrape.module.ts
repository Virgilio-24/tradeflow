import { Module } from '@nestjs/common';
import { ScrapeController } from './scrape.controller';
import { ScrapeService } from './scrape.service';
import { LicenseGuard } from '../auth/auth.guard';
import { SidecarExtractor } from '../../extractors/sidecar/sidecar.extractor';
import { ExtractorFactory } from '../../extractors/factory/extractor.factory';
import { ImportWorker } from '../../workers/import.worker';
import { MailModule } from '../../mail/mail.module';
import { FirebaseModule } from '../../firebase/firebase.module';

@Module({
  imports: [MailModule, FirebaseModule],
  controllers: [ScrapeController],
  providers: [
    ScrapeService,
    LicenseGuard,
    SidecarExtractor,
    ExtractorFactory,
    ImportWorker,
  ],
})
export class ScrapeModule {}
