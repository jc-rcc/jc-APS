'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

async function backup() {
  const c = await require('mysql2/promise').createConnection({ host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'rcc_aps', dateStrings: true });
  try {
    await c.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const [tables] = await c.query('SHOW FULL TABLES WHERE Table_type = \'BASE TABLE\'');
    const snapshot = { format: 1, database: process.env.DB_NAME || 'rcc_aps', createdAt: new Date().toISOString(), tables: {} };
    for (const row of tables) {
      const name = Object.values(row)[0];
      const [ddl] = await c.query('SHOW CREATE TABLE ??', [name]);
      const [records] = await c.query('SELECT * FROM ??', [name]);
      snapshot.tables[name] = { ddl: ddl[0]['Create Table'], records };
    }
    await c.commit();
    const folder = path.resolve(__dirname, '../../backups');
    fs.mkdirSync(folder, { recursive: true });
    const file = path.join(folder, 'before-database-upgrade-' + Date.now() + '.json.gz');
    const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(snapshot)));
    fs.writeFileSync(file, compressed, { flag: 'wx' });
    const restored = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)));
    for (const [name, data] of Object.entries(snapshot.tables)) {
      if (JSON.stringify(data) !== JSON.stringify(restored.tables[name])) throw new Error('Backup verification failed: ' + name);
    }
    fs.writeFileSync(file + '.sha256', crypto.createHash('sha256').update(compressed).digest('hex') + '\n');
    console.log(JSON.stringify({ file, verified: true, tableCount: tables.length, counts: Object.fromEntries(Object.entries(snapshot.tables).map(([name, data]) => [name, data.records.length])) }));
    return file;
  } finally { await c.end(); }
}
if (require.main === module) backup().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { backup };
