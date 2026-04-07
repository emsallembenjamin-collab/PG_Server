import type { RowDataPacket } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';

/**
 * InnoDB may use the composite UNIQUE on (merchant_id, …) as the supporting index for
 * FK_merchant_balances_merchant. TypeORM synchronize often DROPs that index before adding
 * replacements, which fails with:
 *   Cannot drop index 'UQ_merchant_bal_merchant_currency': needed in a foreign key constraint
 *
 * Creating standalone indexes on FK columns first lets TypeORM alter the table safely.
 * Idempotent: skips if table missing or index already exists.
 */
export async function ensureMerchantBalanceIndexesBeforeSync(opts: {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}): Promise<void> {
  let conn: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    conn = await createConnection({
      host: opts.host,
      port: opts.port,
      user: opts.username,
      password: opts.password,
      database: opts.database,
    });

    const schema = opts.database;
    const [tables] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'merchant_balances'`,
      [schema],
    );
    if (!tables?.[0] || Number((tables[0] as { c: number }).c) === 0) {
      return;
    }

    async function indexExists(name: string): Promise<boolean> {
      const [rows] = await conn!.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'merchant_balances' AND INDEX_NAME = ?`,
        [schema, name],
      );
      return Number((rows?.[0] as { c: number })?.c) > 0;
    }

    async function columnExists(col: string): Promise<boolean> {
      const [rows] = await conn!.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'merchant_balances' AND COLUMN_NAME = ?`,
        [schema, col],
      );
      return Number((rows?.[0] as { c: number })?.c) > 0;
    }

    async function createIndexIfMissing(
      name: string,
      columnList: string,
    ): Promise<void> {
      if (await indexExists(name)) return;
      try {
        await conn!.query(
          `CREATE INDEX \`${name}\` ON \`merchant_balances\` (${columnList})`,
        );
      } catch (e: unknown) {
        const err = e as { errno?: number; code?: string };
        if (err.errno === 1061 || err.code === 'ER_DUP_KEYNAME') {
          return;
        }
        throw e;
      }
    }

    await createIndexIfMissing('IDX_merchant_balances_merchant_id', '`merchant_id`');
    if (await columnExists('currency_id')) {
      await createIndexIfMissing('IDX_merchant_balances_currency_id', '`currency_id`');
    }
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}
