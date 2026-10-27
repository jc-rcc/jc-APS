// ── LOGIN ────────────────────────────────────────────────────
let loggedInUser = null; // current authenticated USERS_AUTH entry
let loginFails = 0, lockUntil = 0;

const JWT_KEY = 'rcc_aps_jwt_token';
function getAuthToken() { return localStorage.getItem(JWT_KEY); }
function setAuthToken(token) { localStorage.setItem(JWT_KEY, token); }
function clearAuthToken() { localStorage.removeItem(JWT_KEY); localStorage.removeItem(DEMO_KEY); }

// Server-side login via /api/auth/login
async function checkLogin(email, pass) {
  const now = Date.now();
  if (now < lockUntil) {
    return { ok:false, msg:'Too many failed attempts. Try again in ' + Math.ceil((lockUntil - now)/1000) + 's.' };
  }
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const data = await res.json();
    if (!res.ok) {
      loginFails++;
      if (loginFails >= 5) { lockUntil = Date.now() + 30000; loginFails = 0; return { ok:false, msg:'Too many failed attempts. Locked for 30 seconds.' }; }
      return { ok:false, msg: data.error || 'Invalid email or password. Please try again.' };
    }
    loginFails = 0;
    setAuthToken(data.token);
    return { ok:true, user: data.user, token: data.token };
  } catch(e) {
    return { ok:false, msg:'Cannot reach server. Please check your connection.' };
  }
}

function togglePass() {
  const p = document.getElementById('passInp');
  const e = document.getElementById('eyeBtn');
  p.type = p.type==='password' ? 'text' : 'password';
  e.textContent = p.type==='password' ? '👁' : '🙈';
}

async function handleLogin() {
  const email = document.getElementById('emailInp').value.trim().toLowerCase();
  const pass  = document.getElementById('passInp').value.trim();
  const err   = document.getElementById('errBox');
  err.classList.remove('show');
  if (!email||!pass) {
    document.getElementById('errText').textContent='Please enter your email and password.';
    err.classList.add('show'); return;
  }
  if (!/^[^\s@]+@rcc\.edu\.ph$/i.test(email)) {
    document.getElementById('errText').textContent = 'Use your @rcc.edu.ph school email.';
    err.classList.add('show'); return;
  }
  const res = await checkLogin(email, pass);
  if (!res.ok) {
    document.getElementById('errText').textContent = res.msg;
    err.classList.add('show'); return;
  }
  await completeLogin(res.user);
}

async function completeLogin(u) {
  const err = document.getElementById('errBox');
  loggedInUser = { id: u.id, email: u.email, role: u.role, label: u.label, icon: u.role === 'admin' ? '🔧' : u.role === 'finance' ? '💼' : '👤', page: u.page, status: u.status };
  if (!await syncDemo()) {
    clearAuthToken(); loggedInUser = null;
    document.getElementById('errText').textContent = 'Unable to load your account records. Please try logging in again.';
    err.classList.add('show'); return;
  }
  populateProfilePages();
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  document.getElementById('btnText').textContent = 'Signing in...';
  document.getElementById('spinner').style.display = 'inline-block';

  setTimeout(()=>{
    document.getElementById('loginForm').style.display = 'none';
    const rs = document.getElementById('rdScreen');
    rs.style.display = 'block';

    const roleIcons = {
      employee: `<svg width="80" height="80" viewBox="0 0 80 80" fill="none"><circle cx="28" cy="22" r="12" fill="#4A90D9"/><path d="M4 68c0-13.3 10.7-24 24-24h8c13.3 0 24 10.7 24 24" fill="#4A90D9"/><circle cx="52" cy="26" r="10" fill="#6BAEE8"/><path d="M30 68c0-11 8.9-20 20-20h6c11 0 20 9 20 20" fill="#6BAEE8"/></svg>`,
      finance:  `<svg width="80" height="80" viewBox="0 0 80 80" fill="none"><circle cx="40" cy="22" r="16" fill="#222"/><path d="M10 72c0-16.6 13.4-30 30-30h0c16.6 0 30 13.4 30 30" fill="#222"/><circle cx="58" cy="58" r="14" fill="#27AE60"/><text x="58" y="63" text-anchor="middle" font-size="14" font-weight="900" fill="white" font-family="Arial">$</text></svg>`,
      admin:    `<svg width="80" height="80" viewBox="0 0 80 80" fill="none"><circle cx="36" cy="22" r="16" fill="#222"/><path d="M6 72c0-16.6 13.4-30 30-30h0c16.6 0 30 13.4 30 30" fill="#222"/><circle cx="60" cy="56" r="14" fill="#555"/><text x="60" y="61" text-anchor="middle" font-size="16" fill="white" font-family="Arial">⚙</text></svg>`,
    };
    document.getElementById('rdIcon').innerHTML = roleIcons[u.role] || roleIcons['employee'];
    document.getElementById('rdTitle').textContent = 'Welcome, ' + u.label + '!';
    document.getElementById('rdRoleLabel').textContent = u.label;
    document.getElementById('rdNote').textContent = 'Redirecting to ' + u.label + ' dashboard...';
    setTimeout(()=>document.getElementById('rdBar').style.width='100%', 100);
    setTimeout(()=>{
      document.getElementById('loginPage').style.display = 'none';
      document.getElementById(u.page).classList.add('show');
      initPage(u.page);
    }, 2200);
  }, 1000);
}

function logout() {
  if (window.google?.accounts?.id) google.accounts.id.disableAutoSelect();
  if (typeof initGoogleSignIn === 'function') void initGoogleSignIn();
  if (typeof closeSidebar==='function') closeSidebar();
  clearAuthToken();
  localStorage.removeItem(DEMO_KEY);
  loggedInUser = null;
  document.querySelectorAll('.dashboard-page').forEach(p=>p.classList.remove('show'));
  const lp = document.getElementById('loginPage');
  lp.style.display = 'flex';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('rdScreen').style.display = 'none';
  document.getElementById('rdBar').style.width = '0%';
  document.getElementById('emailInp').value = '';
  document.getElementById('passInp').value  = '';
  const btn = document.getElementById('loginBtn');
  btn.disabled = false;
  document.getElementById('btnText').textContent = 'Sign In';
  document.getElementById('spinner').style.display = 'none';
  showToast('👋','You have been logged out successfully.');
}

// ── EMPLOYEE PROFILE & PASSWORD ──────────────────────────────
async function saveProfile() {
  const phone = document.getElementById('empPhone').value.trim();
  const addr  = document.getElementById('empAddr').value.trim();
  if (!phone) { showToast('⚠️','Please enter your phone number.'); return; }
  if (!addr)  { showToast('⚠️','Please enter your home address.'); return; }
  if (!await saveDemo()) return;
  showToast('✅','Profile updated successfully!');
}

async function changePassword() {
  const cur = document.getElementById('pwCurrent').value;
  const nw  = document.getElementById('pwNew').value;
  const cf  = document.getElementById('pwConfirm').value;
  const err = document.getElementById('pwError');
  if (!loggedInUser) { err.textContent = 'Session expired. Please log in again.'; err.classList.add('show'); return; }
  if (!cur || !nw || !cf) { err.textContent = 'Please fill in all fields.'; err.classList.add('show'); return; }
  if (nw.length < 6)      { err.textContent = 'New password must be at least 6 characters long.'; err.classList.add('show'); return; }
  if (nw !== cf)          { err.textContent = 'New password and confirmation do not match.'; err.classList.add('show'); return; }
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (getAuthToken() || '') },
      body: JSON.stringify({ currentPassword: cur, newPassword: nw })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error || 'Failed to change password.'; err.classList.add('show'); return; }
    err.classList.remove('show');
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
    showToast('✅','Password changed successfully!');
    await syncDemo();
  } catch(e) {
    err.textContent = 'Cannot reach server. Please check your connection.'; err.classList.add('show');
  }
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  // Only trigger login while the login page is actually visible.
  const lp = document.getElementById('loginPage');
  if (lp && lp.style.display !== 'none') handleLogin();
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
}

function renderIdentity() {
  if (!loggedInUser) return;
  const emp = users.find(u => u.id === loggedInUser.id);
  if (!emp) return;
  const el = id => document.getElementById(id);
  const setTxt = (id, v) => { const e = el(id); if (e) e.textContent = v; };
  const initials = ((emp.first[0] || '') + (emp.last[0] || '')).toUpperCase();
  const fullName = displayName(emp);
  setTxt('empAvatar', initials);
  setTxt('empTbName', fullName);
  setTxt('finAvatar', initials);
  setTxt('finTbName', fullName);
  setTxt('admAvatar', initials);
  setTxt('admTbName', fullName);
  setTxt('empHeroTag', '🌅 ' + greeting());
  setTxt('finHeroName', `${greeting()}, ${emp.first}! 👋`);
  setTxt('admHeroName', `${greeting()}, ${emp.first}! 👋`);
  if (typeof refreshEmpTlNav === 'function') refreshEmpTlNav();
  renderProfilePhotos(emp);
}

function populateProfilePages() {
  if (!loggedInUser) return;
  const emp = users.find(u => u.id === loggedInUser.id);
  if (!emp) return;
  renderIdentity();
  const el = id => document.getElementById(id);
  const setVal = (id, v) => { const e = el(id); if (e) e.value = v; };
  const setTxt = (id, v) => { const e = el(id); if (e) e.textContent = v; };
  const initials = ((emp.first[0] || '') + (emp.last[0] || '')).toUpperCase();
  const fullName = displayName(emp);
  const roleLabel = emp.role || 'Employee';
  const statusBadge = emp.status === 'Active'
    ? '<span class="badge b-green">● Active</span>'
    : '<span class="badge b-gray">● Inactive</span>';

  setTxt('empProfAvatar', initials);
  setTxt('empProfName', fullName);
  setTxt('empProfRole', roleLabel);
  const st = el('empProfStatus'); if (st) st.innerHTML = statusBadge;
  setTxt('empProfId', '#USR-00' + emp.id);
  setVal('empProfFirst', emp.first);
  setVal('empProfLast', emp.last);
  setVal('empProfEmail', emp.email);
  setVal('empProfDept', emp.department || '');
  setTxt('finProfAvatar', initials);
  setTxt('finProfName', fullName);
  setTxt('finProfRole', roleLabel);
  setVal('finProfFirst', emp.first);
  setVal('finProfLast', emp.last);
  setVal('finProfEmail', emp.email);
  setVal('finProfPhone', (PROFILES[loggedInUser.id] && PROFILES[loggedInUser.id].empPhone) || '');
  setVal('finProfAddr', (PROFILES[loggedInUser.id] && PROFILES[loggedInUser.id].empAddr) || '');
  setVal('finProfDept', emp.department || '');
  setVal('finProfEmergName', '');
  setVal('finProfEmergPhone', '');
  setTxt('admProfAvatar', initials);
  setTxt('admProfName', fullName);
  setTxt('admProfRole', roleLabel);
  setVal('admProfFirst', emp.first);
  setVal('admProfLast', emp.last);
  setVal('admProfEmail', emp.email);
  setVal('admProfPhone', (PROFILES[loggedInUser.id] && PROFILES[loggedInUser.id].empPhone) || '');
  setVal('admProfAddr', (PROFILES[loggedInUser.id] && PROFILES[loggedInUser.id].empAddr) || '');
  setVal('admProfDept', emp.department || '');
  setVal('admProfEmergName', '');
  setVal('admProfEmergPhone', '');
  renderProfilePhotos(emp);
}

function initPage(page) {
  populateProfilePages();
  restoreProfileFields();
  setTopbarDates();
  if (page === 'empPage')     { renderEmpDashboard(); renderPayslipList(); }
  if (page === 'financePage') { if (typeof setDefaultPayPeriod === 'function') setDefaultPayPeriod(); updateFinStats(); renderFinRecentActivity(); populateCalcEmployees(); renderPayrollSummary(); renderBonusModule(); renderAnalytics(); }
  if (page === 'adminPage')   { updateAdminStats(); renderAdminRecentUsers(); renderUserTable(); }
}
function setTopbarDates() {
  const d = new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  ['empDateDisplay','finDateDisplay','admDateDisplay'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.textContent = d;
  });
}

// ── PAYSLIP DATA (from confirmed payroll records) ────────────
// The employee record behind the currently logged-in account.
function currentEmp() {
  return users.find(u => u.id === (loggedInUser && loggedInUser.id));
}

// Fill a payslip year dropdown with years that have confirmed records.
function populatePayslipYears(selectId, preferred) {
  const emp = currentEmp();
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const years = emp ? payslipYearsFor(emp.id) : [];
  if (!years.length) {
    sel.innerHTML = '<option value="">— No payslips —</option>';
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  sel.value = years.includes(preferred) ? preferred : years[years.length - 1];
}

function buildPayslipRows(tbodyId, year, prefix) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const emp = currentEmp();
  const records = emp ? payslipRecordsFor(emp.id, year) : [];
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:32px">
      <div style="font-size:30px;margin-bottom:8px">📭</div>
      <div style="font-weight:600">No payslips available</div>
      <div style="font-size:12px;color:#AAA;margin-top:4px">${year ? `No payroll released for ${year}.` : 'Payslips appear here once the Finance Officer releases your payroll.'}</div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = records.map(p => {
    const isDec = p.monthNum === 12;
    const totalDed = p.sss + p.phil + p.pag + p.bir + p.cash + p.thirteenTax + (p.customTotal || 0);
    return `
    <tr>
      <td><strong>${p.period}</strong>${isDec?' <span class="badge b-gold" style="margin-left:4px;font-size:10px">🎁 13th Mo.</span>':''}</td>
      <td>${fmt(p.gross)}</td>
      <td>${fmt(totalDed)}</td>
      <td><strong style="color:var(--maroon-dark)">${fmt(p.net)}</strong></td>
      <td><span class="badge b-green">✓ Released</span></td>
      <td><button class="btn btn-outline btn-sm" onclick="viewPayslipDetail('${p.period}',${emp.id})" style="display:flex;align-items:center;gap:4px">👁 View</button></td>
    </tr>`;
  }).join('');
}

function renderPayslipList() {
  const sel = document.getElementById('psYear');
  if (!sel) return;
  const preferred = parseInt(sel.value) || 0;
  populatePayslipYears('psYear', preferred);
  buildPayslipRows('psListBody', parseInt(sel.value) || 0, 'emp');
}
function renderFinPayslipList() {
  const sel = document.getElementById('finPsYear');
  if (!sel) return;
  const preferred = parseInt(sel.value) || 0;
  populatePayslipYears('finPsYear', preferred);
  buildPayslipRows('finMyPayslipBody', parseInt(sel.value) || 0, 'fin');
}
function renderAdmPayslipList() {
  const sel = document.getElementById('admPsYear');
  if (!sel) return;
  const preferred = parseInt(sel.value) || 0;
  populatePayslipYears('admPsYear', preferred);
  buildPayslipRows('admMyPayslipBody', parseInt(sel.value) || 0, 'adm');
}

// Employee dashboard: hero, stat cards and Recent Payslips from confirmed records.
function renderEmpDashboard() {
  const emp = currentEmp();
  const el = id => document.getElementById(id);
  if (!emp) return;

  const years = payslipYearsFor(emp.id);
  const allRecs = [];
  years.forEach(y => allRecs.push(...payslipRecordsFor(emp.id, y)));
  const latestRec = allRecs[allRecs.length - 1];
  const base = empGrossPay(emp);

  const heroName = el('empHeroName');
  if (heroName) heroName.innerHTML = `Welcome back, ${esc(emp.first)}! 👋`;
  const heroSub = el('empHeroSub');
  if (heroSub) heroSub.textContent = latestRec
    ? `Here is your payroll summary for ${latestRec.period}.`
    : 'No payroll released yet. Payslips appear once the Finance Officer releases your payroll.';

  let nextLabel = '—';
  if (latestRec) {
    let m = latestRec.monthNum + 1, y = latestRec.year;
    if (m > 12) { m = 1; y += 1; }
    nextLabel = `${MONTHS[m - 1].slice(0, 3)} ${y}`;
  }

  const set = (id, txt) => { const e = el(id); if (e) e.textContent = txt; };
  set('empHeroBasic', fmt(base));
  set('empHeroNet', latestRec ? fmt(latestRec.net) : '—');
  set('empHeroNext', nextLabel);
  set('empStatNet', latestRec ? fmt(latestRec.net) : '₱0.00');
  set('empStatPayslips', allRecs.length);
  set('empStatDed', latestRec ? fmt(latestRec.sss + latestRec.phil + latestRec.pag + latestRec.bir + latestRec.thirteenTax + latestRec.cash + (latestRec.customTotal || 0)) : '₱0.00');
  set('empStatNext', nextLabel);

  const avatar = el('empAvatar');
  if (avatar) renderProfilePhotos(emp);
  const tbName = el('empTbName');
  if (tbName) tbName.textContent = displayName(emp);

  const tbody = el('empRecentPayslipBody');
  if (tbody) {
    tbody.innerHTML = allRecs.length
      ? allRecs.slice(-4).reverse().map(p => `
          <tr>
            <td><strong>${p.period}</strong>${p.monthNum===12?' <span class="badge b-gold" style="margin-left:4px;font-size:10px">🎁 13th</span>':''}</td>
            <td>${fmt(p.gross)}</td>
            <td><strong style="color:var(--maroon-dark)">${fmt(p.net)}</strong></td>
            <td><span class="badge b-green">✓ Released</span></td>
          </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">📭 No payslips yet.</td></tr>`;
  }
}

function viewPayslipDetail(period, empId) {
  const emp = users.find(u => u.id === empId);
  const year = parseInt((period.match(/\d{4}/) || [])[0]) || new Date().getFullYear();
  const monthNum = MONTHS.indexOf(period.replace(` ${year}`, '')) + 1;
  const rec = emp && payrollRecords.find(r => r.empId === emp.id && r.month === monthNum && r.year === year);
  if (!emp || !rec) { showToast('⚠️', 'Payslip record not found.'); return; }

  const grossTaxable = parseFloat(rec.gross) || 0;
  const deMinimis    = parseFloat(rec.deMinimisSum) || 0;
  const recBonuses   = Array.isArray(rec.bonuses) ? rec.bonuses : [];
  const thirteenth   = parseFloat(rec.thirteenth) || 0;
  const exempt13     = parseFloat(rec.thirteenExempt) || 0;
  const taxable13    = parseFloat(rec.thirteenTaxable) || 0;
  const thirteenTax  = parseFloat(rec.thirteenTax) || 0;
  const sss = parseFloat(rec.sss)||0, phil = parseFloat(rec.phil)||0, pag = parseFloat(rec.pag)||0, bir = parseFloat(rec.bir)||0, cash = parseFloat(rec.cash)||0;
  const customDeds = Array.isArray(rec.customDeds) ? rec.customDeds : [];
  const customTotal = customDeds.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const peraa = customDeds.filter(x => String(x.name).trim().toUpperCase() === 'PERAA')
    .reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0);
  const otherCustom = customDeds.filter(x => String(x.name).trim().toUpperCase() !== 'PERAA');
  const totalDed  = sss + phil + pag + bir + cash + thirteenTax + customTotal;
  const totalGross = grossTaxable + deMinimis + thirteenth;
  const isDec = monthNum === 12;
  const page = ROLE_PAGE[emp.role] || 'empPage';

  const breakdown = Array.isArray(rec.subjectBreakdown) ? rec.subjectBreakdown : [];
  const subjLines = breakdown.filter(b => b.type !== 'increment');
  const incrLine = breakdown.find(b => b.type === 'increment');
  const isTeaching = emp.classification === 'Teaching';
  const isMonthly = isTeaching && emp.schoolLevel === 'Elementary';
  const isNonTeach = emp.classification === 'Non-Teaching';

  const docId = page === 'empPage' ? 'psDoc' : page === 'financePage' ? 'finPsDoc' : 'admPsDoc';
  const netPay = parseFloat(rec.net) || 0;
  const dateStr = (rec.date || '').slice(0, 11);

  const qtyLabel = emp.schoolLevel === 'High School' ? 'Workloads' : 'Hours';
  const otherAmount = otherCustom.reduce((sum, x) => sum + (parseFloat(x.amount) || 0), 0);
  const number = value => Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 4 });
  const blankDeductions = '<td></td>'.repeat(8);
  const earningRow = (label, amount, qty = '', rate = '', dept = '') =>
    '<tr><td class="ps-text">' + esc(label) + '</td><td class="ps-text">' + esc(dept) + '</td><td>' + qty + '</td><td>' + rate + '</td><td>' + fmt(amount) + '</td>' + blankDeductions + '</tr>';
  const subjectRows = breakdown.map(b => earningRow(
    b.type === 'increment' ? 'Increment - S.Y' : (b.subject || 'Subject'),
    parseFloat(b.amount) || 0, number(b.qty), fmt(parseFloat(b.rate) || 0), b.deptCode || ''
  )).join('');
  const baseRow = subjectRows || earningRow(isTeaching ? (isMonthly ? 'Monthly salary after absences' : 'Teaching earnings') : 'Monthly salary after absences', grossTaxable);
  const customNotes = otherCustom.map(x => esc(x.name || 'Other deduction') + ': ' + fmt(parseFloat(x.amount) || 0)).join(' · ');
  const bonusRows = recBonuses.map(b => earningRow(b.name || 'Bonus', parseFloat(b.amount) || 0)).join('');
  const hasBonusDetails = recBonuses.length > 0;
  document.getElementById(docId).innerHTML = `
    <article class="ps-sheet">
      <header class="ps-brand">
        <div><div class="ps-school">REPUBLIC CENTRAL COLLEGES</div><div>Angeles City</div></div>
        <div class="ps-period"><strong>PAYSLIP</strong><div>${esc(period)}</div></div>
      </header>
      <div class="ps-employee">
        <div><span>EMPLOYEE</span><strong>${esc(displayName(emp))}</strong></div>
        <div><span>DEPARTMENT</span><strong>${esc(emp.department || '—')}</strong><div>${esc(emp.schoolLevel || emp.classification || '')}</div></div>
        <div><span>RELEASE DATE</span><strong>${esc(rec.date || '—')}</strong></div>
      </div>
      <table class="ps-pay-table">
        <colgroup><col style="width:17%"/><col style="width:8%"/><col style="width:5%"/><col style="width:7%"/><col style="width:8%"/><col style="width:6%"/><col style="width:6%"/><col style="width:6%"/><col style="width:6%"/><col style="width:7%"/><col style="width:7%"/><col style="width:7%"/><col style="width:10%"/></colgroup>
        <thead>
          <tr><th colspan="4">EXPLANATION</th><th rowspan="2">EARNINGS</th><th colspan="7">DEDUCTIONS</th><th rowspan="2">NET PAY</th></tr>
          <tr><th class="ps-text">Description</th><th>Dept</th><th>${qtyLabel}</th><th>Rate</th><th>SSS</th><th>PhilHealth</th><th>Pag-IBIG</th><th>PERAA</th><th>W/Tax</th><th>Cash Adv.</th><th>Other</th></tr>
        </thead>
        <tbody>
          ${baseRow}
          ${subjectRows ? bonusRows : ''}
          ${deMinimis > 0 && (!hasBonusDetails || !subjectRows) ? earningRow('De Minimis Benefits', deMinimis) : ''}
          ${thirteenth > 0 ? earningRow('13th Month Pay', thirteenth) : ''}
          <tr class="ps-deduction-row"><td class="ps-text" colspan="5">Employee deductions</td><td>${fmt(sss)}</td><td>${fmt(phil)}</td><td>${fmt(pag)}</td><td>${fmt(peraa)}</td><td>${fmt(bir + thirteenTax)}</td><td>${fmt(cash)}</td><td>${fmt(otherAmount)}</td><td></td></tr>
        </tbody>
        <tfoot><tr><th class="ps-text" colspan="4">TOTAL</th><td>${fmt(totalGross)}</td><td>${fmt(sss)}</td><td>${fmt(phil)}</td><td>${fmt(pag)}</td><td>${fmt(peraa)}</td><td>${fmt(bir + thirteenTax)}</td><td>${fmt(cash)}</td><td>${fmt(otherAmount)}</td><td class="ps-net">${fmt(netPay)}</td></tr></tfoot>
      </table>
      <div class="ps-notes">
        ${emp.rankName ? '<div>Rank: ' + esc(emp.rankName) + '</div>' : ''}
        ${rec.payNote ? '<div>Pay note: ' + esc(rec.payNote) + '</div>' : ''}
        ${customNotes ? '<div>Other deductions: ' + customNotes + '</div>' : ''}
        <div>Total deductions: <strong>${fmt(totalDed)}</strong></div>
      </div>
      <section class="ps-office">
        <div class="ps-office-details"><h4>OFFICE COPY</h4><dl><dt>Employee</dt><dd>${esc(displayName(emp))}</dd><dt>Payroll period</dt><dd>${esc(period)}</dd><dt>Amount received</dt><dd><strong>${fmt(netPay)}</strong></dd></dl></div>
        <div class="ps-receipt"><h4>PAY RECEIPT</h4><p>Received from Republic Central Colleges the amount shown above as payment for the payroll period indicated.</p><div class="ps-signatures"><div>Employee signature</div><div>Date received</div></div></div>
      </section>
      <div class="ps-retain">Keep this statement as your personal record of earnings and deductions.</div>
    </article>
  `;

  // Show detail page based on role
  if (page === 'empPage') {
    document.getElementById('empPayslip').style.display='none';
    document.getElementById('payslipDetailPage').style.display='block';
    document.getElementById('psBackBtn').onclick = ()=>{
      document.getElementById('payslipDetailPage').style.display='none';
      document.getElementById('empPayslip').style.display='block';
    };
  } else if (page === 'financePage') {
    document.getElementById('finMyPayslip').style.display='none';
    document.getElementById('finPayslipDetail').style.display='block';
  } else {
    document.getElementById('admMyPayslip').style.display='none';
    document.getElementById('admPayslipDetail').style.display='block';
  }
}

function printPayslip() {
  const active = document.querySelector('.dashboard-page.show');
  const cfg = {
    empPage: 'psDoc',
    financePage: 'finPsDoc',
    adminPage: 'admPsDoc'
  }[active && active.id];
  const doc = cfg ? document.getElementById(cfg) : null;
  if (!doc || !doc.innerHTML.trim()) { showToast('⚠️','No payslip to download.'); return; }
  const period = doc.querySelector('.ps-period div')?.textContent.trim() || 'Payroll';
  const name = doc.querySelector('.ps-employee strong')?.textContent.trim() || 'Employee';
  const base = `Payslip_${name}_${period}`.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_');
  const oldTitle = document.title;
  document.title = base;
  const old = document.getElementById('printOverlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'printOverlay';
  overlay.innerHTML = doc.innerHTML;
  document.body.appendChild(overlay);
  const cleanup = () => {
    overlay.remove();
    document.title = oldTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  try { window.print(); } catch (error) { cleanup(); throw error; }
}

function showFinPage(id, btn) {
  if (typeof closeSidebar==='function') closeSidebar();
  ['finDashboard','finAnalytics','finBonus','finPayroll','finReports','finGovReport','finPayrollReport','finDeduction','finMyPayslip','finPayslipDetail','finMyProfile','finChangePassword',
   'finDedSSS','finDedPhilHealth','finDedPagIBIG','finDedBIR','finRanks','finTeachingLoad','finFormula'].forEach(x=>{
    const el = document.getElementById(x);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = 'block';
  document.querySelectorAll('#financePage .nav-item').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const labels = {finDashboard:'Dashboard',finAnalytics:'Analytics',finBonus:'Bonus Management',finPayroll:'Payroll Calculation',finReports:'Reports',finGovReport:'Reports',finPayrollReport:'Reports',finDeduction:'Deduction Tables',finMyPayslip:'My Payslip',finMyProfile:'My Profile',finChangePassword:'Change Password',finRanks:'Faculty Rank Tables',finTeachingLoad:'Teaching Loads',finFormula:'Formula Management'};
  const bc = document.getElementById('finBreadcrumb');
  if (bc) bc.textContent = labels[id] || 'Dashboard';
  if (id === 'finDashboard') { renderIdentity(); updateFinStats(); renderFinRecentActivity(); }
  if (id === 'finAnalytics') renderAnalytics();
  if (id === 'finBonus') renderBonusModule();
  if (id === 'finPayroll') { if (typeof checkBonusDates==='function') checkBonusDates(); populateCalcEmployees(); renderPayrollSummary(); }
  if (id === 'finDeduction') { renderDeductionCategories(); renderLeaveTypes(); renderLeaveRecords(); renderAttendance(); renderDedBanner(); renderWorkDaysSetting(); }
  if (id === 'finRanks') { if (typeof renderRankTable === 'function') renderRankTable(); }
  if (id === 'finTeachingLoad') {
    if (typeof renderFinTeachingLoads === 'function') renderFinTeachingLoads();
    if (typeof tlCloseFinanceForm === 'function') tlCloseFinanceForm();
  }
  if (id === 'finFormula') {
    if (typeof renderFormulaManagement === 'function') renderFormulaManagement();
  }
  if (id === 'finMyPayslip') renderFinPayslipList();
  if (id === 'finPayrollReport') {
    document.getElementById('reportOutput').style.display = 'none';
  }
}

function showEmpPage(id, btn) {
  if (typeof closeSidebar==='function') closeSidebar();
  ['empDashboard','empPayslip','empProfile','empPassword','payslipDetailPage','empTeachingLoad'].forEach(x=>{
    const el = document.getElementById(x);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = 'block';
  document.querySelectorAll('#empPage .nav-item').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (id === 'empPayslip') renderPayslipList();
  if (id === 'empDashboard') { renderIdentity(); renderEmpDashboard(); }
  if (id === 'empTeachingLoad') {
    if (typeof tlRenderForm === 'function') tlRenderForm('tl', loggedInUser ? loggedInUser.id : null, null);
  }
}

function showAdmPage(id, btn) {
  if (typeof closeSidebar==='function') closeSidebar();
  ['admDashboard','admUsers','admDeduction','admMyPayslip','admPayslipDetail','admMyProfile','admChangePassword','admRanks'].forEach(x=>{
    const el = document.getElementById(x);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = 'block';
  document.querySelectorAll('#adminPage .nav-item').forEach(b=>b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const labels = {admDashboard:'Dashboard',admUsers:'User Management',admDeduction:'Deduction Tables',admMyPayslip:'My Payslip',admMyProfile:'My Profile',admChangePassword:'Change Password',admRanks:'Faculty Rank Tables'};
  const bc = document.getElementById('admBreadcrumb');
  if (bc) bc.textContent = labels[id] || 'Dashboard';
  if (id === 'admDashboard') { renderIdentity(); updateAdminStats(); renderAdminRecentUsers(); }
  if (id === 'admUsers') {
    renderUserTable();
    if (!stateSavePending) void syncDemo();
  }
  if (id === 'admDeduction') renderAdmDedTables();
  if (id === 'admRanks') { if (typeof renderAdmRankTable === 'function') renderAdmRankTable(); }
  if (id === 'admMyPayslip') renderAdmPayslipList();
}

setInterval(() => { if (loggedInUser) renderIdentity(); }, 60000);
