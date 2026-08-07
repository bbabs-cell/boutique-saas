import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Route de santé, volontairement publique et sans authentification : c'est l'hébergeur qui
 * l'appelle, avant même qu'un utilisateur existe. Railway s'en sert pour décider si un
 * déploiement a réussi — sans elle, un conteneur qui démarre mais ne joint pas sa base serait
 * considéré comme sain et remplacerait la version précédente, qui elle fonctionnait.
 *
 * Elle interroge réellement la base : un backend qui répond mais ne peut rien lire n'est pas
 * en bonne santé, et c'est précisément la panne que ce contrôle doit attraper.
 */
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // 503 et non 500 : la nuance compte pour l'hébergeur, qui doit comprendre « pas encore
      // prêt, réessaie » plutôt que « cette version est cassée ».
      throw new ServiceUnavailableException({
        status: 'degraded',
        database: 'unreachable',
      });
    }

    return { status: 'ok', database: 'ok', timestamp: new Date().toISOString() };
  }
}
