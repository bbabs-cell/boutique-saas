import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
