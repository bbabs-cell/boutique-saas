import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: dto.role,
        tenantId,
      },
      select: SELECT_SAFE_FIELDS,
    });
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
