'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ScanBarcode, Trash2, Plus, User, X, WifiOff } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { CartLineRow, CartLine } from '@/components/cart-line';
import { api, ApiError } from '@/lib/api';
import { Product, PaginatedProducts, PaymentMethod, Sale, Customer, PaginatedCustomers } from '@/lib/types';
import { formatXOF, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { useOnlineStatus } from '@/lib/use-online-status';
import {
  bootstrapOfflineCache,
  offlineDb,
  queueOfflineSale,
  OfflineProduct,
} from '@/lib/offline-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, Card } from '@/components/ui/card';

interface PaymentLine {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
}

const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'ORANGE_MONEY', 'MOOV_MONEY', 'CARD', 'CREDIT'];

/** Complète un produit du cache local avec les champs attendus par le type Product partagé
 *  (le cache hors-ligne n'a pas besoin de category/active pour fonctionner). */
function toCartProduct(p: OfflineProduct): Product {
  return { ...p, category: null, active: true };
}

export default function CaissePage() {
  const { user, activeStoreId } = useAuth();
  const { isOnline } = useOnlineStatus();
  const router = useRouter();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [discount, setDiscount] = useState('0');
  const [payments, setPayments] = useState<PaymentLine[]>([
    { id: crypto.randomUUID(), method: 'CASH', amount: '', reference: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [offlineSuccess, setOfflineSuccess] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);

  // Rafraîchit silencieusement le cache local (catalogue + clients) dès qu'on est en ligne,
  // pour que la caisse reste utilisable si la connexion venait à manquer juste après.
  useEffect(() => {
    if (!isOnline || !activeStoreId || activeStoreId === 'ALL') return;
    bootstrapOfflineCache(activeStoreId).catch(() => {
      // silencieux : ce n'est qu'un rafraîchissement de confort, pas une action demandée
    });
  }, [isOnline, activeStoreId]);

  // Recherche par nom au fil de la frappe — API en ligne, cache local hors-ligne.
  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        if (isOnline) {
          const res = await api.get<PaginatedProducts>(
            `/products?search=${encodeURIComponent(search)}&pageSize=8`,
          );
          setResults(res.items);
        } else {
          const term = search.trim().toLowerCase();
          const matches = await offlineDb.products
            .filter((p) => p.name.toLowerCase().includes(term))
            .limit(8)
            .toArray();
          setResults(matches.map(toCartProduct));
        }
      } catch {
        // silencieux : on retente à la prochaine frappe
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, isOnline]);

  // Recherche client au fil de la frappe (nom ou téléphone) — API en ligne, cache local hors-ligne.
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        if (isOnline) {
          const res = await api.get<PaginatedCustomers>(
            `/customers?search=${encodeURIComponent(customerSearch)}&pageSize=6`,
          );
          setCustomerResults(res.items);
        } else {
          const term = customerSearch.trim().toLowerCase();
          const matches = await offlineDb.customers
            .filter((c) => c.name.toLowerCase().includes(term) || (c.phone ?? '').includes(term))
            .limit(6)
            .toArray();
          setCustomerResults(matches.map((c) => ({ ...c, createdAt: '' })));
        }
      } catch {
        // silencieux : on retente à la prochaine frappe
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [customerSearch, isOnline]);

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      setSearchError(`« ${product.name} » est en rupture de stock.`);
      return;
    }
    setSearchError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearch('');
    setResults([]);
    searchInputRef.current?.focus();
  }

  async function handleScanEnter() {
    const code = search.trim();
    if (!code) return;
    setSearchError(null);
    try {
      if (isOnline) {
        const product = await api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
        addToCart(product);
      } else {
        const product = await offlineDb.products.where('barcode').equals(code).first();
        if (!product) {
          setSearchError('Aucun produit avec ce code-barres dans le cache local.');
          return;
        }
        addToCart(toCartProduct(product));
      }
    } catch (err) {
      setSearchError(
        err instanceof ApiError && err.status === 404
          ? 'Aucun produit avec ce code-barres.'
          : 'Recherche impossible.',
      );
    }
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          const nextQty = Math.min(l.product.stock, Math.max(0, l.quantity + delta));
          return { ...l, quantity: nextQty };
        })
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
  const discountValue = Math.min(Number(discount) || 0, subtotal);
  const taxableBase = subtotal - discountValue;
  const tvaAmount = user?.tvaEnabled ? Math.round((taxableBase * user.tvaRate) / 100) : 0;
  const total = taxableBase + tvaAmount;

  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const changeDue = paymentsTotal - total;

  function addPaymentLine() {
    setPayments((prev) => [...prev, { id: crypto.randomUUID(), method: 'CASH', amount: '', reference: '' }]);
  }

  function updatePayment(id: string, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePayment(id: string) {
    setPayments((prev) => (prev.length > 1 ? prev.filter((p) => p.id !== id) : prev));
  }

  function resetForm() {
    setCart([]);
    setDiscount('0');
    setPayments([{ id: crypto.randomUUID(), method: 'CASH', amount: '', reference: '' }]);
    setCustomer(null);
  }

  async function handleCheckout() {
    setSubmitError(null);
    setOfflineSuccess(false);
    if (cart.length === 0) {
      setSubmitError('Le panier est vide.');
      return;
    }
    if (paymentsTotal < total) {
      setSubmitError('Le total des paiements ne couvre pas le total de la vente.');
      return;
    }
    const hasCredit = payments.some((p) => p.method === 'CREDIT' && Number(p.amount) > 0);
    if (hasCredit && !customer) {
      setSubmitError('Sélectionnez un client pour une vente à crédit.');
      return;
    }

    const paymentPayload = payments
      .filter((p) => Number(p.amount) > 0)
      .map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference.trim() || null,
      }));

    setSubmitting(true);
    try {
      if (isOnline) {
        const sale = await api.post<Sale>('/sales', {
          items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          discount: discountValue,
          customerId: customer?.id ?? null,
          payments: paymentPayload,
        });
        router.push(`/ventes/${sale.id}?nouvelle=1`);
        return;
      }

      // Hors-ligne : la vente est mise en file locale, revalidée par le serveur à la synchro.
      if (!activeStoreId || activeStoreId === 'ALL') {
        setSubmitError('Aucune boutique active : impossible de vendre hors-ligne.');
        return;
      }
      await queueOfflineSale({
        items: cart.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          quantity: l.quantity,
          unitPrice: l.product.price,
        })),
        discount: discountValue,
        payments: paymentPayload,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? null,
        storeId: activeStoreId,
        total,
      });
      resetForm();
      setOfflineSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "L'encaissement a échoué.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell allowedRoles={['ADMIN', 'MANAGER', 'CAISSIER']}>
      <div className="mx-auto flex h-full max-w-6xl gap-6 px-8 py-8">
        {/* Colonne recherche + panier */}
        <div className="flex flex-1 flex-col">
          <div className="mb-4 flex items-center gap-2">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Caisse</h1>
            {!isOnline && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <WifiOff className="h-3 w-3" />
                Mode hors-ligne
              </span>
            )}
          </div>

          <div className="relative mb-4">
            <ScanBarcode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              ref={searchInputRef}
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (results.length === 1) {
                    addToCart(results[0]);
                  } else {
                    handleScanEnter();
                  }
                }
              }}
              placeholder={
                isOnline
                  ? 'Scanner un code-barres ou rechercher un produit…'
                  : 'Rechercher dans le catalogue en cache…'
              }
              className="pl-9"
            />
            {results.length > 0 && (
              <Card className="absolute z-10 mt-1 w-full overflow-hidden">
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="text-zinc-800 dark:text-zinc-200">{p.name}</span>
                    <span className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500">
                      Stock {p.stock}
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {formatXOF(p.price)}
                      </span>
                    </span>
                  </button>
                ))}
              </Card>
            )}
          </div>
          {searchError && <p className="mb-3 text-sm text-red-500">{searchError}</p>}
          {searchLoading && <p className="mb-3 text-xs text-zinc-400">Recherche…</p>}

          <Card className="flex-1 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <Search className="mx-auto mb-2 h-6 w-6 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm text-zinc-400 dark:text-zinc-600">
                    Le panier est vide. Scannez ou recherchez un produit pour commencer.
                  </p>
                </div>
              </div>
            ) : (
              cart.map((line) => (
                <CartLineRow
                  key={line.product.id}
                  line={line}
                  onIncrease={() => updateQuantity(line.product.id, 1)}
                  onDecrease={() => updateQuantity(line.product.id, -1)}
                  onRemove={() => removeLine(line.product.id)}
                />
              ))
            )}
          </Card>
        </div>

        {/* Colonne récapitulatif + paiement */}
        <div className="w-96 shrink-0">
          <Card className="sticky top-8 p-5">
            <div className="mb-4 border-b border-border-light pb-4 dark:border-border-dark">
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Client (optionnel)
              </p>
              {customer ? (
                <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">{customer.name}</p>
                    {customer.creditBalance > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Dette actuelle : {formatXOF(customer.creditBalance)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setCustomer(null)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerSearch(true);
                    }}
                    onFocus={() => setShowCustomerSearch(true)}
                    placeholder="Rechercher un client (nom ou téléphone)…"
                    className="pl-9 text-sm"
                  />
                  {showCustomerSearch && customerResults.length > 0 && (
                    <Card className="absolute z-10 mt-1 w-full overflow-hidden">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setCustomer(c);
                            setCustomerSearch('');
                            setCustomerResults([]);
                            setShowCustomerSearch(false);
                          }}
                          className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          <span className="text-zinc-800 dark:text-zinc-200">{c.name}</span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-500">
                            {c.phone ?? ''}
                          </span>
                        </button>
                      ))}
                    </Card>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2 border-b border-border-light pb-4 dark:border-border-dark">
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Sous-total</span>
                <span>{formatXOF(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Remise</span>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-28 py-1 text-right"
                />
              </div>
              {user?.tvaEnabled && (
                <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                  <span>TVA ({user.tvaRate}%)</span>
                  <span>{formatXOF(tvaAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                <span>Total</span>
                <span>{formatXOF(total)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Paiement</p>
              {payments.map((p) => (
                <div key={p.id} className="flex gap-2">
                  <Select
                    value={p.method}
                    onChange={(e) => updatePayment(p.id, { method: e.target.value as PaymentMethod })}
                    className="w-36"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Montant"
                    value={p.amount}
                    onChange={(e) => updatePayment(p.id, { amount: e.target.value })}
                    className="flex-1"
                  />
                  {payments.length > 1 && (
                    <button
                      onClick={() => removePayment(p.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {payments.some((p) => p.method === 'CREDIT') && !customer && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Sélectionnez un client ci-dessus pour valider un paiement à crédit.
                </p>
              )}
              <button
                onClick={addPaymentLine}
                className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter un mode de paiement
              </button>

              <div className="flex justify-between border-t border-border-light pt-3 text-sm dark:border-border-dark">
                <span className="text-zinc-500 dark:text-zinc-500">Total payé</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {formatXOF(paymentsTotal)}
                </span>
              </div>
              {changeDue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500 dark:text-zinc-500">Monnaie à rendre</span>
                  <span className="font-medium text-brand-600">{formatXOF(changeDue)}</span>
                </div>
              )}
            </div>

            {offlineSuccess && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                Vente enregistrée hors-ligne. Elle sera synchronisée automatiquement au retour de
                la connexion.
              </p>
            )}
            {submitError && <p className="mt-3 text-sm text-red-500">{submitError}</p>}

            <Button
              className="mt-4 w-full"
              onClick={handleCheckout}
              loading={submitting}
              disabled={cart.length === 0}
            >
              Encaisser {cart.length > 0 && formatXOF(total)}
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
