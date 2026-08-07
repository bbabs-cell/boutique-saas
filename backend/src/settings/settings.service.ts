import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_LOGO_SIZE_BYTES } from '../common/upload-limits';
import { SupabaseStorageService } from './supabase-storage.service';
import { UpdateSettingsDto } from './dto/settings.dto';

const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private storage: SupabaseStorageService,
  ) {}

  getSettings(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        currency: true,
        tvaEnabled: true,
        tvaRate: true,
        logoUrl: true,
        language: true,
      },
    });
  }

  updateSettings(tenantId: string, dto: UpdateSettingsDto) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.tvaEnabled !== undefined ? { tvaEnabled: dto.tvaEnabled } : {}),
        ...(dto.tvaRate !== undefined ? { tvaRate: dto.tvaRate } : {}),
        ...(dto.language !== undefined ? { language: dto.language } : {}),
      },
      select: {
        id: true,
        name: true,
        currency: true,
        tvaEnabled: true,
        tvaRate: true,
        logoUrl: true,
        language: true,
      },
    });
  }

  async uploadLogo(tenantId: string, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    if (!ALLOWED_LOGO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Format de logo non supporté (PNG, JPEG, WEBP ou SVG uniquement).');
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new BadRequestException('Le logo ne doit pas dépasser 2 Mo.');
    }

    const logoUrl = await this.storage.uploadLogo(tenantId, file);

    await this.prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl } });

    return { logoUrl };
  }
}
