import { PrismaService } from '../../prisma/prisma.service';

/**
 * Outils partagés par les tests d'intégration. Ils parlent à une vraie base PostgreSQL :
 * c'est le seul moyen de valider ce qu'un Prisma simulé ne peut pas prouver — l'isolation
 * entre organisations, le comportement réel des transactions et des verrous, et les
 * contraintes posées en base.
 */

export function createPrisma(): PrismaService {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL est requis pour les tests d’intégration. ' +
        'Lance une base PostgreSQL puis : npx prisma migrate deploy',
    );
  }
  return new PrismaService();
}

/**
 * Vide les tables dans l'ordre inverse des dépendances. `TRUNCATE ... CASCADE` en une seule
 * commande évite d'avoir à raisonner sur l'ordre exact des clés étrangères.
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "audit_logs", "notifications", "invoices", "subscriptions",
      "payments", "sale_items", "sales",
      "purchase_order_items", "purchase_orders", "supplier_payments", "suppliers",
      "customer_payments", "customers", "expenses",
      "stock_movements", "inventory", "products", "categories",
      "user_stores", "users", "api_keys", "webhooks", "stores", "tenants"
    RESTART IDENTITY CASCADE
  `);
}

export interface SeededTenant {
  tenantId: string;
  storeId: string;
  userId: string;
  productId: string;
}

/** Crée une organisation minimale mais complète : une boutique, un utilisateur, un produit stocké. */
export async function seedTenant(
  prisma: PrismaService,
  suffix: string,
  options: { stock?: number; price?: number } = {},
): Promise<SeededTenant> {
  const { stock = 10, price = 5000 } = options;

  const tenant = await prisma.tenant.create({
    data: { id: `tenant-${suffix}`, name: `Boutique ${suffix}` },
  });
  const store = await prisma.store.create({
    data: { id: `store-${suffix}`, tenantId: tenant.id, name: `Magasin ${suffix}` },
  });
  const user = await prisma.user.create({
    data: {
      id: `user-${suffix}`,
      tenantId: tenant.id,
      email: `admin-${suffix}@exemple.ml`,
      passwordHash: 'hash-de-test',
      name: `Admin ${suffix}`,
      role: 'ADMIN',
    },
  });
  await prisma.userStore.create({ data: { userId: user.id, storeId: store.id } });

  const product = await prisma.product.create({
    data: {
      id: `product-${suffix}`,
      tenantId: tenant.id,
      name: `Produit ${suffix}`,
      price,
      cost: Math.round(price * 0.6),
      inventory: { create: { storeId: store.id, stock } },
    },
  });

  return { tenantId: tenant.id, storeId: store.id, userId: user.id, productId: product.id };
}

export async function readStock(
  prisma: PrismaService,
  productId: string,
  storeId: string,
): Promise<number> {
  const inventory = await prisma.inventory.findUnique({
    where: { productId_storeId: { productId, storeId } },
  });
  return inventory?.stock ?? 0;
}
