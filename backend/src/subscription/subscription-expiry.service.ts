import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const EXPIRING_SOON_DAYS = 7;

@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyCheck() {
    await this.notifyExpiringSoon();
    await this.markExpired();
  }

  /** Crée une notification SUBSCRIPTION_EXPIRING pour les abonnements actifs qui expirent bientôt. */
  async notifyExpiringSoon() {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + EXPIRING_SOON_DAYS);

    const expiringSoon = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { not: null, gte: now, lte: threshold },
      },
      include: { tenant: { select: { name: true } } },
    });

    for (const subscription of expiringSoon) {
      // Évite de spammer : une seule notification par créneau de 24h pour ce tenant.
      const alreadyNotifiedToday = await this.prisma.notification.findFirst({
        where: {
          tenantId: subscription.tenantId,
          type: 'SUBSCRIPTION_EXPIRING',
          createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        },
      });
      if (alreadyNotifiedToday) continue;

      const daysLeft = Math.ceil((subscription.expiresAt!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      await this.prisma.notification.create({
        data: {
          tenantId: subscription.tenantId,
          userId: null,
          type: 'SUBSCRIPTION_EXPIRING',
          message: `Votre abonnement ${subscription.plan} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.`,
        },
      });
    }

    this.logger.log(`Vérification des abonnements proches de l'expiration : ${expiringSoon.length} tenant(s) concerné(s).`);
    return expiringSoon.length;
  }

  /** Passe au statut EXPIRED les abonnements actifs dont la date d'expiration est dépassée. */
  async markExpired() {
    const result = await this.prisma.subscription.updateMany({
      where: { status: 'ACTIVE', expiresAt: { not: null, lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`${result.count} abonnement(s) passé(s) au statut EXPIRED.`);
    }
    return result.count;
  }
}
