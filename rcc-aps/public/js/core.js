// ── AUTH DATA ────────────────────────────────────────────────
// ── DEMO PERSISTENCE (localStorage) ──────────────────────────
const DEMO_KEY = 'rcc_aps_demo_v1';
function loadDemo() {
  try { const raw = localStorage.getItem(DEMO_KEY); return raw ? JSON.parse(raw) : null; } catch(e){ return null; }
}
const _savedDemo = loadDemo();
let serverStateRevision = Number.isInteger(_savedDemo?.stateRevision) ? _savedDemo.stateRevision : null;
let stateSavePending = false;
// ── PER-USER PROFILE STORAGE ─────────────────────────────────
// Profiles are keyed by the logged-in user's id so each account keeps its
// own phone/address instead of one global blob shared by everyone.
const PROFILES = Object.assign(
  {},
  (_savedDemo && _savedDemo.profiles) || {},
  // Legacy migration: very old saves stored a single global `profile` blob.
  // Attribute it to the demo employee account so it is not lost.
  (_savedDemo && _savedDemo.profile) ? { 3: _savedDemo.profile } : {}
);
function currentUid() {
  return (typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.id) || 0;
}
function saveDemo() {
  return new Promise((resolve) => {
    try {
      if (stateSavePending) { showToast('⚠️','Please wait for the current save to finish.'); resolve(false); return; }
      const uid = currentUid();
      if (uid) {
        const pp = document.getElementById('empPhone');
        const pa = document.getElementById('empAddr');
        if (pp && pa && (pp.value.trim() || pa.value.trim())) {
          PROFILES[uid] = { ...(PROFILES[uid] || {}), empPhone: pp.value, empAddr: pa.value };
        }
      }
      const state = {
        stateRevision: serverStateRevision,
        users, nextUserId, cashAdvances, bonusTypes, nextBonusId, auth: USERS_AUTH,
        deductionCategories, nextDedCatId, payrollRecords, bonusPayouts,
        sssTable, philData, pagData, birData, dedMeta, bonusExemptionLimit: BONUS_EXEMPTION_LIMIT,
        workDays: WORK_DAYS,
        leaveTypes: (typeof LEAVE_TYPES !== 'undefined') ? LEAVE_TYPES : [],
        nextLeaveTypeId: (typeof NEXT_LEAVE_TYPE_ID !== 'undefined') ? NEXT_LEAVE_TYPE_ID : 1,
        leaveRecords: (typeof LEAVE_RECORDS !== 'undefined') ? LEAVE_RECORDS : [],
        nextLeaveRecordId: (typeof nextLeaveRecordId !== 'undefined') ? nextLeaveRecordId : 1,
        attendance: (typeof ATTENDANCE !== 'undefined') ? ATTENDANCE : [],
        teacherRanks: (typeof teacherRanks !== 'undefined') ? teacherRanks : [],
        nextRankId: (typeof nextRankId !== 'undefined') ? nextRankId : 1,
        teachingLoadRecords: (typeof teachingLoadRecords !== 'undefined') ? teachingLoadRecords : [],
        teachingLoadClasses: (typeof teachingLoadClasses !== 'undefined') ? teachingLoadClasses : [],
        nextTeachingLoadId: (typeof nextTeachingLoadId !== 'undefined') ? nextTeachingLoadId : 1,
        nextTeachingLoadClassId: (typeof nextTeachingLoadClassId !== 'undefined') ? nextTeachingLoadClassId : 1,
        hoursPerWorkload: (typeof HOURS_PER_WORKLOAD !== 'undefined') ? HOURS_PER_WORKLOAD : 3,
        profiles: PROFILES,
        savedAt: new Date().toISOString()
      };
      stateSavePending = true;
      localStorage.setItem(DEMO_KEY, JSON.stringify({ ...state, auth:{} }));
      pushToServer(state).then(saved => {
        stateSavePending = false;
        resolve(saved);
      });
    } catch(e){
      stateSavePending = false;
      resolve(false);
    }
  });
}

async function pushToServer(state) {
  const token = (typeof getAuthToken === 'function') ? getAuthToken() : null;
  if (!token) return false;
  try {
    const response = await fetch('/api/data', {
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer ' + token}, body:JSON.stringify(state)
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401) clearAuthToken();
      if (response.status !== 401) await syncDemo();
      showToast('⚠️',result.error || 'Save failed. Please try again.');
      return false;
    }
    if (result.state) {
      localStorage.setItem(DEMO_KEY,JSON.stringify(result.state));
      applyServerData(result.state);
    }
    return true;
  } catch (error) {
    showToast('⚠️','The server could not save your changes. Check the connection and retry.');
    return false;
  }
}
async function syncDemo() {
  const token = (typeof getAuthToken === 'function') ? getAuthToken() : null;
  if (!token) return false;
  try {
    const response = await fetch('/api/data', {headers:{'Authorization':'Bearer ' + token},cache:'no-store'});
    if (response.status === 401) { clearAuthToken(); return false; }
    if (!response.ok) return false;
    const state = await response.json();
    if (!state || !Array.isArray(state.users) || !state.users.length) return false;
    localStorage.setItem(DEMO_KEY,JSON.stringify(state));
    applyServerData(state);
    refreshVisiblePage();
    return true;
  } catch (error) { return false; }
}
function refreshVisiblePage() {
  if (!(typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.page)) return;
  if (typeof initPage !== 'function') return;
  const el = document.getElementById(loggedInUser.page);
  if (el && el.classList.contains('show')) initPage(loggedInUser.page);
}
document.addEventListener('DOMContentLoaded', syncDemo);

const ROLE_PAGE = {'System Admin':'adminPage','Finance Officer':'financePage','Employee':'empPage'};
const ROLE_ICON = {'System Admin':'🔧','Finance Officer':'💼','Employee':'👤'};
const ROLE_KEY  = {'System Admin':'admin','Finance Officer':'finance','Employee':'employee'};

const USERS_AUTH = {};
function ensureAuth(u, pass) {
  let entry = Object.values(USERS_AUTH).find(a => a.id === u.id);
  if (!entry) { entry = { id: u.id }; USERS_AUTH['u' + u.id] = entry; }
  entry.email  = u.email.toLowerCase();
  if (pass) entry.pass = pass;
  entry.label  = u.role;
  entry.icon   = ROLE_ICON[u.role] || '👤';
  entry.page   = ROLE_PAGE[u.role] || 'empPage';
  entry.role   = ROLE_KEY[u.role]  || 'employee';
  entry.status = u.status || 'Active';
  return entry;
}
function removeAuth(userId) {
  Object.keys(USERS_AUTH).forEach(k => { if (USERS_AUTH[k].id === userId) delete USERS_AUTH[k]; });
}
// Restore the logged-in user's saved profile fields into the form.
// Called from initPage() after login (fields depend on the active account).
function restoreProfileFields() {
  const pp = document.getElementById('empPhone');
  const pa = document.getElementById('empAddr');
  if (!pp || !pa) return;
  const p = PROFILES[currentUid()] || {};
  pp.value = p.empPhone || '';
  pa.value = p.empAddr || '';
}
const DEMOS = {
  employee:'Email: employee@rcc.edu.ph &nbsp;|&nbsp; Password: employee123',
  finance: 'Email: finance@rcc.edu.ph &nbsp;|&nbsp; Password: finance123',
  admin:   'Email: admin@rcc.edu.ph &nbsp;|&nbsp; Password: admin123',
};
let currentRole = 'employee';

// ── FORMAT ───────────────────────────────────────────────────
const fmt = n => '₱' + parseFloat(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2});

// ── DEMO LABEL ───────────────────────────────────────────────
const DEMO_EMAILS = ['admin@rcc.edu.ph', 'finance@rcc.edu.ph', 'employee@rcc.edu.ph'];
function isDemoUser(u) { return !!u && DEMO_EMAILS.includes((u.email || '').toLowerCase()); }
function displayName(u) { return u ? `${u.first} ${u.last}` + (isDemoUser(u) ? ' (demo)' : '') : ''; }
