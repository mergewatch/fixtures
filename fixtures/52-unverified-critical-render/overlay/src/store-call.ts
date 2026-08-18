export async function lookupUser(id: string): Promise<unknown> {
  return store.query(`SELECT * FROM users WHERE id = '${id}'`);
}

declare const store: { query(sql: string): Promise<unknown> };
