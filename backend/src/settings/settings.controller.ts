import { Body, Controller, Get, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SettingsService } from './settings.service';
import { MAX_LOGO_SIZE_BYTES, SINGLE_FILE_UPLOAD } from '../common/upload-limits';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UpdateSettingsDto, updateSettingsSchema } from './dto/settings.dto';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getSettings(user.tenantId);
  }

  @Patch()
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) dto: UpdateSettingsDto,
  ) {
    return this.settingsService.updateSettings(user.tenantId, dto);
  }

  // La limite est posée sur l'interceptor, pas seulement dans le service : sans elle, multer
  // charge l'intégralité du fichier en mémoire avant que la moindre vérification puisse avoir
  // lieu — un POST de 500 Mo transitait donc par la RAM du serveur avant d'être refusé.
  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LOGO_SIZE_BYTES, files: SINGLE_FILE_UPLOAD },
    }),
  )
  uploadLogo(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    return this.settingsService.uploadLogo(user.tenantId, file);
  }
}
