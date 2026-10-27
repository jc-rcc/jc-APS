'use strict';
const { Pool, types } = require('pg');
const { AsyncLocalStorage } = require('node:async_hooks');
// DATE values must remain calendar dates, independent of the server timezone.
types.setTypeParser(1082, value => value);
const scope = new AsyncLocalStorage();
let pool;
function configuration() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the new JC-APS PostgreSQL database.');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL.');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  // URL SSL options can override pg's verification configuration; use ours only.
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: local && !process.env.VERCEL && process.env.NODE_ENV !== 'production' ? false : {
      rejectUnauthorized: true,
      ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, '\n') } : {})
    },
    max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000,
    allowExitOnIdle: true
  };
}
function getPool() {
  if (!pool) {
    pool = new Pool(configuration());
    pool.on('error', () => console.error('[PostgreSQL] Idle database connection closed.'));
  }
  return pool;
}
// Keep the row-array contract used by the state serializer; all SQL is PostgreSQL.
function connection() {
  const client = scope.getStore();
  if (!client) throw new Error('A database transaction is required.');
  return { query: async (sql, params = []) => [(await client.query(sql, params)).rows] };
}
async function transaction(work, { readOnly = false, lock = true } = {}) {
  if (scope.getStore()) return work(connection());
  const client = await getPool().connect();
  try {
    await client.query(readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
    await client.query('SET LOCAL search_path TO jc_aps, pg_catalog');
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SET LOCAL statement_timeout = '30s'");
    // Transaction-scoped locks survive transaction pooling and release on rollback.
    if (lock && !readOnly) await client.query('SELECT pg_advisory_xact_lock(746203, 1)');
    const result = await scope.run(client, () => work(connection()));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '55P03') throw Object.assign(new Error('Another save is in progress. Please try again.'), { status: 503 });
    throw error;
  } finally {
    client.release();
  }
}
async function query(sql, params = []) {
  if (scope.getStore()) return connection().query(sql, params);
  return transaction(c => c.query(sql, params), { lock: false });
}
const readTransaction = work => transaction(work, { readOnly: true, lock: false });
async function close() { if (pool) { await pool.end(); pool = undefined; } }
module.exports = { configuration, transaction, readTransaction, connection, query, close };
