'use client';

import { AppShell } from '@/components/app-shell';
import { ProductForm } from '@/components/product-form';

export default function NouveauProduitPage() {
  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Ajouter un produit
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Renseignez les informations du produit à ajouter au catalogue.
        </p>
        <ProductForm />
      </div>
    </AppShell>
  );
}
