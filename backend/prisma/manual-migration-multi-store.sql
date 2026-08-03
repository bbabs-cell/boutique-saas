-- Migration manuelle Sprint 8 — Multi-boutique
--
-- Prisma ne sait pas générer automatiquement une migration qui à la fois (a) ajoute des
-- colonnes storeId NOT NULL sur des tables déjà peuplées et (b) supprime products.stock
-- après avoir copié sa valeur dans Inventory. Ce fichier fait les deux dans le bon ordre.
--
-- Utilisation :
--   1. npx prisma migrate dev --create-only --name add_multi_store
--   2. Remplacer TOUT le contenu du fichier migration.sql généré par celui-ci
--   3. npx prisma migrate dev
--
-- Pour une base de test/démo sans données à préserver, il est plus simple de faire
-- `npx prisma migrate reset` puis de reseed — voir le README.

-- 1. Nouvelles tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "stores" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stores_tenantId_idx" ON "stores"("tenantId");
ALTER TABLE "stores" ADD CONSTRAINT "stores_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "user_stores" (
  "userId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  CONSTRAINT "user_stores_pkey" PRIMARY KEY ("userId", "storeId")
);
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_stores" ADD CONSTRAINT "user_stores_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "inventory" (
  "productId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "inventory_pkey" PRIMARY KEY ("productId", "storeId")
);
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Une boutique par défaut par tenant existant
INSERT INTO "stores" ("id", "tenantId", "name", "createdAt")
SELECT gen_random_uuid()::text, "id", "name" || ' — Boutique principale', CURRENT_TIMESTAMP
FROM "tenants";

-- 3. Copie de l'ancien Product.stock dans Inventory, pour la boutique par défaut du tenant
INSERT INTO "inventory" ("productId", "storeId", "stock")
SELECT p."id", s."id", p."stock"
FROM "products" p
JOIN "stores" s ON s."tenantId" = p."tenantId";

-- 4. Colonnes storeId ajoutées nullable, backfillées, puis rendues NOT NULL
ALTER TABLE "sales" ADD COLUMN "storeId" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN "storeId" TEXT;
ALTER TABLE "purchase_orders" ADD COLUMN "storeId" TEXT;

UPDATE "sales" sa SET "storeId" = s."id" FROM "stores" s WHERE s."tenantId" = sa."tenantId";
UPDATE "stock_movements" sm SET "storeId" = s."id" FROM "stores" s WHERE s."tenantId" = sm."tenantId";
UPDATE "purchase_orders" po SET "storeId" = s."id" FROM "stores" s WHERE s."tenantId" = po."tenantId";

ALTER TABLE "sales" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "sales" ADD CONSTRAINT "sales_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "sales_storeId_createdAt_idx" ON "sales"("storeId", "createdAt");

ALTER TABLE "stock_movements" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "stock_movements_storeId_productId_idx" ON "stock_movements"("storeId", "productId");

ALTER TABLE "purchase_orders" ALTER COLUMN "storeId" SET NOT NULL;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "purchase_orders_storeId_idx" ON "purchase_orders"("storeId");

-- 5. L'ancien stock par produit n'existe plus : il vit désormais dans Inventory
ALTER TABLE "products" DROP COLUMN "stock";
