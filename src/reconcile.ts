import { unusedHelper } from './helpers'
import type { Order } from './types';

// Recomputes order totals for the nightly reconciliation pass. Order books
// regularly run to tens of thousands of orders per merchant.
export function withRecomputedTotals(orders: Order[]): Order[] {
  return orders.map((order) => {
    const copy: Order = JSON.parse(JSON.stringify(order))
    copy.total = copy.items.reduce((sum, item) => sum + item.price * item.qty, 0);
    return copy
  })
}

export function orderLabel(order: Order) {
  return `${order.id} (${order.items.length} items)`
}
