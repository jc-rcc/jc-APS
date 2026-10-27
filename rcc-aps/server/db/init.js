'use strict';
// Auto-initialization: creates the database, tables, and seed data on
// first run so the system works out-of-the-box after a fresh clone.
const fs = require('fs');
const path = require('path');

const DB_NAME = process.env.DB_NAME || 'rcc_aps';

async function init() {
  const mysql = require('mysql2/promise');

  // Step 1: Connect without selecting a database
  const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
  dateStrings: true,
  ...(process.env.TIDB_ENABLE_SSL === 'true'
    ? { ssl: { minVersion: 'TLSv1.2' } }
    : {})
});

  try {
    // Step 2: Create database if not exists
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[MySQL] Database "${DB_NAME}" ready.`);
  } finally {
    await conn.end();
  }

  // Step 3: Run schema.sql (CREATE TABLE IF NOT EXISTS for all tables)
  const schemaPath = path.join(__dirname, 'sql', 'schema.sql');
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('Invalid database name.');
  const schema = fs.readFileSync(schemaPath, 'utf8').replace(/\brcc_aps\b/g, DB_NAME);
  const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  charset: 'utf8mb4',
  dateStrings: true,
  ...(process.env.TIDB_ENABLE_SSL === 'true'
    ? { ssl: { minVersion: 'TLSv1.2' } }
    : {})
});
  const poolConn = await pool.getConnection();

  try {
    // Strip SQL comments, then split into statements
    const clean = schema
      .split(/\r?\n/)
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    const statements = clean
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await poolConn.query(stmt);
    }
    console.log(`[MySQL] Schema applied (${statements.length} statements).`);

    // Step 3b: Migration — add new columns to existing tables (idempotent)
    const migrations = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS rankId INT NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS rankName VARCHAR(120) NOT NULL DEFAULT \'\'',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS rateCustom TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS schoolLevel VARCHAR(20) NOT NULL DEFAULT \'\'',
      'ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS subjectBreakdown TEXT',
      'ALTER TABLE payroll_records ADD COLUMN IF NOT EXISTS payNote VARCHAR(500) DEFAULT \'\'',
      'ALTER TABLE teaching_load_classes ADD COLUMN IF NOT EXISTS level VARCHAR(30) NOT NULL DEFAULT \'\''
    ];
    for (const m of migrations) {
      try { await poolConn.query(m); } catch (e) { /* ignore duplicate column errors */ }
    }
    const [customDedCols] = await poolConn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_records' AND COLUMN_NAME = 'customDeds'"
    );
    if (!customDedCols.length) await poolConn.query('ALTER TABLE payroll_records ADD COLUMN customDeds TEXT');
    const [photoCols] = await poolConn.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'profiles' AND COLUMN_NAME = 'photo'"
    );
    if (!photoCols.length) await poolConn.query('ALTER TABLE profiles ADD COLUMN photo MEDIUMTEXT');
    const [googleCols] = await poolConn.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'auth' AND COLUMN_NAME = 'googleSub'");
    if (!googleCols.length) await poolConn.query('ALTER TABLE auth ADD COLUMN googleSub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL DEFAULT NULL');
    const [googleIndexes] = await poolConn.query("SHOW INDEX FROM auth WHERE Key_name = 'uk_auth_google_sub'");
    if (!googleIndexes.length) await poolConn.query('ALTER TABLE auth ADD UNIQUE KEY uk_auth_google_sub (googleSub)');
    console.log('[MySQL] Migration: users + payroll_records + teaching_load_classes columns verified.');

    // Step 3c: Migration — rename teacher_ranks.ratePerHour → rate (idempotent)
    const [rateCols] = await poolConn.query(
      'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'teacher_ranks\' AND COLUMN_NAME = \'ratePerHour\''
    );
    if (rateCols.length) {
      await poolConn.query('ALTER TABLE teacher_ranks CHANGE COLUMN ratePerHour rate DECIMAL(10,2) NOT NULL DEFAULT 0');
      console.log('[MySQL] Migration: teacher_ranks.ratePerHour renamed to rate.');
    }
  } finally {
    poolConn.release();
  }

  const migrationConnection = await pool.getConnection();
  try { await require('./upgrade-schema').upgradeSchema(migrationConnection); }
  finally { migrationConnection.release(); }

  // Step 4: Check if users table is empty → seed if needed
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  if (rows[0].cnt > 0) {
    console.log(`[MySQL] Users table has ${rows[0].cnt} records — skipping seed.`);
    // Seed teacher_ranks if empty (even when users exist — for existing DBs)
    const [rankRows] = await pool.query('SELECT COUNT(*) AS cnt FROM teacher_ranks');
    const seedPath0 = path.join(__dirname, 'seed.json');
    const seedData0 = fs.existsSync(seedPath0) ? JSON.parse(fs.readFileSync(seedPath0, 'utf8')) : {};
    if (rankRows[0].cnt === 0 && Array.isArray(seedData0.teacherRanks) && seedData0.teacherRanks.length) {
      for (const r of seedData0.teacherRanks) {
        await pool.query('INSERT INTO teacher_ranks (id, department, rank, rate) VALUES (?,?,?,?)', [r.id, r.department, r.rank, r.rate]);
      }
      console.log(`[MySQL] Seeded ${seedData0.teacherRanks.length} teacher ranks.`);
      const maxRankId0 = Math.max(...seedData0.teacherRanks.map(r => r.id));
      await pool.query('INSERT INTO app_config (cfg_key, cfg_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE cfg_value = ?', ['nextRankId', String(maxRankId0 + 1), String(maxRankId0 + 1)]);
      console.log(`[MySQL] nextRankId set to ${maxRankId0 + 1}.`);
    }
    // Seed Graduate School ranks if missing (existing DBs that predate the 4th dept)
    const [gradRows] = await pool.query('SELECT COUNT(*) AS cnt FROM teacher_ranks WHERE department = \'Graduate School\'');
    if (gradRows[0].cnt === 0 && Array.isArray(seedData0.teacherRanks)) {
      const gradRanks = seedData0.teacherRanks.filter(r => r.department === 'Graduate School');
      if (gradRanks.length) {
        for (const r of gradRanks) {
          await pool.query('INSERT INTO teacher_ranks (id, department, rank, rate) VALUES (?,?,?,?)', [r.id, r.department, r.rank, r.rate]);
        }
        console.log(`[MySQL] Seeded ${gradRanks.length} Graduate School teacher ranks.`);
        const maxRankId = Math.max(...gradRanks.map(r => r.id));
        await pool.query('INSERT INTO app_config (cfg_key, cfg_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE cfg_value = ?', ['nextRankId', String(maxRankId + 1), String(maxRankId + 1)]);
        console.log(`[MySQL] nextRankId set to ${maxRankId + 1}.`);
      }
    }
    await pool.end();
    return { created: true, seeded: false };
  }

  // Step 5: Load seed data and persist
  const seedPath = path.join(__dirname, 'seed.json');
  if (!fs.existsSync(seedPath)) {
    console.warn('[MySQL] seed.json not found — skipping seed data.');
    await pool.end();
    return { created: true, seeded: false };
  }

  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const db = require('../db');
  for (const account of Object.values(seed.auth || {})) {
    if (account.pass && !account.pass.startsWith('$2')) account.pass = await require('bcryptjs').hash(account.pass,10);
  }
  await db.persistState(seed);
  console.log(`[MySQL] Seed data loaded: ${seed.users.length} users, ${seed.sssTable.length} SSS brackets, ${seed.birData.length} BIR brackets.`);

  await pool.end();
  return { created: true, seeded: true };
}

module.exports = { init };
