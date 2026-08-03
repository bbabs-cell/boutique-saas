import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { generateApiKey } from '../common/api-key.util';
import { CreateApiKeyDto } from './dto/api-keys.dto';

const SAFE_FIELDS = {
  id: true,
  name: true,
  lastUsedAt: true,
  createdAt: true,
  revokedAt: true,
} as const;

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  findAll(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      select: SAFE_FIELDS,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(tenantId: string, dto: CreateApiKeyDto) {
    const { plainKey, keyHash } = generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: { tenantId, name: dto.name, keyHash },
      select: SAFE_FIELDS,
    });

    // La clé en clair n'est retournée qu'une seule fois, à la création : elle n'est jamais
    // stockée ni récupérable ensuite (seul son hash SHA-256 est conservé).
    return { ...apiKey, plainKey };
  }

  async revoke(tenantId: string, id: string) {
    const apiKey = await this.prisma.apiKey.findFirst({ where: { id, tenantId } });
    if (!apiKey) {
      throw new NotFoundException('Clé API introuvable.');
    }
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: SAFE_FIELDS,
    });
  }
}
