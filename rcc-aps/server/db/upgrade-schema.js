'use strict';
const { sqlDate, dateColumns } = require('./state-writer');
async function upgradeSchema(c) {
  const [versions] = await c.query("SELECT cfg_value FROM app_config WHERE cfg_key='schemaVersion'");
  if (Number(versions[0]?.cfg_value) >= 2) return;
  const extras = {
    salaryBase: 'DECIMAL(12,2) NULL', absenceWorkDays: 'DECIMAL(6,2) NULL', absenceDays: 'DECIMAL(6,2) NULL',
    teachingSemester: 'VARCHAR(20) NULL', teachingSchoolYear: 'VARCHAR(30) NULL'
  };
  for (const [column, type] of Object.entries(extras)) {
    const [found] = await c.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payroll_records' AND COLUMN_NAME=?", [column]);
    if (!found.length) await c.query('ALTER TABLE payroll_records ADD COLUMN `' + column + '` ' + type);
  }
  // Preflight every date before applying any conversion.
  const plan = [];
  for (const [table, columns] of Object.entries(dateColumns)) {
    const [rows] = await c.query('SELECT * FROM `' + table + '`');
    for (const row of rows) for (const column of columns) {
      try { plan.push({ table, column, row, value: sqlDate(row[column]) }); }
      catch (error) { throw new Error('Cannot migrate invalid date in ' + table + '.' + column + '; source records preserved'); }
    }
  }
  const [duplicate] = await c.query('SELECT empId, year, month FROM payroll_records GROUP BY empId, year, month HAVING COUNT(*)>1');
  if (duplicate.length) throw new Error('Duplicate payroll periods must be resolved before migration');
  await c.query('ALTER TABLE leave_records MODIFY days DECIMAL(6,2) NOT NULL DEFAULT 0');
  await c.query("ALTER TABLE payroll_records MODIFY bonuses MEDIUMTEXT NOT NULL DEFAULT ('[]')");
  await c.query('ALTER TABLE users MODIFY rankId INT NULL DEFAULT NULL');
  await c.query('UPDATE users SET rankId=NULL WHERE rankId=0');
  await c.query('ALTER TABLE attendance MODIFY empId INT NULL DEFAULT NULL');
  await c.query('UPDATE attendance SET empId=NULL WHERE empId=0');
  for (const item of plan) {
    const keys = item.table === 'bonus_payouts' ? ['empId','year'] : ['id'];
    // Empty strings are converted while columns are still VARCHAR.
    if (item.value !== null) await c.query('UPDATE `' + item.table + '` SET `' + item.column + '`=? WHERE ' + keys.map(key => '`' + key + '`=?').join(' AND '), [item.value, ...keys.map(key => item.row[key])]);
  }
  for (const [table, columns] of Object.entries(dateColumns)) for (const column of columns) {
    const [meta] = await c.query('SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?', [table,column]);
    if (meta[0].DATA_TYPE !== 'date') {
      await c.query('ALTER TABLE `' + table + '` MODIFY `' + column + '` VARCHAR(40) NULL DEFAULT NULL');
      await c.query('UPDATE `' + table + '` SET `' + column + '`=NULL WHERE `' + column + '`=\'\'');
      await c.query('ALTER TABLE `' + table + '` MODIFY `' + column + '` DATE NULL DEFAULT NULL');
    }
  }
  const [index] = await c.query("SHOW INDEX FROM payroll_records WHERE Key_name='uk_payroll_employee_period'");
  if (!index.length) await c.query('ALTER TABLE payroll_records ADD UNIQUE KEY uk_payroll_employee_period (empId,year,month)');
  const links = [
    ['auth','id','users','id'], ['profiles','id','users','id'], ['cash_advances','id','users','id'],
    ['bonus_payouts','empId','users','id'], ['payroll_records','empId','users','id'],
    ['leave_records','empId','users','id'], ['leave_records','typeId','leave_types','id'],
    ['attendance','empId','users','id'], ['teaching_load_records','empId','users','id'],
    ['teaching_load_classes','recordId','teaching_load_records','id'], ['users','rankId','teacher_ranks','id']
  ];
  for (const [table,column,parent,key] of links) {
    const name = 'fk_' + table + '_' + column;
    const [exists] = await c.query('SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_NAME=?', [name]);
    if (!exists.length) await c.query('ALTER TABLE `' + table + '` ADD CONSTRAINT `' + name + '` FOREIGN KEY (`' + column + '`) REFERENCES `' + parent + '` (`' + key + '`) ON DELETE RESTRICT ON UPDATE RESTRICT');
  }
  await c.query("INSERT INTO app_config (cfg_key,cfg_value) VALUES ('schemaVersion','2') ON DUPLICATE KEY UPDATE cfg_value='2'");
  console.log('[MySQL] Schema v2: payroll basis, DATE fields, half-day leave, unique payroll periods and foreign keys verified.');
}
module.exports = { upgradeSchema };
