'use strict';
const metadata = ['id','first','last','email','role','status','date','classification','department','hireDate','endDate','schoolLevel'];
const { isSchoolEmail } = require('./school-identity');
const compensation = ['salary','hourlyRate','absenceDays','hoursWorked','rankId','rankName','rateCustom'];
const financeKeys = ['cashAdvances','bonusTypes','bonusPayouts','deductionCategories','payrollRecords','sssTable','philData','pagData','birData','dedMeta','bonusExemptionLimit','workDays','leaveTypes','leaveRecords','attendance','teacherRanks','hoursPerWorkload','teachingLoadRecords','teachingLoadClasses'];
const ownRecords = (rows, id) => (rows || []).filter(row => row.empId === id);
const pick = (object, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(object,key)).map(key => [key,object[key]]));
function actorFor(state, token) {
  const actor = Object.values(state.auth || {}).find(user => user.id === token.id);
  if (!actor || actor.status !== 'Active') throw Object.assign(new Error('Your account is inactive or unavailable. Please log in again.'), { status: 401 });
  return actor;
}
function visibleState(state, actor) {
  const result = structuredClone(state);
  result.auth = {}; // Passwords and hashes never leave the server.
  result.profiles = state.profiles?.[actor.id] ? { [actor.id]: state.profiles[actor.id] } : {};
  if (actor.role === 'admin') {
    for (const user of state.users) {
      if (user.id !== actor.id && state.profiles?.[user.id]?.photo) {
        result.profiles[user.id] = { photo: state.profiles[user.id].photo };
      }
    }
  }
  if (actor.role === 'finance') return result;
  result.users = actor.role === 'admin'
    ? state.users.map(user => user.id === actor.id ? user : pick(user, [...metadata,'rankId','rankName']))
    : state.users.filter(user => user.id === actor.id);
  for (const key of ['payrollRecords','leaveRecords','attendance','teachingLoadRecords']) result[key] = ownRecords(state[key],actor.id);
  const loads = new Set(result.teachingLoadRecords.map(row => row.id));
  result.teachingLoadClasses = (state.teachingLoadClasses || []).filter(row => loads.has(row.recordId));
  result.cashAdvances = Object.hasOwn(state.cashAdvances || {},actor.id) ? { [actor.id]: state.cashAdvances[actor.id] } : {};
  result.bonusPayouts = Object.fromEntries(Object.entries(state.bonusPayouts || {}).filter(([key]) => key.startsWith(actor.id + '_')));
  return result;
}
function httpError(message, status = 400) { return Object.assign(new Error(message), { status }); }

async function mergeState(current, submitted, actor) {
  const state = structuredClone(current);
  const role = actor.role;
  if (!['admin','finance','employee'].includes(role)) throw httpError('Access denied.',403);
  if (submitted.profiles && Object.hasOwn(submitted.profiles,actor.id)) {
    const profile = submitted.profiles[actor.id];
    if (!profile || typeof profile !== 'object') throw httpError('Invalid profile.');
    const photo = profile.photo || '';
    if (typeof photo !== 'string' || photo.length > 200000 || (photo && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))) throw httpError('Invalid profile photo.');
    state.profiles[actor.id] = { empPhone: String(profile.empPhone || '').slice(0,40), empAddr: String(profile.empAddr || '').slice(0,255), photo };
  }
  if (role === 'admin') {
    const bcrypt = require('bcryptjs');
    if (Array.isArray(submitted.users)) {
      const retained = new Set(submitted.users.map(user => user.id));
      for (const user of current.users.filter(user => !retained.has(user.id))) {
        const history = ['payrollRecords','teachingLoadRecords','leaveRecords','attendance'].some(key => (current[key] || []).some(row => row.empId===user.id));
        if (history || Object.keys(current.bonusPayouts || {}).some(key => key.startsWith(user.id+'_'))) throw httpError('Employees with payroll, leave, attendance or teaching history must be deactivated instead of removed.');
        state.users = state.users.filter(row => row.id!==user.id);
        for (const key of Object.keys(state.auth)) if (state.auth[key].id===user.id) delete state.auth[key];
        delete state.profiles[user.id];delete state.cashAdvances[user.id];
      }
    }
    for (const incoming of submitted.users || []) {
      if (!Number.isInteger(incoming.id) || incoming.id < 1) throw httpError('Invalid employee ID.');
      const existing = state.users.find(user => user.id === incoming.id);
      const patch = pick(incoming,metadata);
      if (!['Employee','Finance Officer','System Admin'].includes(patch.role) || !['Active','Inactive'].includes(patch.status)) throw httpError('Invalid account role or status.');
      if (!patch.first || !patch.last || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email || '')) throw httpError('Invalid account details.');
      if (!isSchoolEmail(patch.email)) throw httpError('Only @rcc.edu.ph school emails can be registered.');
      if (existing) Object.assign(existing,patch);
      else state.users.push({ ...patch, salary:0, hourlyRate:0, rankId:0, rankName:'', rateCustom:false, hoursWorked:0, absenceDays:0 });
      const originalAuth = Object.values(current.auth).find(entry => entry.id === incoming.id);
      const pending = Object.values(submitted.auth || {}).find(entry => entry.id === incoming.id);
      if (!originalAuth && !pending?.pass) throw httpError('An initial password is required for new accounts.');
      const mapping = { Employee:['employee','empPage','👤'], 'Finance Officer':['finance','financePage','💼'], 'System Admin':['admin','adminPage','🔧'] };
      const [key,page,icon] = mapping[patch.role];
      const password = pending?.pass;
      if (password && (typeof password !== 'string' || password.length < 6 || password.length > 72)) throw httpError('Passwords must contain 6–72 characters.');
      const entry = { id:incoming.id,email:patch.email.toLowerCase(),pass:password ? await bcrypt.hash(password,10) : originalAuth.pass,label:patch.role,role:key,page,icon,status:patch.status };
      for (const [authKey, stored] of Object.entries(state.auth)) if (stored.id === incoming.id) delete state.auth[authKey];
      state.auth[String(incoming.id)] = entry;
    }
    if (!Object.values(state.auth).some(entry => entry.role === 'admin' && entry.status === 'Active')) throw httpError('At least one active administrator is required.');
  }
  if (role === 'finance') {
    for (const key of financeKeys) if (Object.hasOwn(submitted,key)) state[key] = structuredClone(submitted[key]);
    for (const incoming of submitted.users || []) {
      const user = state.users.find(user => user.id === incoming.id);
      if (!user) throw httpError('Finance cannot create or remove user accounts.',403);
      Object.assign(user,pick(incoming,compensation));
    }
  }
  if (role === 'employee') {
    const records = submitted.teachingLoadRecords || [];
    if (records.some(row => row.empId !== actor.id)) throw httpError('Only your own Teaching Load can be changed.',403);
    const other = (current.teachingLoadRecords || []).filter(row => row.empId !== actor.id);
    const taken = new Set(other.map(row => row.id));
    if (records.some(row => taken.has(row.id))) throw httpError('Teaching Load ID belongs to another employee.',403);
    const owner = current.users.find(user => user.id === actor.id);
    if (records.length && owner.classification !== 'Teaching') throw httpError('Teaching Load is available only to teaching staff.',403);
    state.teachingLoadRecords = [...other, ...records.map(row => ({ ...row, empId:actor.id, classification:owner.classification,level:owner.schoolLevel || '',rankId:owner.rankId || 0,rankName:owner.rankName || '',salary:owner.salary || 0,rate:owner.hourlyRate || 0 }))];
    const ids = new Set(records.map(row => row.id));
    const oldIds = new Set(ownRecords(current.teachingLoadRecords,actor.id).map(row => row.id));
    const foreignClasses = (current.teachingLoadClasses || []).filter(row => !oldIds.has(row.recordId));
    const classIds = new Set(foreignClasses.map(row => row.id));
    const classes = submitted.teachingLoadClasses || [];
    if (classes.some(row => !ids.has(row.recordId) || classIds.has(row.id))) throw httpError('Invalid subject ownership.',403);
    state.teachingLoadClasses = [...foreignClasses,...classes];
  }
  const ids = new Set(state.users.map(user => user.id));
  for (const [key,rows] of Object.entries(state)) if (Array.isArray(rows) && rows.some(row => !row || typeof row !== 'object')) throw httpError('Invalid record collection: ' + key);
  for (const record of state.payrollRecords || []) {
    if (!Number.isInteger(record.month) || record.month < 1 || record.month > 12 || !Number.isInteger(record.year) || record.year < 1900 || record.year > 9999) throw httpError('Invalid payroll period.');
    for (const key of ['gross','sss','phil','pag','bir','cash','net']) if (!Number.isFinite(Number(record[key] ?? 0))) throw httpError('Invalid payroll amount.');
    for (const key of ['bonuses','subjectBreakdown','customDeds']) if (record[key] != null && !Array.isArray(record[key])) throw httpError('Invalid payroll breakdown.');
    for (const key of ['salaryBase','absenceWorkDays','absenceDays']) if (record[key] != null && (!Number.isFinite(Number(record[key])) || Number(record[key]) < 0)) throw httpError('Invalid payroll basis.');
    if (record.absenceWorkDays != null && (record.absenceWorkDays < 1 || record.absenceWorkDays > 31)) throw httpError('Invalid absence divisor.');
  }
  for (const leave of state.leaveRecords || []) if (!Number.isFinite(Number(leave.days)) || Number(leave.days) <= 0) throw httpError('Leave days must be greater than zero.');
  for (const user of state.users) for (const key of ['salary','hourlyRate','hoursWorked','absenceDays']) if (user[key] != null && (!Number.isFinite(Number(user[key])) || Number(user[key]) < 0)) throw httpError('Invalid employee pay details.');
  for (const key of ['payrollRecords','teachingLoadRecords','leaveRecords','attendance']) for (const row of state[key] || []) if (row.empId && !ids.has(row.empId)) throw httpError('Invalid employee reference in ' + key);
  if (state.workDays < 1 || state.workDays > 31 || state.hoursPerWorkload < 1 || state.hoursPerWorkload > 40) throw httpError('Invalid formula parameters.');
  const counters = { nextUserId:'users',nextBonusId:'bonusTypes',nextDedCatId:'deductionCategories',nextLeaveTypeId:'leaveTypes',nextLeaveRecordId:'leaveRecords',nextRankId:'teacherRanks',nextTeachingLoadId:'teachingLoadRecords',nextTeachingLoadClassId:'teachingLoadClasses' };
  for (const [key,collection] of Object.entries(counters)) state[key] = Math.max(Number(current[key]) || 1, ...(state[collection] || []).map(row => Number(row.id) + 1));
  state.savedAt = new Date().toISOString();
  state.stateRevision = (Number(current.stateRevision) || 0) + 1;
  return state;
}
module.exports = { actorFor, visibleState, mergeState };
