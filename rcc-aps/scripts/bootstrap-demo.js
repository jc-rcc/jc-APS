'use strict';
// Run once against the NEW assignment database, before deploying publicly.
async function main() {
  if (!process.env.DB_NAME || process.env.DB_NAME === 'rcc_aps') {
    throw new Error('Set a separate assignment DB_NAME, such as jc_aps_demo.');
  }
  const names = ['DEMO_ADMIN_PASSWORD', 'DEMO_FINANCE_PASSWORD', 'DEMO_EMPLOYEE_PASSWORD'];
  for (const name of names) {
    if (!process.env[name] || process.env[name].trim().length < 16) {
      throw new Error(`${name} must contain at least 16 non-padding characters.`);
    }
  }
  await require('../server/db/init').init();
  const db = require('../server/db');
  const bcrypt = require('bcryptjs');
  const accounts = Object.values((await db.assembleState()).auth);
  for (const [index, role] of ['admin', 'finance', 'employee'].entries()) {
    const account = accounts.find(item => item.role === role);
    if (!account) throw new Error(`Missing demo ${role} account.`);
    await db.updatePassword(account.id, await bcrypt.hash(process.env[names[index]].trim(), 10));
  }
  console.log('Demo database ready. Supply demo credentials privately to the evaluator.');
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
