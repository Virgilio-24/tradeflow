import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { FirebaseModule } from '../../firebase/firebase.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [FirebaseModule, MailModule],
  controllers: [StripeController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
