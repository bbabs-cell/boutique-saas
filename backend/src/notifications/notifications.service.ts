import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQueryDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, userId: string, query: ListNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      tenantId,
      OR: [{ userId: null }, { userId }],
      ...(query.read !== undefined ? { read: query.read } : {}),
    };

    const [items, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        // Non lues en premier, puis les plus récentes.
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { tenantId, OR: [{ userId: null }, { userId }], read: false } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize) || 1,
    };
  }

  async markRead(tenantId: string, userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, tenantId, OR: [{ userId: null }, { userId }] },
    });
    if (!notification) {
      throw new NotFoundException('Notification introuvable.');
    }
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(tenantId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, OR: [{ userId: null }, { userId }], read: false },
      data: { read: true },
    });
    return { updated: result.count };
  }
}
