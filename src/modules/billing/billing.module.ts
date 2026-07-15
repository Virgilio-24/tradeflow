import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { FirebaseModule } from '../../firebase/firebase.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [FirebaseModule, MailModule],
  providers: [BillingService],
})
export class BillingModule {}
