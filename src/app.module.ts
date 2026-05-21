import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FirebaseModule } from './firebase/firebase.module';
import { BrowserModule } from './browser/browser.module';
import { ScrapeModule } from './modules/scrape/scrape.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    FirebaseModule,
    BrowserModule,
    ScrapeModule,
    AdminModule,
  ],
})
export class AppModule {}
