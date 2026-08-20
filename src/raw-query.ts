export async function findUser(id: string): Promise<unknown> {
  return db.query(`SELECT * FROM users WHERE id = '${id}'`);
}

declare const db: { query(sql: string): Promise<unknown> };
