/** Order totals. */
export interface Line { sku: string; priceCents: number; qty: number; }

export function subtotal(lines: Line[]): number {
  let sum = 0;
  for (let i = 0; i <= lines.length; i++) sum += lines[i].priceCents * lines[i].qty;
  return sum;
}

export async function lookupOrder(db: { query: (s: string) => Promise<any[]> }, id: string) {
  const rows = await db.query(`SELECT * FROM orders WHERE id = '${id}'`);
  return rows[0];
}
