import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PublicApiService } from './public-api.service';
import { PublicApiController } from './public-api.controller';

@Module({
  imports: [
    // Rate limiting dédié à l'API publique : 60 requêtes/minute par défaut, indépendant de
    // l'API interne (qui n'a pas de limite de débit à ce jour).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 60 }]),
  ],
  controllers: [PublicApiController],
  providers: [PublicApiService],
  exports: [PublicApiService],
})
export class PublicApiModule {}
