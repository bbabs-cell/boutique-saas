import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CAISSIER' | 'MAGASINIER';
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // `getOrThrow` et non `get(..., defaut)` : sans JWT_SECRET, l'application doit refuser de
      // démarrer plutôt que signer les tokens avec une valeur de repli connue de tous. La
      // présence de la variable est déjà vérifiée au démarrage (voir common/env.validation.ts) ;
      // c'est ici la seconde barrière.
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Le contenu du token ne fait pas foi : l'utilisateur est relu en base à chaque requête.
   * Sans cela, un employé désactivé ou rétrogradé garderait ses droits jusqu'à l'expiration
   * de son token (7 jours par défaut) — désactiver un compte n'aurait aucun effet immédiat.
   *
   * Le coût est d'une requête indexée par requête authentifiée (recherche sur la clé primaire),
   * ce qui est le prix normal d'une révocation qui prend effet tout de suite.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, active: true, tenantId: true },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException('Ce compte est désactivé ou n’existe plus.');
    }

    // Rôle et tenant proviennent de la base, pas du token : une rétrogradation prend effet
    // immédiatement, sans attendre que l'utilisateur se reconnecte.
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };
  }
}
