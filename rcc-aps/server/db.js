// MySQL data-access layer for RCC-APS. MySQL (rcc_aps) is the single source
// of truth for all application state. Exposes:
//   - assembleState()  : read all tables -> a full state object (frontend shape)
//   - persistState(s)  : write a full state object into the tables (transaction)
//   - status()         : connection health info for /api/db/status
'use strict';
require('mysql2');

let pool = null;

function getPool() {
  if (pool) return pool;
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rcc_aps',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    charset: 'utf8mb4',
    dateStrings: true,
    ...(process.env.TIDB_ENABLE_SSL === 'true'
      ? { ssl: { minVersion: 'TLSv1.2' } }
      : {})
  });

  return pool;
}

async function q(sql, params) {
  const [rows] = await getPool().execute(sql, params || []);
  return rows;
}

async function status() {
  try {
    const rows = await q('SELECT NOW() AS server_time, DATABASE() AS dbname');
    const [counts] = await q(
      `SELECT
         (SELECT COUNT(*) FROM users)                     AS users,
         (SELECT COUNT(*) FROM payroll_records)           AS payroll_records,
         (SELECT COUNT(*) FROM attendance)                AS attendance,
         (SELECT COUNT(*) FROM sss_table)                 AS sss_rows,
         (SELECT COUNT(*) FROM app_config)                AS config_keys`
    );
    return {
      connected: true,
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'rcc_aps',
      serverTime: (rows[0] && rows[0].server_time) ? new Date(rows[0].server_time).toISOString() : null,
      counts
    };
  } catch (e) {
    return { connected: false, error: e.message };
  }
}

// ── READ: assemble the full state object the frontend expects ───
async function assembleState() {
  const [users, authRows, profRows, cashRows, bonusTypes, payoutRows,
          dedCat, payroll, sss, phil, pag, bir, cfg, leaveTypes,
          leaveRecords, attendance, ranks, tlRecords, tlClasses] = await Promise.all([
    q('SELECT * FROM users ORDER BY id'),
    q('SELECT * FROM auth ORDER BY id'),
    q('SELECT * FROM profiles'),
    q('SELECT * FROM cash_advances'),
    q('SELECT * FROM bonus_types ORDER BY id'),
    q('SELECT * FROM bonus_payouts'),
    q('SELECT * FROM deduction_categories ORDER BY id'),
    q('SELECT * FROM payroll_records ORDER BY id'),
    q('SELECT * FROM sss_table ORDER BY id'),
    q('SELECT * FROM phil_data WHERE id = 1'),
    q('SELECT * FROM pag_data WHERE id = 1'),
    q('SELECT * FROM bir_table ORDER BY id'),
    q('SELECT * FROM app_config'),
    q('SELECT * FROM leave_types ORDER BY id'),
    q('SELECT * FROM leave_records ORDER BY id'),
    q('SELECT * FROM attendance ORDER BY id'),
    q('SELECT * FROM teacher_ranks ORDER BY id'),
    q('SELECT * FROM teaching_load_records ORDER BY id'),
    q('SELECT * FROM teaching_load_classes ORDER BY id')
  ]);

  const num = v => { const n = parseFloat(v); return (isNaN(n) && v != null) ? v : (v == null ? null : n); };

  const usersOut = users.map(u => ({
    id: u.id, first: u.first, last: u.last, email: u.email, role: u.role,
    status: u.status, date: u.date, salary: num(u.salary),
    classification: u.classification, department: u.department,
    hireDate: u.hireDate, hourlyRate: num(u.hourlyRate),
    absenceDays: num(u.absenceDays), hoursWorked: num(u.hoursWorked),
    endDate: u.endDate || undefined,
    rankId: num(u.rankId), rankName: u.rankName || '',
    rateCustom: !!u.rateCustom, schoolLevel: u.schoolLevel || ''
  }));

  const auth = {};
  authRows.forEach(a => { auth[a.id] = {
    id: a.id, email: a.email, pass: a.pass, label: a.label, icon: a.icon,
    page: a.page, role: a.role, status: a.status
  }; });

  const profiles = {};
  profRows.forEach(p => { profiles[p.id] = { empPhone: p.empPhone, empAddr: p.empAddr, photo: p.photo || '' }; });

  const cashAdvances = {};
  cashRows.forEach(c => { cashAdvances[c.id] = num(c.amount); });

  const bonusPayouts = {};
  payoutRows.forEach(p => { bonusPayouts[p.empId + '_' + p.year] = { date: p.date }; });

  const cfgObj = {};
  cfg.forEach(c => { cfgObj[c.cfg_key] = c.cfg_value; });

  return {
    users: usersOut,
    nextUserId: Math.max(parseInt(cfgObj.nextUserId, 10) || 1, ...users.map(row => Number(row.id) + 1)),
    cashAdvances,
    bonusTypes: bonusTypes.map(b => ({
      id: b.id, name: b.name, kind: b.kind, value: num(b.value),
      desc: b.desc, status: b.status, releaseDate: b.releaseDate, endDate: b.endDate
    })),
    nextBonusId: Math.max(parseInt(cfgObj.nextBonusId, 10) || 1, ...bonusTypes.map(row => Number(row.id) + 1)),
    auth,
    deductionCategories: dedCat.map(d => ({
      id: d.id, name: d.name, type: d.type, amount: num(d.amount),
      desc: d.desc, status: d.status
    })),
    nextDedCatId: Math.max(parseInt(cfgObj.nextDedCatId, 10) || 1, ...dedCat.map(row => Number(row.id) + 1)),
    payrollRecords: payroll.map(p => ({
      empId: p.empId, name: p.name, month: p.month, monthName: p.monthName,
      year: p.year, period: p.period, gross: num(p.gross),
      deMinimisSum: num(p.deMinimisSum), thirteenth: num(p.thirteenth),
      thirteenTaxable: num(p.thirteenTaxable), thirteenExempt: num(p.thirteenExempt),
      thirteenTax: num(p.thirteenTax), net: num(p.net), sss: num(p.sss),
      phil: num(p.phil), pag: num(p.pag), bir: num(p.bir), cash: num(p.cash),
      bonuses: (() => { try { return JSON.parse(p.bonuses || '[]'); } catch (e) { return []; } })(),
      subjectBreakdown: (() => { try { return JSON.parse(p.subjectBreakdown || '[]'); } catch (e) { return []; } })(),
      customDeds: (() => { try { return JSON.parse(p.customDeds || '[]'); } catch (e) { return []; } })(),
      payNote: p.payNote || '',
      date: p.date || '',
      salaryBase: num(p.salaryBase), absenceWorkDays: num(p.absenceWorkDays), absenceDays: num(p.absenceDays),
      teachingSemester: p.teachingSemester || null, teachingSchoolYear: p.teachingSchoolYear || null
    })),
    bonusPayouts,
    sssTable: sss.map(s => ({
      range: s.range, emp: num(s.emp), er: num(s.er),
      min: s.min != null ? num(s.min) : null, max: s.max != null ? num(s.max) : null
    })),
    philData: {
  rate: num(phil[0]?.rate ?? 5),
  min: num(phil[0]?.min ?? 500),
  max: num(phil[0]?.max ?? 5000),
  floor: num(phil[0]?.floor ?? 10000),
  ceiling: num(phil[0]?.ceiling ?? 100000)
},
    pagData: {
  rate1: num(pag[0]?.rate1 ?? 1),
  rate2: num(pag[0]?.rate2 ?? 2),
  empMax: num(pag[0]?.empMax ?? 100),
  erMax: num(pag[0]?.erMax ?? 100)
},
    birData: bir.map(b => ({
      range: b.range, base: num(b.base), rate: num(b.rate),
      min: b.min != null ? num(b.min) : null, max: b.max != null ? num(b.max) : null
    })),
    dedMeta: (() => { try { return JSON.parse(cfgObj.dedMeta || '{}'); } catch (e) { return {}; } })(),
    bonusExemptionLimit: parseInt(cfgObj.bonusExemptionLimit, 10) || 90000,
    workDays: parseFloat(cfgObj.workDays) || 22,
    leaveTypes: leaveTypes.map(l => ({ id: l.id, name: l.name, isPaid: !!l.isPaid })),
    nextLeaveTypeId: Math.max(parseInt(cfgObj.nextLeaveTypeId, 10) || 1, ...leaveTypes.map(row => Number(row.id) + 1)),
    leaveRecords: leaveRecords.map(l => ({
      id: l.id, empId: l.empId, typeId: l.typeId, startDate: l.startDate,
      endDate: l.endDate, days: l.days
    })),
    nextLeaveRecordId: Math.max(parseInt(cfgObj.nextLeaveRecordId, 10) || 1, ...leaveRecords.map(row => Number(row.id) + 1)),
    teacherRanks: ranks.map(r => ({
      id: r.id, department: r.department, rank: r.rank,
      rate: num(r.rate != null ? r.rate : r.ratePerHour)
    })),
    nextRankId: Math.max(parseInt(cfgObj.nextRankId, 10) || 1, ...ranks.map(row => Number(row.id) + 1)),
    teachingLoadRecords: tlRecords.map(r => ({
      id: r.id, empId: r.empId, semester: r.semester, schoolYear: r.schoolYear,
      classification: r.classification || 'Teaching', level: r.level || '',
      rankId: r.rankId || 0, rankName: r.rankName || '',
      rate: num(r.rate), rateUnit: r.rateUnit || '',
      salary: num(r.salary), workloadType: r.workloadType || 'hours',
      workloadValue: num(r.workloadValue), absences: num(r.absences),
      computedPay: num(r.computedPay), savedAt: r.savedAt || ''
    })),
    nextTeachingLoadId: Math.max(parseInt(cfgObj.nextTeachingLoadId, 10) || 1, ...tlRecords.map(row => Number(row.id) + 1)),
    nextTeachingLoadClassId: Math.max(parseInt(cfgObj.nextTeachingLoadClassId, 10) || 1, ...tlClasses.map(row => Number(row.id) + 1)),
    hoursPerWorkload: num(cfgObj.hoursPerWorkload) != null && !isNaN(parseFloat(cfgObj.hoursPerWorkload)) ? parseFloat(cfgObj.hoursPerWorkload) : 3,
    teachingLoadClasses: tlClasses.map(l => ({
      id: l.id, recordId: l.recordId, subject: l.subject || '',
      level: l.level || '',
      deptCode: l.deptCode || '', timeStart: l.timeStart || '',
      timeEnd: l.timeEnd || '', days: l.days || '',
      studentsMale: l.studentsMale || 0, studentsFemale: l.studentsFemale || 0,
      roomNo: l.roomNo || '', googleCode: l.googleCode || '',
      hoursPerWeek: num(l.hoursPerWeek), sortOrder: l.sortOrder || 0
    })),
    attendance: attendance.map(a => ({
      empId: a.empId, employeeId: a.employeeId, employeeEmail: a.employeeEmail,
      date: a.date, clockInAt: a.clockInAt, clockOutAt: a.clockOutAt,
      hours: num(a.hours)
    })),
    profiles,
    stateRevision: Number(cfgObj.stateRevision) || 0,
    savedAt: cfgObj.savedAt || new Date().toISOString()
  };
}

// ── WRITE: teardown a full state object into the relational tables ──
async function persistState(s) {
  const connection = await getPool().getConnection();
  const c = require('./db/state-writer').incrementalConnection(connection);
  try {
    await c.beginTransaction();

    // teacher ranks
    for (const r of s.teacherRanks || []) {
      await c.query(
        'INSERT INTO teacher_ranks (id, department, rank, rate) VALUES (?,?,?,?)',
        [r.id, r.department || 'College', r.rank || '', r.rate || 0]
      );
    }

    // users
    for (const u of s.users || []) {
      await c.query(
        `INSERT INTO users
           (id, first, last, email, role, status, date, salary, classification,
            department, hireDate, hourlyRate, absenceDays, hoursWorked, endDate,
            rankId, rankName, rateCustom, schoolLevel)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [u.id, u.first || '', u.last || '', (u.email || '').toLowerCase(),
         u.role || 'Employee', u.status || 'Active', u.date || '',
         u.salary || 0, u.classification || 'Non-Teaching', u.department || '',
         u.hireDate || '', u.hourlyRate || 0, u.absenceDays || 0,
         u.hoursWorked || 0, u.endDate || '',
         u.rankId || 0, u.rankName || '', u.rateCustom ? 1 : 0, u.schoolLevel || '']
      );
    }

    // auth
    for (const key of Object.keys(s.auth || {})) {
      const a = s.auth[key];
      if (!a) continue;
      await c.query(
        `INSERT INTO auth (id, email, pass, label, icon, page, role, status)
         VALUES (?,?,?,?,?,?,?,?)`,
        [a.id != null ? a.id : parseInt(key, 10) || 0,
         (a.email || '').toLowerCase(), a.pass || '', a.label || '',
         a.icon || '', a.page || '', a.role || 'employee', a.status || 'Active']
      );
    }

    // profiles
    for (const key of Object.keys(s.profiles || {})) {
      const p = s.profiles[key];
      if (!p) continue;
      await c.query(
        'INSERT INTO profiles (id, empPhone, empAddr, photo) VALUES (?,?,?,?)',
        [parseInt(key, 10) || 0, p.empPhone || '', p.empAddr || '', p.photo || '']
      );
    }

    // cash advances
    for (const key of Object.keys(s.cashAdvances || {})) {
      await c.query('INSERT INTO cash_advances (id, amount) VALUES (?,?)',
        [parseInt(key, 10) || 0, parseFloat(s.cashAdvances[key]) || 0]);
    }

    // bonus types
    for (const b of s.bonusTypes || []) {
      await c.query(
        `INSERT INTO bonus_types (id, name, kind, value, \`desc\`, status, releaseDate, endDate)
         VALUES (?,?,?,?,?,?,?,?)`,
        [b.id, b.name || '', b.kind || '', b.value || 0, b.desc || '',
         b.status || 'Active', b.releaseDate || '', b.endDate || '']
      );
    }

    // bonus payouts
    for (const key of Object.keys(s.bonusPayouts || {})) {
      const [empId, year] = key.split('_');
      const rec = s.bonusPayouts[key];
      await c.query(
        'INSERT INTO bonus_payouts (empId, year, date) VALUES (?,?,?)',
        [parseInt(empId, 10) || 0, parseInt(year, 10) || 0,
         (rec && rec.date) || '']
      );
    }

    // deduction categories
    for (const d of s.deductionCategories || []) {
      await c.query(
        `INSERT INTO deduction_categories (id, name, type, amount, \`desc\`, status)
         VALUES (?,?,?,?,?,?)`,
        [d.id, d.name || '', d.type || '', d.amount || 0, d.desc || '',
         d.status || 'Active']
      );
    }

    // payroll records (id is auto so we re-insert preserving order)
    for (const p of s.payrollRecords || []) {
      await c.query(
        `INSERT INTO payroll_records
           (empId, name, month, monthName, year, period, gross, deMinimisSum,
            thirteenth, thirteenTaxable, thirteenExempt, thirteenTax, net,
            sss, phil, pag, bir, cash, bonuses, subjectBreakdown, customDeds, payNote, date, salaryBase, absenceWorkDays, absenceDays, teachingSemester, teachingSchoolYear)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.empId, p.name || '', p.month || 0, p.monthName || '', p.year || 0,
         p.period || '', p.gross || 0, p.deMinimisSum || 0, p.thirteenth || 0,
         p.thirteenTaxable || 0, p.thirteenExempt || 0, p.thirteenTax || 0,
         p.net || 0, p.sss || 0, p.phil || 0, p.pag || 0, p.bir || 0,
         p.cash || 0, JSON.stringify(p.bonuses || []),
         JSON.stringify(p.subjectBreakdown || []), JSON.stringify(p.customDeds || []), p.payNote || '',
         p.date || '', p.salaryBase ?? null, p.absenceWorkDays ?? null, p.absenceDays ?? null, p.teachingSemester || null, p.teachingSchoolYear || null]
      );
    }

    // sss table
    for (const sr of s.sssTable || []) {
      await c.query(
        'INSERT INTO sss_table (`range`, emp, er, min, max) VALUES (?,?,?,?,?)',
        [sr.range || '', sr.emp || 0, sr.er || 0,
         sr.min != null ? sr.min : null, sr.max != null ? sr.max : null]
      );
    }

    // phil config
    const ph = s.philData || {};
    await c.query(
      'INSERT INTO phil_data (id, rate, min, max, floor, ceiling) VALUES (1,?,?,?,?,?)',
      [ph.rate != null ? ph.rate : 5, ph.min != null ? ph.min : 500,
       ph.max != null ? ph.max : 5000, ph.floor != null ? ph.floor : 10000,
       ph.ceiling != null ? ph.ceiling : 100000]
    );

    // pag-ibig config
    const pg = s.pagData || {};
    await c.query(
      'INSERT INTO pag_data (id, rate1, rate2, empMax, erMax) VALUES (1,?,?,?,?)',
      [pg.rate1 != null ? pg.rate1 : 1, pg.rate2 != null ? pg.rate2 : 2,
       pg.empMax != null ? pg.empMax : 100, pg.erMax != null ? pg.erMax : 100]
    );

    // bir table
    for (const br of s.birData || []) {
      await c.query(
        'INSERT INTO bir_table (`range`, base, rate, min, max) VALUES (?,?,?,?,?)',
        [br.range || '', br.base || 0, br.rate || 0,
         br.min != null ? br.min : null, br.max != null ? br.max : null]
      );
    }

    // teaching load records (employee-submitted, per semester+SY)
    for (const r of s.teachingLoadRecords || []) {
      await c.query(
        `INSERT INTO teaching_load_records
           (id, empId, semester, schoolYear, classification, level,
            rankId, rankName, rate, rateUnit, salary,
            workloadType, workloadValue, absences, computedPay, savedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [r.id, r.empId || 0, r.semester || '', r.schoolYear || '',
         r.classification || 'Teaching', r.level || '',
         r.rankId || 0, r.rankName || '', r.rate || 0, r.rateUnit || '',
         r.salary || 0, r.workloadType || 'hours',
         r.workloadValue || 0, r.absences || 0, r.computedPay || 0,
         r.savedAt || '']
      );
    }

    // schedule of classes rows (per teaching load record)
    for (const l of s.teachingLoadClasses || []) {
      await c.query(
        `INSERT INTO teaching_load_classes
           (id, recordId, subject, level, deptCode, timeStart, timeEnd, days,
            studentsMale, studentsFemale, roomNo, googleCode, hoursPerWeek, sortOrder)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [l.id, l.recordId || 0, l.subject || '', l.level || '', l.deptCode || '',
         l.timeStart || '', l.timeEnd || '', l.days || '',
         l.studentsMale || 0, l.studentsFemale || 0, l.roomNo || '',
         l.googleCode || '', l.hoursPerWeek || 0, l.sortOrder || 0]
      );
    }

    // app config
    const cfg = {
      schemaVersion: 2, stateRevision: Number(s.stateRevision) || 0,
      nextUserId: s.nextUserId || 1,
      nextBonusId: s.nextBonusId || 1,
      nextDedCatId: s.nextDedCatId || 1,
      nextLeaveTypeId: s.nextLeaveTypeId || 1,
      nextLeaveRecordId: s.nextLeaveRecordId || 1,
      nextRankId: s.nextRankId || 1,
      nextTeachingLoadId: s.nextTeachingLoadId || 1,
      nextTeachingLoadClassId: s.nextTeachingLoadClassId || 1,
      hoursPerWorkload: s.hoursPerWorkload || 3,
      bonusExemptionLimit: s.bonusExemptionLimit || 90000,
      workDays: s.workDays || 22,
      dedMeta: JSON.stringify(s.dedMeta || {}),
      savedAt: s.savedAt || new Date().toISOString()
    };
    for (const key of Object.keys(cfg)) {
      await c.query('INSERT INTO app_config (cfg_key, cfg_value) VALUES (?,?)',
        [key, String(cfg[key])]);
    }

    // leave types
    for (const l of s.leaveTypes || []) {
      await c.query('INSERT INTO leave_types (id, name, isPaid) VALUES (?,?,?)',
        [l.id, l.name || '', l.isPaid ? 1 : 0]);
    }

    // leave records
    for (const l of s.leaveRecords || []) {
      await c.query(
        'INSERT INTO leave_records (id, empId, typeId, startDate, endDate, days) VALUES (?,?,?,?,?,?)',
        [l.id, l.empId, l.typeId, l.startDate || '', l.endDate || '', l.days || 0]
      );
    }

    // attendance
    for (const a of s.attendance || []) {
      await c.query(
        `INSERT INTO attendance
           (empId, employeeId, employeeEmail, date, clockInAt, clockOutAt, hours)
         VALUES (?,?,?,?,?,?,?)`,
        [a.empId || 0, a.employeeId || '', (a.employeeEmail || '').toLowerCase(),
         a.date || '', a.clockInAt || '', a.clockOutAt || '', a.hours || 0]
      );
    }

    await c.commit();
    return { ok: true };
  } catch (e) {
    try { await c.rollback(); } catch (e2) {}
    throw e;
  } finally {
    c.release();
  }
}

async function withStateLock(work) {
  const lock = await getPool().getConnection();
  const name = (process.env.DB_NAME || 'rcc_aps') + '_write';
  let acquired = false;
  try {
    const [rows] = await lock.query('SELECT GET_LOCK(?, 15) AS acquired', [name]);
    acquired = Number(rows[0].acquired) === 1;
    if (!acquired) throw Object.assign(new Error('Another save is in progress. Please try again.'), { status: 503 });
    return await work();
  } finally {
    if (acquired) await lock.query('SELECT RELEASE_LOCK(?)', [name]);
    lock.release();
  }
}

async function saveClientState(submitted, token) {
  return withStateLock(async () => {
    const current = await assembleState();
    const { actorFor, visibleState, mergeState } = require('./state-access');
    const actor = actorFor(current, token);
    if (!Number.isInteger(submitted.stateRevision) || submitted.stateRevision !== current.stateRevision) {
      throw Object.assign(new Error('Records changed since you loaded this page. Reload and apply your changes again.'), { status: 409 });
    }
    const state = await mergeState(current, submitted, actor);
    await persistState(state);
    return visibleState(state, actor);
  });
}

async function syncHrisData(data, token, revision) {
  return withStateLock(async () => {
    const current = await assembleState();
    const { actorFor, mergeState, visibleState } = require('./state-access');
    const actor = actorFor(current,token);
    if (!['admin','finance'].includes(actor.role)) throw Object.assign(new Error('Access denied.'),{status:403});
    if (revision !== current.stateRevision) throw Object.assign(new Error('Records changed. Refresh before syncing HRIS.'),{status:409});
    const {submitted,counts} = require('./hris-sync').hrisSubmission(current,data,actor);
    const state = await mergeState(current,submitted,actor);
    await persistState(state);
    return { state:visibleState(state,actor),counts,source:data.source };
  });
}

async function updatePassword(userId, hashed) {
  return withStateLock(async () => {
    const c = await getPool().getConnection();
    try {
      await c.beginTransaction();
      await c.query('UPDATE auth SET pass = ? WHERE id = ?', [hashed, userId]);
      await c.query("INSERT INTO app_config (cfg_key,cfg_value) VALUES ('stateRevision','1') ON DUPLICATE KEY UPDATE cfg_value=CAST(cfg_value AS UNSIGNED)+1");
      await c.commit();
    } catch (error) { await c.rollback(); throw error; }
    finally { c.release(); }
  });
}

async function googleSignIn(claims) {
  const { isSchoolEmail, SCHOOL_DOMAIN } = require('./school-identity');
  if (!claims.sub || claims.email_verified !== true || claims.hd !== SCHOOL_DOMAIN || !isSchoolEmail(claims.email)) {
    throw Object.assign(new Error('Only verified @rcc.edu.ph accounts can sign in.'), {status:403});
  }
  return withStateLock(async () => {
    const c = await getPool().getConnection();
    const email = claims.email.trim().toLowerCase();
    try {
      await c.beginTransaction();
      const [matches] = await c.query('SELECT a.*, u.status AS employeeStatus FROM auth a JOIN users u ON u.id=a.id WHERE a.googleSub=? OR a.email=? FOR UPDATE', [claims.sub,email]);
      const account = matches[0];
      let changed = false;
      if (matches.length > 1 || (account && (account.email.toLowerCase() !== email || (account.googleSub && account.googleSub !== claims.sub)))) {
        throw Object.assign(new Error('This Google account does not match the linked Payroll account. Contact the System Administrator.'), {status:403});
      }
      if (account && (account.status !== 'Active' || account.employeeStatus !== 'Active')) {
        throw Object.assign(new Error('This account is deactivated. Contact the System Administrator.'), {status:403});
      }
      if (!account) {
        throw Object.assign(new Error('Your account is not registered. Please contact the System Administrator.'), {status:403});
      }
      if (!account.googleSub) {
        await c.query('UPDATE auth SET googleSub=? WHERE id=?',[claims.sub,account.id]);
        changed = true;
      }
      if (changed) await c.query("INSERT INTO app_config (cfg_key,cfg_value) VALUES ('stateRevision','1') ON DUPLICATE KEY UPDATE cfg_value=CAST(cfg_value AS UNSIGNED)+1");
      await c.commit();
      return {id:account.id,email:account.email,role:account.role,label:account.label,page:account.page,status:account.status};
    } catch (error) { await c.rollback(); throw error; }
    finally { c.release(); }
  });
}

module.exports = { assembleState, persistState, status, q, updatePassword, saveClientState, syncHrisData, googleSignIn };
