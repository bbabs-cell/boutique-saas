import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Protège les routes réservées à l'opérateur de la plateforme (toi, en tant qu'éditeur du SaaS) —
 * jamais un tenant, même ADMIN. Volontairement séparé du JwtAuthGuard/RolesGuard habituels :
 * un tenant ADMIN ne doit structurellement avoir aucun moyen de confirmer son propre paiement.
 * Nécessite la variable d'environnement PLATFORM_ADMIN_SECRET (voir .env.example).
 */
@Injectable()
export class PlatformSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided = req.headers['x-platform-secret'];
    const expected = process.env.PLATFORM_ADMIN_SECRET;

    if (!expected) {
      // Pas de secret configuré : on refuse plutôt que d'accepter par défaut (fail closed).
      throw new UnauthorizedException(
        "PLATFORM_ADMIN_SECRET n'est pas configuré côté serveur — cette route est désactivée.",
      );
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Secret opérateur invalide.');
    }
    return true;
  }
}
