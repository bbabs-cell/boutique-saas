import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import { resolveActiveStoreId } from '../common/stores-helper';
import { BootstrapQueryDto, OfflineSaleDto } from './dto/sync.dto';

export type SyncSaleStatus = 'accepted' | 'already_synced' | 'conflict';

export interface SyncSaleResult {
  clientSaleId: string;
  status: SyncSaleStatus;
  saleId?: string;
  reason?: string;
}

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private salesService: SalesService,
  ) {}

  /** Tout ce qu'il faut pour amorcer le cache local de la caisse hors-ligne. */
  async bootstrap(tenantId: string, userId: string, role: string, query: BootstrapQueryDto) {
    // Une boutique précise est requise : le mode hors-ligne ne peut pas fonctionner en
    // mode "toutes boutiques", il faut savoir avec certitude de quel stock on part.
    const storeId = await resolveActiveStoreId(this.prisma, tenantId, userId, role, query.storeId, false);

    const [tenant, store, products, customers] = await Promise.all([
      this.prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { name: true, currency: true, tvaEnabled: true, tvaRate: true },
      }),
      this.prisma.store.findUniqueOrThrow({ where: { id: storeId! }, select: { id: true, name: true } }),
      this.prisma.product.findMany({
        where: { tenantId, active: true },
        select: {
          id: true,
          name: true,
          barcode: true,
          price: true,
          cost: true,
          lowStockThreshold: true,
          categoryId: true,
          inventory: { where: { storeId: storeId! }, select: { stock: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.findMany({
        where: { tenantId },
        select: { id: true, name: true, phone: true, creditLimit: true, creditBalance: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      tenant,
      store,
      products: products.map(({ inventory, ...product }) => ({
        ...product,
        stock: inventory[0]?.stock ?? 0,
      })),
      customers,
      syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Rejoue dans l'ordre un lot de ventes créées hors-ligne. Chaque vente repasse par la même
   * validation que la caisse en ligne (SalesService.create) — le serveur ne fait jamais confiance
   * au stock vu localement par le client : un conflit (ex. stock insuffisant) est signalé pour
   * traitement manuel plutôt que rejeté silencieusement ou accepté à tort.
   */
  async processSalesBatch(
    tenantId: string,
    userId: string,
    role: string,
    sales: OfflineSaleDto[],
  ): Promise<{ results: SyncSaleResult[] }> {
    const results: SyncSaleResult[] = [];

    for (const offlineSale of sales) {
      const existing = await this.prisma.sale.findUnique({
        where: { clientId: offlineSale.clientSaleId },
        select: { id: true },
      });
      if (existing) {
        // Déjà synchronisée lors d'une tentative précédente (ex. coupure pendant la synchro) :
        // ce n'est ni une erreur ni un conflit, juste un doublon à ignorer proprement.
        results.push({ clientSaleId: offlineSale.clientSaleId, status: 'already_synced', saleId: existing.id });
        continue;
      }

      try {
        const sale = await this.salesService.create(tenantId, userId, role, {
          items: offlineSale.items,
          discount: offlineSale.discount,
          payments: offlineSale.payments,
          customerId: offlineSale.customerId ?? null,
          storeId: offlineSale.storeId,
          clientId: offlineSale.clientSaleId,
        });
        results.push({ clientSaleId: offlineSale.clientSaleId, status: 'accepted', saleId: sale.id });
      } catch (err) {
        results.push({
          clientSaleId: offlineSale.clientSaleId,
          status: 'conflict',
          reason: err instanceof Error ? err.message : 'Erreur inconnue lors de la synchronisation.',
        });
      }
    }

    return { results };
  }
}
