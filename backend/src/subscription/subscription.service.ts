import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getOrCreateSubscription, PLAN_LIMITS, PLAN_PRICES } from '../common/plan-limits';
import { UpgradeSubscriptionDto } from './dto/subscription.dto';

const BILLING_PERIOD_DAYS = 30;

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async getSubscription(tenantId: string) {
    const subscription = await getOrCreateSubscription(this.prisma, tenantId);
    // Facture(s) en attente de confirmation de paiement : le plan actif (ci-dessus) ne change
    // qu'une fois le paiement confirmé — le tenant ne doit jamais pouvoir s'auto-activer un plan.
    const pendingInvoice = await this.prisma.invoice.findFirst({
      where: { subscriptionId: subscription.id, paidAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return { ...subscription, limits: PLAN_LIMITS[subscription.plan], pendingInvoice };
  }

  /**
   * Demande de changement de plan. Ne modifie JAMAIS le plan actif directement pour un plan
   * payant : crée une facture en attente (paidAt: null), qui ne prendra effet qu'une fois
   * confirmée via confirmPayment() — un canal séparé, non accessible au tenant lui-même
   * (voir PlatformSecretGuard). Le passage au plan Gratuit reste immédiat : aucun paiement
   * n'est requis, il n'y a donc rien à sécuriser derrière une confirmation.
   */
  async requestUpgrade(tenantId: string, dto: UpgradeSubscriptionDto) {
    const subscription = await getOrCreateSubscription(this.prisma, tenantId);

    if (dto.plan === 'FREE') {
      const updated = await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { plan: 'FREE', status: 'ACTIVE', expiresAt: null },
      });
      return { ...updated, limits: PLAN_LIMITS[updated.plan], pendingInvoice: null };
    }

    // Évite de créer une seconde facture en attente pour le même plan si une demande
    // identique est déjà en cours de confirmation.
    const existingPending = await this.prisma.invoice.findFirst({
      where: { subscriptionId: subscription.id, paidAt: null, plan: dto.plan },
    });
    if (existingPending) {
      return { ...subscription, limits: PLAN_LIMITS[subscription.plan], pendingInvoice: existingPending };
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + BILLING_PERIOD_DAYS);

    const invoice = await this.prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amount: PLAN_PRICES[dto.plan],
        plan: dto.plan,
        method: dto.method ?? null,
        reference: dto.reference ?? null,
        periodStart: now,
        periodEnd,
      },
    });

    // Le plan actif (subscription.plan) n'a volontairement PAS changé ici.
    return { ...subscription, limits: PLAN_LIMITS[subscription.plan], pendingInvoice: invoice };
  }

  /**
   * Active réellement un changement de plan, une fois le paiement confirmé. N'est jamais
   * appelée par le tenant lui-même : réservée à un canal opérateur distinct (PlatformSecretGuard),
   * pour que l'auto-activation d'un plan payant sans paiement réel soit structurellement impossible.
   */
  async confirmPayment(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new NotFoundException('Facture introuvable.');
    }
    if (invoice.paidAt) {
      throw new BadRequestException('Cette facture a déjà été marquée payée.');
    }

    await this.prisma.invoice.update({ where: { id: invoiceId }, data: { paidAt: new Date() } });

    return this.prisma.subscription.update({
      where: { id: invoice.subscriptionId },
      data: { plan: invoice.plan, status: 'ACTIVE', expiresAt: invoice.periodEnd },
    });
  }

  async listInvoices(tenantId: string) {
    const subscription = await getOrCreateSubscription(this.prisma, tenantId);
    return this.prisma.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
