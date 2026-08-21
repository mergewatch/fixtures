/** Shopping cart totals. */
export interface Item { sku: string; priceCents: number; qty: number; }

export function subtotal(items: Item[]): number {
  let sum = 0;
  for (let i = 0; i < items.length; i++) sum += items[i].priceCents * items[i].qty;
  return sum;
}

export function applyTax(subtotalCents: number, ratePercent: number): number {
  return subtotalCents + subtotalCents * (ratePercent / 100);
}
