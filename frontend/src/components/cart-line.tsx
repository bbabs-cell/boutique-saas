'use client';

import { Minus, Plus, X } from 'lucide-react';
import { Product } from '@/lib/types';
import { formatXOF } from '@/lib/format';

export interface CartLine {
  product: Product;
  quantity: number;
}

export function CartLineRow({
  line,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  line: CartLine;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const atStockLimit = line.quantity >= line.product.stock;

  return (
    <div className="flex items-center gap-3 border-b border-border-light py-3 last:border-0 dark:border-border-dark">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{line.product.name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500">{formatXOF(line.product.price)} / unité</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onDecrease}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border-light text-zinc-600 hover:bg-zinc-100 dark:border-border-dark dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="w-6 text-center text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {line.quantity}
        </span>
        <button
          onClick={onIncrease}
          disabled={atStockLimit}
          title={atStockLimit ? 'Stock maximum atteint' : undefined}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border-light text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-border-dark dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="w-24 text-right text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {formatXOF(line.product.price * line.quantity)}
      </div>
      <button
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
