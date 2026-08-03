import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const LOGO_BUCKET = 'logos';

@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient | null = null;

  constructor(private config: ConfigService) {}

  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) {
      throw new InternalServerErrorException(
        "Le stockage Supabase n'est pas configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants).",
      );
    }
    this.client = createClient(url, serviceKey);
    return this.client;
  }

  async uploadLogo(tenantId: string, file: Express.Multer.File): Promise<string> {
    const client = this.getClient();
    const extension = file.originalname.split('.').pop() || 'png';
    const path = `${tenantId}/logo-${Date.now()}.${extension}`;

    const { error } = await client.storage.from(LOGO_BUCKET).upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (error) {
      throw new InternalServerErrorException(`Échec de l'upload du logo : ${error.message}`);
    }

    const { data } = client.storage.from(LOGO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
}
