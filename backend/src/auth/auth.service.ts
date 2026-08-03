import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TwoFactorService } from './two-factor.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private twoFactorService: TwoFactorService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.shopName,
        users: {
          create: {
            email: dto.email,
            passwordHash,
            name: dto.adminName,
            role: 'ADMIN',
          },
        },
        // Une boutique par défaut est créée avec le tenant : la caisse et le stock
        // ont toujours besoin d'au moins une boutique pour fonctionner.
        stores: {
          create: { name: dto.shopName },
        },
      },
      include: { users: true, stores: true },
    });

    const admin = tenant.users[0];
    const store = tenant.stores[0];
    await this.prisma.userStore.create({ data: { userId: admin.id, storeId: store.id } });

    return this.buildAuthResponse(admin.id, admin.email, admin.role, admin.name, admin.theme, tenant, [store]);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Identifiants incorrects.');
    }

    if (user.twoFactorEnabled) {
      if (!dto.code) {
        // Mot de passe correct, mais le 2FA est activé : le front doit redemander le code
        // sans redélivrer de token tant qu'il n'est pas vérifié.
        return { requiresTwoFactor: true };
      }
      const codeValid = this.twoFactorService.verifyLoginCode(user.twoFactorSecret!, dto.code);
      if (!codeValid) {
        throw new UnauthorizedException('Code de vérification incorrect.');
      }
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    const stores = await this.getAccessibleStores(tenant.id, user.id, user.role);

    return this.buildAuthResponse(user.id, user.email, user.role, user.name, user.theme, tenant, stores, user.twoFactorEnabled);
  }

  // Le JWT est sans état : la déconnexion se fait côté client en supprimant le token.
  // Cette route existe pour un usage cohérent côté front (et une future liste de révocation).
  logout() {
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        tenantId: true,
        theme: true,
        twoFactorEnabled: true,
        tenant: {
          select: {
            id: true,
            name: true,
            currency: true,
            tvaEnabled: true,
            tvaRate: true,
            logoUrl: true,
            language: true,
          },
        },
      },
    });
    const stores = await this.getAccessibleStores(user.tenantId, user.id, user.role);
    return { ...user, stores };
  }

  /** Les boutiques accessibles à l'utilisateur — toutes celles du tenant pour un ADMIN, sinon celles assignées. */
  private async getAccessibleStores(tenantId: string, userId: string, role: string) {
    if (role === 'ADMIN') {
      return this.prisma.store.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
    }
    const userStores = await this.prisma.userStore.findMany({
      where: { userId },
      include: { store: true },
    });
    return userStores.map((us) => us.store);
  }

  private buildAuthResponse(
    userId: string,
    email: string,
    role: string,
    name: string,
    theme: string,
    tenant: {
      id: string;
      name: string;
      tvaEnabled: boolean;
      tvaRate: number;
      logoUrl: string | null;
      language: string;
    },
    stores: { id: string; name: string }[],
    twoFactorEnabled = false,
  ) {
    const accessToken = this.jwt.sign({ sub: userId, email, role, tenantId: tenant.id });
    return {
      accessToken,
      user: {
        id: userId,
        email,
        name,
        role,
        theme,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tvaEnabled: tenant.tvaEnabled,
        tvaRate: tenant.tvaRate,
        logoUrl: tenant.logoUrl,
        language: tenant.language,
        twoFactorEnabled,
      },
      // Si une seule boutique est accessible, le front s'y connecte directement.
      // Si plusieurs, il doit proposer un sélecteur avant de continuer.
      stores: stores.map((s) => ({ id: s.id, name: s.name })),
      defaultStoreId: stores.length === 1 ? stores[0].id : null,
    };
  }
}
