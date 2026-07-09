import { Module } from '@nestjs/common';
import { RegistarController } from './registar.controller';
import { AdminModule } from '../admin/admin.module';
import { FirebaseModule } from '../../firebase/firebase.module';
import { MailModule } from '../../mail/mail.module';

@Module({
  imports: [AdminModule, FirebaseModule, MailModule],
  controllers: [RegistarController],
})
export class RegistarModule {}
