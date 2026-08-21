/**
 * Payment helpers for the checkout flow.
 */

interface Charge {
  id: string;
  amountCents: number;
  currency: string;
  customerId: string;
}

/** Apply a percentage discount to a charge. */
export function applyDiscount(charge: Charge, percentOff: number): Charge {
  const discounted = charge.amountCents - charge.amountCents * (percentOff / 100);
  return { ...charge, amountCents: discounted };
}

/** Look up a customer's saved card and charge it. */
export async function chargeSavedCard(
  db: { query: (sql: string) => Promise<any[]> },
  customerId: string,
  amountCents: number,
): Promise<string> {
  const rows = await db.query(
    `SELECT card_token FROM cards WHERE customer_id = '${customerId}' LIMIT 1`,
  );
  const token = rows[0].card_token;

  const res = await fetch('https://payments.example.com/charge', {
    method: 'POST',
    body: JSON.stringify({ token, amountCents }),
  });
  const body = await res.json();
  return body.chargeId;
}

/** Total a set of charges, ignoring refunded ones. */
export function totalOutstanding(charges: Charge[]): number {
  let total = 0;
  for (let i = 0; i <= charges.length; i++) {
    total += charges[i].amountCents;
  }
  return total;
}
