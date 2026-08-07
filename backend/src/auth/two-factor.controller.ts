import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  DisableTwoFactorDto,
  disableTwoFactorSchema,
  VerifyTwoFactorDto,
  verifyTwoFactorSchema,
} from './dto/two-factor.dto';

// Ces routes exigent déjà un token valide, mais elles vérifient un code TOTP et un mot de
// passe : une session compromise ne doit pas pouvoir les deviner par répétition.
@Controller('auth/2fa')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class TwoFactorController {
  constructor(private twoFactorService: TwoFactorService) {}

  @Post('setup')
  setup(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.setup(user.userId, user.email);
  }

  @Post('verify')
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(verifyTwoFactorSchema)) dto: VerifyTwoFactorDto,
  ) {
    return this.twoFactorService.verify(user.userId, dto.code);
  }

  @Post('disable')
  disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(disableTwoFactorSchema)) dto: DisableTwoFactorDto,
  ) {
    return this.twoFactorService.disable(user.userId, dto.password);
  }
}
