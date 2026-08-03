interface SaleForProfit {
  subtotal: number;
  discount: number;
  items: { quantity: number; unitCost: number }[];
}

/**
 * Bénéfice = (subtotal - discount) - somme(quantity × unitCost).
 * La TVA collectée est exclue : ce n'est pas du bénéfice pour la boutique.
 */
export function computeSaleProfit(sale: SaleForProfit): number {
  const costOfGoods = sale.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  return sale.subtotal - sale.discount - costOfGoods;
}

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function startOfUTCWeek(date: Date): Date {
  const start = startOfUTCDay(date);
  // Semaine calendaire démarrant le lundi.
  const day = start.getUTCDay(); // 0 = dimanche
  const diff = (day + 6) % 7; // nombre de jours depuis lundi
  start.setUTCDate(start.getUTCDate() - diff);
  return start;
}

export function startOfUTCMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function startOfUTCYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
