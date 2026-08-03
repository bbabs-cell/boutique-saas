import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/webhooks.dto';

const SAFE_FIELDS = {
  id: true,
  url: true,
  events: true,
  active: true,
  createdAt: true,
} as const;

@Injectable()
export class WebhooksService {
  constructor(private prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.webhook.findMany({
      where: { tenantId },
      select: SAFE_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateWebhookDto) {
    const secret = randomBytes(24).toString('hex');

    const webhook = await this.prisma.webhook.create({
      data: { tenantId, url: dto.url, events: dto.events, secret },
      select: SAFE_FIELDS,
    });

    // Le secret n'est retourné qu'à la création : il sert à l'intégrateur pour vérifier la
    // signature HMAC des appels reçus, et n'est plus jamais réaffiché ensuite.
    return { ...webhook, secret };
  }

  async remove(tenantId: string, id: string) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id, tenantId } });
    if (!webhook) {
      throw new NotFoundException('Webhook introuvable.');
    }
    await this.prisma.webhook.delete({ where: { id } });
    return { success: true };
  }
}
