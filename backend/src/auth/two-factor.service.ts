import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const ISSUER = 'BoutikPro';

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  async setup(userId: string, email: string) {
    // Génère un nouveau secret et le stocke déjà (mais twoFactorEnabled reste false tant
    // que /verify n'a pas confirmé que l'utilisateur a bien scanné et saisi un code valide).
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

    const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, qrCodeDataUrl };
  }

  async verify(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret) {
      throw new BadRequestException("Aucune configuration 2FA en cours. Relancez l'activation.");
    }
    const valid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
    if (!valid) {
      throw new UnauthorizedException('Code invalide.');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { success: true };
  }

  async disable(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Mot de passe incorrect.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { success: true };
  }

  /** Utilisé par AuthService lors du login : vérifie le code TOTP fourni pour un utilisateur donné. */
  verifyLoginCode(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }
}
