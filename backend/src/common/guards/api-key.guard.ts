import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { PrismaService } from '../../prisma/prisma.service';
import { hashApiKey } from '../api-key.util';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Un seul guard pour l'API REST publique (Sprint 11) ET l'API GraphQL (Sprint 13) : même
    // authentification par clé API, sans dupliquer la logique. Le contexte d'exécution diffère
    // selon le type de requête, donc on récupère la requête HTTP sous-jacente différemment.
    const req =
      context.getType<'http' | 'graphql'>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();

    const rawKey = req.headers['x-api-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      throw new UnauthorizedException('Clé API manquante (en-tête X-API-Key).');
    }

    const keyHash = hashApiKey(rawKey);
    const apiKey = await this.prisma.apiKey.findUnique({ where: { keyHash } });
    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('Clé API invalide ou révoquée.');
    }

    req.tenantId = apiKey.tenantId;

    // Mise à jour du dernier usage en tâche de fond : ne doit jamais ralentir la requête.
    this.prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return true;
  }
}
