import { Module } from '@nestjs/common';
import { PublicApiService } from './public-api.service';
import { PublicApiController } from './public-api.controller';

@Module({
  // La configuration du rate limiting vit dans AppModule : `ThrottlerModule.forRoot()` crée un
  // module global, en déclarer un second ici entrerait en conflit avec celui de l'application.
  // La limite propre à l'API publique reste exprimée sur le contrôleur, via @Throttle.
  controllers: [PublicApiController],
  providers: [PublicApiService],
  exports: [PublicApiService],
})
export class PublicApiModule {}
