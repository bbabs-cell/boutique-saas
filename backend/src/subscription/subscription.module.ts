import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { SubscriptionController } from './subscription.controller';

@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, SubscriptionExpiryService],
})
export class SubscriptionModule {}
