-- Filet de sécurité en base contre la survente.
--
-- La course est empêchée en amont par le verrou de ligne (SELECT ... FOR UPDATE) posé par
-- SalesService.create. Cette contrainte est la seconde barrière : elle garantit qu'aucun
-- chemin d'écriture, présent ou futur, ne puisse laisser un stock négatif en base — un état
-- qui ne correspond à rien de physique et qui fausse ensuite les alertes et la comptabilité.
--
-- Prisma ne sait pas exprimer les contraintes CHECK dans schema.prisma : elle est donc posée
-- ici en SQL. Elle fait partie de l'historique des migrations et sera rejouée normalement.

-- Une base qui a déjà survendu contient des stocks négatifs, et la contrainte ne pourrait pas
-- s'y appliquer. On les ramène à 0 : la marchandise est physiquement partie, le stock réel ne
-- peut pas être inférieur à zéro. Les mouvements de stock gardent la trace de ce qui s'est passé.
UPDATE "inventory" SET "stock" = 0 WHERE "stock" < 0;

ALTER TABLE "inventory"
  ADD CONSTRAINT "inventory_stock_non_negative" CHECK ("stock" >= 0);
