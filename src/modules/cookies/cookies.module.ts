import { Module } from '@nestjs/common';
import { CookiesController } from './cookies.controller';
import { FirebaseModule } from '../../firebase/firebase.module';

@Module({
  imports: [FirebaseModule],
  controllers: [CookiesController],
})
export class CookiesModule {}
