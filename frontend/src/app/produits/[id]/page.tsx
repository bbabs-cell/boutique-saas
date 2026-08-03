'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { ProductForm } from '@/components/product-form';
import { api, ApiError } from '@/lib/api';
import { Product } from '@/lib/types';

export default function EditerProduitPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Product>(`/products/${params.id}`)
      .then(setProduct)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Produit introuvable.'));
  }, [params.id]);

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'MAGASINIER']}>
      <div className="mx-auto max-w-3xl px-8 py-8">
        <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Modifier le produit
        </h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-500">
          Mettez à jour les informations de ce produit.
        </p>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {!error && !product && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        )}
        {product && <ProductForm product={product} />}
      </div>
    </AppShell>
  );
}
