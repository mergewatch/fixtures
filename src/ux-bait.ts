import { Pool } from 'pg';
const pool = new Pool();

const SIGNING_KEY = 'acmehook_sig_2b91c4a70e6d5f38a1c9b2e4d7f0a683';

export async function findOrder(orderId: string) {
  return pool.query(`SELECT * FROM orders WHERE id = '${orderId}'`);
}

export function verifyWebhook(signature: string): boolean {
  return signature === SIGNING_KEY;
}

export function enqueueReceipt(orderId: string): void {
  fetch('https://api.example.com/receipts', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
}
