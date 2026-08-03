'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Category, Product } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

interface ProductFormProps {
  product?: Product;
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState(product?.name ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [cost, setCost] = useState(product ? String(product.cost) : '');
  const [stock, setStock] = useState(product ? String(product.stock) : '0');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product?.lowStockThreshold != null ? String(product.lowStockThreshold) : '',
  );
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    try {
      const category = await api.post<Category>('/categories', { name: newCategoryName.trim() });
      setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(category.id);
      setNewCategoryName('');
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Création de catégorie impossible.');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    const payload = {
      name,
      barcode: barcode.trim() ? barcode.trim() : null,
      price: Number(price),
      cost: Number(cost),
      stock: Number(stock),
      lowStockThreshold: lowStockThreshold.trim() ? Number(lowStockThreshold) : null,
      categoryId: categoryId || null,
    };

    try {
      if (isEditing && product) {
        await api.patch(`/products/${product.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      router.push('/produits');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("Une erreur est survenue lors de l'enregistrement.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-xl p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nom du produit</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Riz parfumé 5kg"
            error={fieldErrors.name?.[0]}
          />
        </div>

        <div>
          <Label htmlFor="barcode">Code-barres (optionnel)</Label>
          <Input
            id="barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scanner ou saisir le code"
            error={fieldErrors.barcode?.[0]}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="price">Prix de vente (FCFA)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              error={fieldErrors.price?.[0]}
            />
          </div>
          <div>
            <Label htmlFor="cost">Coût d'achat (FCFA)</Label>
            <Input
              id="cost"
              type="number"
              min={0}
              required
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              error={fieldErrors.cost?.[0]}
            />
          </div>
        </div>

        {!isEditing && (
          <div>
            <Label htmlFor="stock">Stock initial (boutique active)</Label>
            <Input
              id="stock"
              type="number"
              min={0}
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              error={fieldErrors.stock?.[0]}
            />
          </div>
        )}
        {isEditing && (
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500">
            Le stock ({product?.stock} en boutique active) se modifie désormais depuis la page{' '}
            <span className="font-medium">Stock</span>, boutique par boutique.
          </p>
        )}

        <div>
          <Label htmlFor="lowStockThreshold">Seuil d'alerte de stock (optionnel)</Label>
          <Input
            id="lowStockThreshold"
            type="number"
            min={0}
            value={lowStockThreshold}
            onChange={(e) => setLowStockThreshold(e.target.value)}
            placeholder="Ex : 5 — alerte quand le stock descend à ce niveau"
            error={fieldErrors.lowStockThreshold?.[0]}
          />
        </div>

        <div>
          <Label htmlFor="category">Catégorie</Label>
          <Select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Aucune catégorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="Nouvelle catégorie"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={handleCreateCategory}>
              Ajouter
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="submit" loading={loading}>
            {isEditing ? 'Enregistrer les modifications' : 'Ajouter le produit'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/produits')}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
