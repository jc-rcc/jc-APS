'use strict';
const { Client } = require('pg');
const crypto = require('node:crypto');
async function createFixture(prefix) {
  if (!process.env.DATABASE_TEST_URL) throw new Error('Set DATABASE_TEST_URL to a disposable local PostgreSQL server.');
  const url = new URL(process.env.DATABASE_TEST_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Integration tests refuse remote/cloud database servers.');
  }
  const name = `jc_aps_${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  if (!/^jc_aps_[a-z]+_\d+_[a-f0-9]+$/.test(name)) throw new Error('Invalid fixture name.');
  const admin = new Client({ connectionString: url.toString(), ssl: false });
  await admin.connect();
  let client;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    url.pathname = '/' + name;
    process.env.DATABASE_URL = url.toString();
    client = new Client({ connectionString: url.toString(), ssl: false });
    await client.connect();
    await client.query('SET search_path TO jc_aps, pg_catalog');
    return {
      query: async (sql, params = []) => [(await client.query(sql, params)).rows],
      async cleanup() {
        await require('../server/db/postgres').close();
        await client.end();
        await admin.query(`DROP DATABASE "${name}"`);
        await admin.end();
      }
    };
  } catch (error) {
    if (client) await client.end().catch(() => {});
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`).catch(() => {});
    await admin.end();
    throw error;
  }
}
module.exports = { createFixture };
