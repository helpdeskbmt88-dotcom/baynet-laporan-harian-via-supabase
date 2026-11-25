import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = new URL(process.env.SUPABASE_DB_URL);
const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
// node-postgres parses sslmode after explicit options. Keep TLS policy here.
url.searchParams.delete('sslmode');
const pool = new pg.Pool({
  connectionString: url.href,
  ssl: loopback && !process.env.VERCEL ? false : {
    rejectUnauthorized: true,
    ca: await readFile(new URL('./supabase-ca.crt', import.meta.url), 'utf8'),
  },
  max: 1,
  connectionTimeoutMillis: 10000,
  allowExitOnIdle: true,
});
pool.on('error', error => console.error('Koneksi PostgreSQL terputus:', error.code));
const transactions = new AsyncLocalStorage();

async function withTransaction(fn, lockWrites) {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN');
    // The Supabase transaction pooler may select a different session next time.
    await client.query('SET LOCAL search_path = pg_catalog, baynet');
    if (lockWrites) {
      // Serialize multi-step approvals and attachment edits, as in SQLite.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('baynet:report-writes'))");
    }
    const result = await transactions.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    client.release(discard);
  }
}

export function transaction(fn) {
  return withTransaction(fn, true);
}

function query(sql, args) {
  let position = 0;
  const statement = sql.replace(/\?/g, () => '$' + (++position));
  const execute = () => transactions.getStore().query(statement, args);
  return transactions.getStore() ? execute() : withTransaction(execute, false);
}

export const db = {
  async all(sql, ...args) { return (await query(sql, args)).rows; },
  async get(sql, ...args) { return (await query(sql, args)).rows[0]; },
  run(sql, ...args) { return query(sql, args); },
};

const schemaExists = "SELECT to_regclass('baynet.settings') IS NOT NULL AS ready";
if (!(await pool.query(schemaExists)).rows[0].ready) {
  const ddl = await readFile(new URL('./postgres-schema.sql', import.meta.url), 'utf8');
  await transaction(async () => {
    const client = transactions.getStore();
    if (!(await client.query(schemaExists)).rows[0].ready) await client.query(ddl);
  });
}
