'use strict';
const fs = require('node:fs');
const path = require('node:path');
const postgres = require('./postgres');

async function init() {
  return postgres.transaction(async c => {
    const sql = fs.readFileSync(path.join(__dirname, 'sql/postgres.sql'), 'utf8');
    await c.query(sql);
    const [rows] = await c.query('SELECT COUNT(*)::integer AS count FROM users');
    if (rows[0].count > 0) return { created: true, seeded: false };
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
    // The checked-in demo has no working passwords; bootstrap assigns private ones.
    for (const account of Object.values(seed.auth || {})) {
      if (account.pass && !account.pass.startsWith('$2')) {
        account.pass = await require('bcryptjs').hash(account.pass, 10);
      }
    }
    await require('../db').persistState(seed);
    console.log('[PostgreSQL] Assignment schema and demo seed ready.');
    return { created: true, seeded: true };
  });
}
module.exports = { init };
