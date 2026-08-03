import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, SupabaseStorageService],
})
export class SettingsModule {}
