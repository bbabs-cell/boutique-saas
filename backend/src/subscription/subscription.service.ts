import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getOrCreateSubscription, PLAN_LIMITS, PLAN_PRICES } from '../common/plan-limits';
import { UpgradeSubscriptionDto } from './dto/subscription.dto';

const BILLING_PERIOD_DAYS = 30;

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async getSubscription(tenantId: string) {
    const subscription = await getOrCreateSubscription(this.prisma, tenantId);
    return { ...subscription, limits: PLAN_LIMITS[subscription.plan] };
  }

  async upgrade(tenantId: string, dto: UpgradeSubscriptionDto) {
    const subscription = await getOrCreateSubscription(this.prisma, tenantId);

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + BILLING_PERIOD_DAYS);
    // Le plan Gratuit n'expire jamais ; les plans payants sont facturés au mois.
    const expiresAt = dto.plan === 'FREE' ? null : periodEnd;

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { plan: dto.plan, status: 'ACTIVE', expiresAt },
    });

    const amount = PLAN_PRICES[dto.plan];
    if (amount > 0) {
      // L'intégration réelle du paiement (encaissement mobile money) est hors périmètre de ce
      // sprint : la facture est créée non payée (paidAt: null), prête à être marquée payée
      // une fois le paiement effectivement encaissé.
      await this.prisma.invoice.create({
        data: {
          subscriptionId: subscription.id,
          amount,
          plan: dto.plan,
          method: dto.method ?? null,
          reference: dto.reference ?? null,
          periodStart: now,
          periodEnd,
        },
      });
    }

    return { ...updated, limits: PLAN_LIMITS[updated.plan] };
  }

  async listInvoices(tenantId: string) {
    const subscription = await getOrCreateSubscription(this.prisma, tenantId);
    return this.prisma.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
