'use strict';
// Apply only changed rows, preserving primary keys and unrelated records.
const identities = {
  users: ['id'], auth: ['id'], profiles: ['id'], cash_advances: ['id'],
  bonus_types: ['id'], bonus_payouts: ['empId', 'year'], deduction_categories: ['id'],
  payroll_records: ['empId', 'year', 'month'], sss_table: ['range'], bir_table: ['range'],
  phil_data: ['id'], pag_data: ['id'], teacher_ranks: ['id'],
  teaching_load_records: ['id'], teaching_load_classes: ['id'],
  app_config: ['cfg_key'], leave_types: ['id'], leave_records: ['id'], attendance: ['empId', 'date']
};
const deleteOrder = ['teaching_load_classes', 'leave_records', 'attendance', 'payroll_records', 'bonus_payouts', 'cash_advances', 'profiles', 'auth', 'teaching_load_records', 'users', 'teacher_ranks', 'leave_types', 'bonus_types', 'deduction_categories', 'sss_table', 'bir_table', 'phil_data', 'pag_data', 'app_config'];
const dateColumns = { users: ['date','hireDate','endDate'], payroll_records: ['date'], bonus_types: ['releaseDate','endDate'], bonus_payouts: ['date'], leave_records: ['startDate','endDate'], attendance: ['date'] };

function sqlDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0,10);
  let text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}(?:$|T| )/.test(text)) text = text.slice(0,10);
  else {
    const match = text.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
    const month = match && ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(match[1]);
    if (!match || month < 0) throw new Error('Invalid date format');
    text = match[3] + '-' + String(month + 1).padStart(2,'0') + '-' + match[2].padStart(2,'0');
  }
  const date = new Date(text + 'T00:00:00Z');
  if (isNaN(date) || date.toISOString().slice(0,10) !== text) throw new Error('Invalid calendar date');
  return text;
}

function incrementalConnection(connection) {
  const snapshots = new Map();
  const keyFor = (table, row) => JSON.stringify(identities[table].map(key => row[key] == null ? null : String(row[key])));
  const equal = (a,b) => {
    if (a == null || b == null) return a == null && b == null;
    if (['number','boolean'].includes(typeof a) || ['number','boolean'].includes(typeof b)) return Number(a) === Number(b);
    return String(a) === String(b);
  };
  const load = async table => {
    if (!snapshots.has(table)) {
      const [rows] = await connection.query('SELECT * FROM "' + table + '" FOR UPDATE');
      snapshots.set(table, { rows, seen: new Set() });
    }
    return snapshots.get(table);
  };
  return {
    async query(sql, params = []) {
      const match = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
      if (!match) throw new Error('Unexpected statement in state writer');
      const table = match[1];
      if (!identities[table]) throw new Error('Unsupported table');
      const columns = match[2].split(',').map(value => value.trim().replace(/`/g,''));
      const values = match[3].split(',');
      let index = 0;
      const row = Object.fromEntries(columns.map((col, i) => [col, values[i].trim() === '?' ? params[index++] : Number(values[i].trim())]));
      for (const col of dateColumns[table] || []) if (col in row) row[col] = sqlDate(row[col]);
      if (table === 'users' && !row.rankId) row.rankId = null;
      if (table === 'attendance' && !row.empId) row.empId = null;
      const snapshot = await load(table);
      const key = keyFor(table, row);
      if (snapshot.seen.has(key)) throw new Error('Duplicate submitted record in ' + table);
      snapshot.seen.add(key);
      const existing = snapshot.rows.find(record => keyFor(table, record) === key);
      const quoted = name => '"' + name + '"';
      if (!existing) return connection.query('INSERT INTO ' + quoted(table) + ' (' + columns.map(quoted).join(',') + ') VALUES (' + columns.map((_, i) => '$' + (i + 1)).join(',') + ')', columns.map(col => row[col]));
      const changed = columns.filter(col => !identities[table].includes(col) && !equal(row[col],existing[col]));
      if (!changed.length) return [{ affectedRows: 0 }];
      const where = identities[table].map((col, i) => quoted(col) + ' IS NOT DISTINCT FROM $' + (changed.length + i + 1)).join(' AND ');
      return connection.query('UPDATE ' + quoted(table) + ' SET ' + changed.map((col, i) => quoted(col) + '=$' + (i + 1)).join(',') + ' WHERE ' + where, [...changed.map(col => row[col]), ...identities[table].map(col => existing[col])]);
    },
    async flush() {
      for (const table of deleteOrder) {
        const snapshot = await load(table);
        for (const row of snapshot.rows) if (!snapshot.seen.has(keyFor(table, row))) {
          const where = identities[table].map((col, i) => '"' + col + '" IS NOT DISTINCT FROM $' + (i + 1)).join(' AND ');
          await connection.query('DELETE FROM "' + table + '" WHERE ' + where, identities[table].map(col => row[col]));
        }
      }
      // The outer PostgreSQL transaction owns COMMIT/ROLLBACK and the write lock.
    }
  };
}
module.exports = { incrementalConnection, sqlDate, dateColumns };
