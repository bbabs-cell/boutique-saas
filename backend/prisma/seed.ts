import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const tenant = await prisma.tenant.upsert({
    where: { id: 'seed-tenant-1' },
    update: {},
    create: {
      id: 'seed-tenant-1',
      name: 'Boutique Demo',
      currency: 'XOF',
      tvaEnabled: true,
      tvaRate: 18,
    },
  });

  // Deux boutiques, pour tester le multi-boutique du Sprint 8.
  const storeBamako = await prisma.store.upsert({
    where: { id: 'seed-store-bamako' },
    update: {},
    create: { id: 'seed-store-bamako', tenantId: tenant.id, name: 'Bamako', address: 'ACI 2000, Bamako' },
  });
  const storeSikasso = await prisma.store.upsert({
    where: { id: 'seed-store-sikasso' },
    update: {},
    create: { id: 'seed-store-sikasso', tenantId: tenant.id, name: 'Sikasso', address: 'Centre-ville, Sikasso' },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@boutique-demo.ml' },
    update: {},
    create: {
      email: 'admin@boutique-demo.ml',
      passwordHash,
      name: 'Admin Demo',
      role: 'ADMIN',
      tenantId: tenant.id,
    },
  });
  // Un ADMIN a implicitement accès à toutes les boutiques, mais on l'assigne aussi
  // explicitement pour que /parametres/boutiques affiche une assignation cohérente.
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: admin.id, storeId: storeBamako.id } },
    update: {},
    create: { userId: admin.id, storeId: storeBamako.id },
  });

  // Un compte de démo par rôle, pour tester les permissions du Sprint 6.
  const manager = await prisma.user.upsert({
    where: { email: 'manager@boutique-demo.ml' },
    update: {},
    create: {
      email: 'manager@boutique-demo.ml',
      passwordHash,
      name: 'Manager Demo',
      role: 'MANAGER',
      tenantId: tenant.id,
    },
  });
  // Le manager a accès aux deux boutiques (verra le sélecteur de boutique à la connexion).
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: manager.id, storeId: storeBamako.id } },
    update: {},
    create: { userId: manager.id, storeId: storeBamako.id },
  });
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: manager.id, storeId: storeSikasso.id } },
    update: {},
    create: { userId: manager.id, storeId: storeSikasso.id },
  });

  const caissier = await prisma.user.upsert({
    where: { email: 'caissier@boutique-demo.ml' },
    update: {},
    create: {
      email: 'caissier@boutique-demo.ml',
      passwordHash,
      name: 'Caissier Demo',
      role: 'CAISSIER',
      tenantId: tenant.id,
    },
  });
  // Le caissier n'a accès qu'à Bamako (connexion directe, pas de sélecteur).
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: caissier.id, storeId: storeBamako.id } },
    update: {},
    create: { userId: caissier.id, storeId: storeBamako.id },
  });

  const magasinier = await prisma.user.upsert({
    where: { email: 'magasinier@boutique-demo.ml' },
    update: {},
    create: {
      email: 'magasinier@boutique-demo.ml',
      passwordHash,
      name: 'Magasinier Demo',
      role: 'MAGASINIER',
      tenantId: tenant.id,
    },
  });
  // Le magasinier n'a accès qu'à Sikasso.
  await prisma.userStore.upsert({
    where: { userId_storeId: { userId: magasinier.id, storeId: storeSikasso.id } },
    update: {},
    create: { userId: magasinier.id, storeId: storeSikasso.id },
  });

  const category = await prisma.category.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Divers' } },
    update: {},
    create: {
      name: 'Divers',
      tenantId: tenant.id,
    },
  });

  const productExemple = await prisma.product.upsert({
    where: { tenantId_barcode: { tenantId: tenant.id, barcode: '0000000000001' } },
    update: {},
    create: {
      name: 'Produit exemple',
      barcode: '0000000000001',
      price: 1000,
      cost: 700,
      lowStockThreshold: 5,
      categoryId: category.id,
      tenantId: tenant.id,
    },
  });
  // Stock différent selon la boutique, pour vérifier l'isolation multi-boutique.
  await prisma.inventory.upsert({
    where: { productId_storeId: { productId: productExemple.id, storeId: storeBamako.id } },
    update: {},
    create: { productId: productExemple.id, storeId: storeBamako.id, stock: 25 },
  });
  await prisma.inventory.upsert({
    where: { productId_storeId: { productId: productExemple.id, storeId: storeSikasso.id } },
    update: {},
    create: { productId: productExemple.id, storeId: storeSikasso.id, stock: 8 },
  });

  // Second produit volontairement sous son seuil à Bamako, pour visualiser l'alerte de stock faible.
  const productAlerte = await prisma.product.upsert({
    where: { tenantId_barcode: { tenantId: tenant.id, barcode: '0000000000002' } },
    update: {},
    create: {
      name: 'Produit en alerte',
      barcode: '0000000000002',
      price: 2500,
      cost: 1800,
      lowStockThreshold: 5,
      categoryId: category.id,
      tenantId: tenant.id,
    },
  });
  await prisma.inventory.upsert({
    where: { productId_storeId: { productId: productAlerte.id, storeId: storeBamako.id } },
    update: {},
    create: { productId: productAlerte.id, storeId: storeBamako.id, stock: 2 },
  });
  await prisma.inventory.upsert({
    where: { productId_storeId: { productId: productAlerte.id, storeId: storeSikasso.id } },
    update: {},
    create: { productId: productAlerte.id, storeId: storeSikasso.id, stock: 15 },
  });

  // Client de démo pour tester la vente à crédit et les règlements.
  await prisma.customer.upsert({
    where: { id: 'seed-customer-1' },
    update: {},
    create: {
      id: 'seed-customer-1',
      name: 'Fatoumata Diarra',
      phone: '76 00 00 00',
      creditLimit: 20000,
      tenantId: tenant.id,
    },
  });

  // Abonnement Premium : c'est le seul plan qui inclut toutes les fonctionnalités livrées, donc
  // le seul qui permette d'explorer la démo en entier — notamment l'API publique et l'API
  // GraphQL (sprints 11 et 13), réservées à ce palier. Rétrograder depuis /parametres/abonnement
  // (Gratuit : 1 boutique, pas de rôles fins ; Starter/Business : pas d'API publique) reste le
  // moyen de tester les blocages par limite de plan.
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id, plan: 'PREMIUM', status: 'ACTIVE' },
  });

  console.log('Seed terminé.');
  console.log('Boutiques : Bamako (id: seed-store-bamako), Sikasso (id: seed-store-sikasso)');
  console.log('Comptes de test (mot de passe : Password123!) :');
  console.log('  ADMIN      :', admin.email, '(accès à toutes les boutiques)');
  console.log('  MANAGER    : manager@boutique-demo.ml (accès à Bamako + Sikasso, sélecteur à la connexion)');
  console.log('  CAISSIER   : caissier@boutique-demo.ml (accès à Bamako uniquement)');
  console.log('  MAGASINIER : magasinier@boutique-demo.ml (accès à Sikasso uniquement)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
