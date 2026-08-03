import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignUserDto, CreateStoreDto, UpdateStoreDto } from './dto/stores.dto';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.store.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: { userStores: { include: { user: { select: { id: true, name: true, role: true } } } } },
    });
  }

  create(tenantId: string, dto: CreateStoreDto) {
    return this.prisma.store.create({
      data: { tenantId, name: dto.name, address: dto.address ?? null },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateStoreDto) {
    await this.assertExists(tenantId, id);
    return this.prisma.store.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
      },
    });
  }

  async assignUser(tenantId: string, storeId: string, dto: AssignUserDto) {
    await this.assertExists(tenantId, storeId);

    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, tenantId } });
    if (!user) {
      throw new BadRequestException("Cet employé n'appartient pas à cette organisation.");
    }

    return this.prisma.userStore.upsert({
      where: { userId_storeId: { userId: dto.userId, storeId } },
      update: {},
      create: { userId: dto.userId, storeId },
    });
  }

  async unassignUser(tenantId: string, storeId: string, userId: string) {
    await this.assertExists(tenantId, storeId);
    await this.prisma.userStore.deleteMany({ where: { userId, storeId } });
    return { success: true };
  }

  private async assertExists(tenantId: string, id: string) {
    const store = await this.prisma.store.findFirst({ where: { id, tenantId } });
    if (!store) {
      throw new NotFoundException('Boutique introuvable.');
    }
    return store;
  }
}
