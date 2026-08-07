import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';
import { createPrisma, readStock, resetDatabase, seedTenant } from '../common/testing/integration-db';

/**
 * Ce que ces tests apportent par rapport aux tests unitaires : ils s'exécutent contre une
 * vraie base PostgreSQL. Le verrouillage de ligne, le niveau d'isolation des transactions et
 * les contraintes en base n'existent tout simplement pas dans un Prisma simulé — c'est
 * pourtant exactement là que se logeait le bug de survente.
 */
describe('SalesService (intégration)', () => {
  let prisma: PrismaService;
  let service: SalesService;

  beforeAll(async () => {
    prisma = createPrisma();
    await prisma.$connect();
    service = new SalesService(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  describe('survente en concurrence', () => {
    it('deux ventes simultanées du dernier article : une seule passe', async () => {
      const { tenantId, storeId, userId, productId } = await seedTenant(prisma, 'concurrence', {
        stock: 1,
        price: 5000,
      });

      const vente = () =>
        service.create(tenantId, userId, 'ADMIN', {
          items: [{ productId, quantity: 1 }],
          discount: 0,
          payments: [{ method: 'CASH', amount: 5000 }],
          storeId,
        } as any);

      // Les deux transactions démarrent avant que l'une ait pu committer : c'est la situation
      // exacte de deux caisses encaissant le même dernier article au même instant.
      const [a, b] = await Promise.allSettled([vente(), vente()]);

      const acceptees = [a, b].filter((r) => r.status === 'fulfilled');
      const refusees = [a, b].filter((r) => r.status === 'rejected');

      expect(acceptees).toHaveLength(1);
      expect(refusees).toHaveLength(1);
      expect(await readStock(prisma, productId, storeId)).toBe(0);
      expect(await prisma.sale.count({ where: { tenantId } })).toBe(1);

      // Ce qu'apporte réellement le verrou, en plus de la contrainte en base.
      //
      // La contrainte CHECK empêche à elle seule la survente : sans verrou, la seconde vente
      // échoue aussi — mais sur une violation de contrainte PostgreSQL brute, que NestJS
      // traduit en 500. Le caissier voit « une erreur est survenue » face à un client qui
      // attend, sans savoir que l'article est simplement épuisé.
      //
      // Avec le verrou, la seconde transaction attend, relit le stock à 0, et ressort l'erreur
      // métier normale : un 400 qui dit ce qui se passe. C'est cette assertion qui distingue
      // les deux comportements — elle échoue si le SELECT ... FOR UPDATE disparaît.
      const refusee = refusees[0] as PromiseRejectedResult;
      expect(refusee.reason).toBeInstanceOf(BadRequestException);
      expect(refusee.reason.message).toMatch(/Stock insuffisant/);
    });

    it('cinq ventes simultanées sur un stock de 3 : trois passent, le stock finit à 0', async () => {
      const { tenantId, storeId, userId, productId } = await seedTenant(prisma, 'ruee', {
        stock: 3,
        price: 1000,
      });

      const résultats = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          service.create(tenantId, userId, 'ADMIN', {
            items: [{ productId, quantity: 1 }],
            discount: 0,
            payments: [{ method: 'CASH', amount: 1000 }],
            storeId,
          } as any),
        ),
      );

      expect(résultats.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
      expect(await readStock(prisma, productId, storeId)).toBe(0);
    });

    it('le stock ne peut jamais devenir négatif, la contrainte en base le refuse', async () => {
      const { storeId, productId } = await seedTenant(prisma, 'contrainte', { stock: 2 });

      await expect(
        prisma.inventory.update({
          where: { productId_storeId: { productId, storeId } },
          data: { stock: { decrement: 5 } },
        }),
      ).rejects.toThrow();

      expect(await readStock(prisma, productId, storeId)).toBe(2);
    });
  });

  describe('isolation entre organisations', () => {
    it("une vente ne peut pas porter sur le produit d'une autre organisation", async () => {
      const a = await seedTenant(prisma, 'org-a');
      const b = await seedTenant(prisma, 'org-b');

      await expect(
        service.create(a.tenantId, a.userId, 'ADMIN', {
          items: [{ productId: b.productId, quantity: 1 }],
          discount: 0,
          payments: [{ method: 'CASH', amount: 5000 }],
          storeId: a.storeId,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      // Le stock de l'organisation B est intact : rien n'a fuité d'un tenant à l'autre.
      expect(await readStock(prisma, b.productId, b.storeId)).toBe(10);
    });

    it("une vente ne peut pas être encaissée dans la boutique d'une autre organisation", async () => {
      const a = await seedTenant(prisma, 'org-c');
      const b = await seedTenant(prisma, 'org-d');

      await expect(
        service.create(a.tenantId, a.userId, 'ADMIN', {
          items: [{ productId: a.productId, quantity: 1 }],
          discount: 0,
          payments: [{ method: 'CASH', amount: 5000 }],
          storeId: b.storeId,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("findOne ne renvoie pas la vente d'une autre organisation", async () => {
      const a = await seedTenant(prisma, 'org-e');
      const b = await seedTenant(prisma, 'org-f');

      const vente = await service.create(a.tenantId, a.userId, 'ADMIN', {
        items: [{ productId: a.productId, quantity: 1 }],
        discount: 0,
        payments: [{ method: 'CASH', amount: 5000 }],
        storeId: a.storeId,
      } as any);

      await expect(service.findOne(b.tenantId, vente.id)).rejects.toThrow();
      await expect(service.findOne(a.tenantId, vente.id)).resolves.toMatchObject({ id: vente.id });
    });
  });

  describe('cohérence transactionnelle', () => {
    it('une vente refusée ne laisse aucune trace : ni stock entamé, ni mouvement, ni vente', async () => {
      const { tenantId, storeId, userId, productId } = await seedTenant(prisma, 'rollback', {
        stock: 5,
        price: 5000,
      });

      // Paiement insuffisant : le refus intervient après la décrémentation du stock dans le
      // corps de la transaction, ce qui en fait un vrai test de rollback.
      await expect(
        service.create(tenantId, userId, 'ADMIN', {
          items: [{ productId, quantity: 2 }],
          discount: 0,
          payments: [{ method: 'CASH', amount: 1 }],
          storeId,
        } as any),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(await readStock(prisma, productId, storeId)).toBe(5);
      expect(await prisma.stockMovement.count({ where: { tenantId } })).toBe(0);
      expect(await prisma.sale.count({ where: { tenantId } })).toBe(0);
    });

    it('une vente acceptée décrémente le stock et journalise le mouvement', async () => {
      const { tenantId, storeId, userId, productId } = await seedTenant(prisma, 'nominal', {
        stock: 10,
        price: 2000,
      });

      const vente = await service.create(tenantId, userId, 'ADMIN', {
        items: [{ productId, quantity: 3 }],
        discount: 0,
        payments: [{ method: 'CASH', amount: 6000 }],
        storeId,
      } as any);

      expect(vente.total).toBe(6000);
      expect(await readStock(prisma, productId, storeId)).toBe(7);

      const mouvements = await prisma.stockMovement.findMany({ where: { tenantId } });
      expect(mouvements).toHaveLength(1);
      expect(mouvements[0]).toMatchObject({ type: 'SALE', quantity: -3, storeId });
    });

    it("l'annulation d'une vente restitue le stock", async () => {
      const { tenantId, storeId, userId, productId } = await seedTenant(prisma, 'annulation', {
        stock: 10,
        price: 2000,
      });

      const vente = await service.create(tenantId, userId, 'ADMIN', {
        items: [{ productId, quantity: 4 }],
        discount: 0,
        payments: [{ method: 'CASH', amount: 8000 }],
        storeId,
      } as any);
      expect(await readStock(prisma, productId, storeId)).toBe(6);

      await service.cancel(tenantId, vente.id);

      expect(await readStock(prisma, productId, storeId)).toBe(10);
    });
  });
});
