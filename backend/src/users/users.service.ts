import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertPlanFeature } from '../common/plan-limits';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';

const SELECT_SAFE_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: SELECT_SAFE_FIELDS,
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(tenantId: string, requesterRole: Role, dto: CreateUserDto) {
    if (dto.role === 'ADMIN' && requesterRole !== 'ADMIN') {
      throw new ForbiddenException('Seul un administrateur peut créer un compte administrateur.');
    }
    if (dto.role === 'MANAGER' || dto.role === 'MAGASINIER') {
      await assertPlanFeature(this.prisma, tenantId, 'fineRoles');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet e-mail.');
    }

    // Un ADMIN voit toutes les boutiques de son organisation sans affectation explicite
    // (voir AuthService.getAccessibleStores) : seuls les autres rôles ont besoin d'une
    // affectation, sans laquelle ils sont bloqués sur la moindre action.
    const storeIds = dto.role === 'ADMIN' ? [] : await this.resolveStoreIds(tenantId, dto);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        tenantId,
        userStores: { create: storeIds.map((storeId) => ({ storeId })) },
      },
      select: SELECT_SAFE_FIELDS,
    });
  }

  /**
   * Détermine les boutiques du nouvel employé, et vérifie qu'elles appartiennent bien à
   * l'organisation. Sans boutique explicite, on retombe sur l'unique boutique du tenant ;
   * s'il y en a plusieurs, on refuse plutôt que de créer un compte inutilisable.
   */
  private async resolveStoreIds(tenantId: string, dto: CreateUserDto): Promise<string[]> {
    const requested = dto.storeIds ?? (dto.storeId ? [dto.storeId] : []);

    if (requested.length > 0) {
      const stores = await this.prisma.store.findMany({
        where: { id: { in: requested }, tenantId },
        select: { id: true },
      });
      if (stores.length !== new Set(requested).size) {
        throw new BadRequestException("Une des boutiques indiquées n'appartient pas à cette organisation.");
      }
      return stores.map((store) => store.id);
    }

    const tenantStores = await this.prisma.store.findMany({ where: { tenantId }, select: { id: true } });
    if (tenantStores.length === 1) {
      return [tenantStores[0].id];
    }
    throw new BadRequestException(
      'Précisez la ou les boutiques de cet employé : sélectionnez une boutique active avant de le créer, ' +
        'sinon son compte ne pourra accéder à rien.',
    );
  }

  async setActive(tenantId: string, userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('Employé introuvable.');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { active: dto.active },
      select: SELECT_SAFE_FIELDS,
    });
  }
}
