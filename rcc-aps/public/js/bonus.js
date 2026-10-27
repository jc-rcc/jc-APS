// ── BONUS MANAGEMENT ───────────────────────────────────────────
let bonusTypes = (_savedDemo && _savedDemo.bonusTypes) || [
  {id:1, name:'13th Month Pay', kind:'months', value:1, desc:'Statutory bonus per RA 8515', status:'Active'},
];
let nextBonusId = (_savedDemo && _savedDemo.nextBonusId) || 2;

// ── 13th Month Pay (RA 8515) ─────────────────────────────────
// The 13th Month Pay is a regular bonus type with locked name/kind fields.
// It can be edited (value, description, dates) and deleted like any bonus.
function normalizeBonusName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseDate(str) {
  if (!str) return new Date(NaN);
  const d = new Date(str + 'T00:00:00');
  return isNaN(d) ? new Date(NaN) : d;
}

// Months of service rendered within the calendar year (accounts for hire and separation dates)
function monthsEmployed(emp, year) {
  const yearStart = new Date(year,0,1);
  const yearEnd   = new Date(year,11,31);
  const hire = parseDate(emp.hireDate);
  if (isNaN(hire)) return 12;
  const sep = parseDate(emp.endDate);
  const start = hire > yearStart ? hire : yearStart;
  const end   = (!isNaN(sep) && sep < yearEnd) ? sep : yearEnd;
  if (start > end) return 0;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
  return Math.max(0, Math.min(12, months));
}

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

// RA 8515 / DOLE: 13th Month Pay = 1/12 of the TOTAL BASIC SALARY actually
// earned during the calendar year. Everyone who rendered service during the
// year is entitled — paid proportionately, no minimum-length rule.
// Because the demo has no per-month earnings history, the monthly basic pay is
// assumed constant, and each month's contribution is prorated by the actual
// calendar days worked in that month (handles mid-month hires / separations).
function doleBasicSalaryEarned(emp, year, monthlyPay) {
  const hire = parseDate(emp.hireDate);
  if (isNaN(hire)) return 0;
  const sep = parseDate(emp.endDate);
  const monthly = (monthlyPay != null && !isNaN(monthlyPay))
    ? parseFloat(monthlyPay)
    : avgMonthlyPay(emp);
  let total = 0;
  for (let m = 0; m < 12; m++) {
    const mStart = new Date(year, m, 1);
    const mEnd   = new Date(year, m + 1, 0);
    if (hire > mEnd) continue;                    // not yet hired in this month
    if (!isNaN(sep) && sep <= mStart) continue;   // already separated before this month
    const s = hire > mStart ? hire : mStart;      // effective start day in the month
    const e = (!isNaN(sep) && sep < mEnd) ? sep : mEnd; // effective end day in the month
    const workedDays = Math.max(0, (e.getDate() - s.getDate()) + 1);
    const frac = Math.min(1, workedDays / daysInMonth(year, m));
    total += monthly * frac;
  }
  return total;
}

// DOLE entitlement: entitled if any basic salary was earned during the year
function thirteenthEligibility(emp, year) {
  const earned = doleBasicSalaryEarned(emp, year);
  if (earned <= 0) return { eligible:false, type:'none', months:0, badge:'b-gray', label:'No service this year' };
  const months = monthsEmployed(emp, year);
  if (months >= 12) return { eligible:true, type:'full', months:12, badge:'b-green', label:'Full year' };
  return { eligible:true, type:'prorated', months:months, badge:'b-yellow', label:'Prorated '+months+' mo.' };
}

function avgMonthlyPay(emp) {
  return emp.classification === 'Teaching' ? empGrossPay(emp) : (parseFloat(emp.salary)||0);
}
// RA 8515 / DOLE: 13th Month Pay = Total Basic Salary Earned in the Year ÷ 12.
// Optional monthlyPay overrides the stored salary — used by the Payroll Calculator
// so the 13th month follows the salary actually entered for the period.
function computeThirteenth(emp, year, monthlyPay) {
  const earned = doleBasicSalaryEarned(emp, year, monthlyPay);
  return parseFloat((earned / 12).toFixed(2));
}

function renderPayoutBanner(year) {
  const el = document.getElementById('bonPayoutBanner');
  if (!el) return;
  if (!isThirteenthActive()) {
    el.innerHTML = '<span style="font-size:15px">🚫</span> <div><strong>13th Month Pay is currently disabled.</strong> Turn it ON in the <strong>Configurable Bonus Types</strong> section below to make it available in the Payroll Calculation page (December run).</div>';
    el.style.background = '#FFEBEE'; el.style.borderColor = '#F5C6C6'; el.style.color = '#B71C1C';
    return;
  }
  const now = new Date();
  const inWindow = now.getFullYear() === year && now.getMonth() === 11 && now.getDate() <= 24;
  const decOpen   = now.getFullYear() === year && now.getMonth() === 11;
  if (inWindow) {
    el.innerHTML = '<span style="font-size:15px">✅</span> <div><strong>Within the December payout window.</strong> 13th Month Pay is now available for processing — must be paid on or before <strong>December 24, '+year+'</strong> per RA 8515 / DOLE.</div>';
    el.style.background = '#E8F5E9'; el.style.borderColor = '#A5D6A7'; el.style.color = '#1B5E20';
  } else if (decOpen) {
    el.innerHTML = '<span style="font-size:15px">⏳</span> <div><strong>Payout window is open.</strong> Statutory deadline is <strong>December 24, '+year+'</strong>. Ensure all December payroll runs are completed on time.</div>';
    el.style.background = '#FFF8E1'; el.style.borderColor = '#FFD54F'; el.style.color = '#6D4C00';
  } else {
    el.innerHTML = '<span style="font-size:15px">⏳</span> <div><strong>Outside the statutory payout window.</strong> The 13th Month Pay window opens <strong>December 1, '+year+'</strong> and closes <strong>December 24, '+year+'</strong>. Computation below is a <strong>scheduled preview</strong> — it becomes available (and payable) in the December payroll run.</div>';
    el.style.background = '#FFF8E1'; el.style.borderColor = '#FFD54F'; el.style.color = '#6D4C00';
  }
}

function renderBonusModule() {
  const year = parseInt(document.getElementById('bonYear')?.value||2026);
  renderBonusTable();
  renderBonusTypes();
  const roster = users.filter(u=>u.salary>0);
  const eligible = roster.filter(u=>thirteenthEligibility(u, year).eligible);
  const total = eligible.reduce((s,u)=>s+computeThirteenth(u, year),0);
  document.getElementById('bonTotal').textContent = fmt(total);
  document.getElementById('bonEligible').textContent = eligible.length + ' of ' + roster.length;
  document.getElementById('bonTypesCount').textContent = bonusTypes.filter(b=>b.status==='Active').length;
  const noteEl = document.getElementById('bonTotalNote');
  if (noteEl) noteEl.textContent = 'Calendar Year ' + year;
  const titleEl = document.getElementById('bonTableTitle');
  if (titleEl) titleEl.textContent = '🎁 13th Month Pay Computation (RA 8515) — ' + year;
  renderPayoutBanner(year);
  renderBonusExemptionLimit();
  checkBonusDates();
}

function renderBonusTable() {
  const year = parseInt(document.getElementById('bonYear')?.value||2026);
  const tbody = document.getElementById('bonTableBody');
  if (!tbody) return;
  const roster = users.filter(u=>u.salary>0);
  tbody.innerHTML = roster.map(emp=>{
    const m = monthsEmployed(emp, year);
    const base = avgMonthlyPay(emp);
    const el = thirteenthEligibility(emp, year);
    const val = el.eligible ? computeThirteenth(emp, year) : 0;
    const statusBadge = emp.status==='Active' ? '<span class="badge b-green">Active</span>' : '<span class="badge b-gray">Resigned</span>';
    const paid = bonusPayouts[emp.id + '_' + year];
    const payCell = el.eligible
      ? (paid
          ? '<span class="badge b-green">✓ Paid '+paid.date+'</span>'
          : '<button class="btn btn-outline btn-sm" onclick="markBonusPaid('+emp.id+','+year+')">Mark Paid</button>')
      : '<span style="color:#BDBDBD">—</span>';
    return `<tr>
      <td><strong>${displayName(emp)}</strong></td>
      <td><span class="badge ${EMP_CLASS[emp.classification].badge}">${emp.classification}</span></td>
      <td>${emp.hireDate || '—'}${emp.endDate ? '<br/><span style="font-size:11px;color:var(--text-muted)">until '+emp.endDate+'</span>' : ''}</td>
      <td>${statusBadge}</td>
      <td>${m} <span style="font-size:11px;color:var(--text-muted)">/ 12</span></td>
      <td>${fmt(base)}</td>
      <td><span class="badge ${el.badge}">${el.label}</span></td>
      <td>${el.eligible ? '<strong style="color:var(--maroon-dark)">'+fmt(val)+'</strong>' : '<span style="color:#BDBDBD">—</span>'}</td>
      <td>${payCell}</td>
    </tr>`;
  }).join('');
}

function markBonusPaid(id, year) {
  const emp = users.find(u=>u.id===id); if(!emp) return;
  bonusPayouts[id + '_' + year] = { date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) };
  saveDemo();
  renderBonusTable();
  showToast('✅', `13th Month Pay for ${emp.first} ${emp.last} (${year}) marked as paid.`);
}

function renderBonusTypes() {
  const list = document.getElementById('bonusTypeList');
  const empty = document.getElementById('bonusTypeEmpty');
  if (!list) return;
  if (!bonusTypes.length) { list.style.display='none'; empty.style.display='block'; return; }
  list.style.display='grid'; empty.style.display='none';
  const kindLabel = {months:'Months of Pay', fixed:'Fixed Amount', percent:'% of Gross'};
  list.innerHTML = bonusTypes.map(b=>{
    let schedBadge = '';
    if (b.releaseDate && b.endDate) {
      const rd = parseDate(b.releaseDate), ed = parseDate(b.endDate);
      if (!isNaN(rd) && !isNaN(ed)) {
        const activeNow = rd <= new Date();
        const expired = ed < new Date();
        schedBadge = `<span class="badge ${expired?'b-gray':activeNow?'b-green':'b-yellow'}" title="${expired?'Expired':'Active'} ${b.releaseDate} → ${b.endDate}">📅 ${b.releaseDate} → ${b.endDate}</span>`;
      }
    } else if (b.releaseDate) {
      const d = parseDate(b.releaseDate);
      if (!isNaN(d)) {
        const activeNow = d <= new Date();
        schedBadge = `<span class="badge ${activeNow?'b-green':'b-yellow'}" title="${activeNow?'Active since':'Scheduled from'} ${b.releaseDate}">📅 ${activeNow?'Since':'From'} ${b.releaseDate}</span>`;
      }
    } else if (b.endDate) {
      const ed = parseDate(b.endDate);
      if (!isNaN(ed)) {
        const expired = ed < new Date();
        schedBadge = `<span class="badge ${expired?'b-gray':'b-yellow'}" title="${expired?'Expired':'Until'} ${b.endDate}">📅 Until ${b.endDate}</span>`;
      }
    }
    return `
    <div class="card" style="margin:0">
      <div class="card-body" style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--maroon-dark)">${esc(b.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(b.desc || '—')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
            ${schedBadge}
            <label class="switch" title="Enable / disable this bonus"><input type="checkbox" ${b.status==='Active'?'checked':''} onchange="toggleBonusType(${b.id})"/><span class="slider"></span></label>
            <span class="badge ${b.status==='Active'?'b-green':'b-gray'}" style="flex-shrink:0">● ${b.status}</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
          <div style="background:var(--gold-pale);border:1px solid var(--gold);border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;color:var(--maroon-dark)">
            ${b.kind==='months' ? b.value+' mo.' : b.kind==='fixed' ? '₱'+b.value.toLocaleString('en-PH',{minimumFractionDigits:2}) : b.value+'%'}
          </div>
          <div style="font-size:12px;color:var(--text-muted)">${kindLabel[b.kind]}</div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button class="btn btn-outline btn-sm" onclick="openBonusTypeModal(${b.id})">✏️ Edit</button>
          <button class="btn btn-outline btn-sm" style="color:#C62828;border-color:#FFCDD2" onclick="deleteBonusType(${b.id})">🗑️ Remove</button>
          ${b.deMinimis ? '<span class="badge b-green" style="align-self:center">🌿 De Minimis — tax-exempt</span>' : ''}
          ${b.kind==='months' ? '<span class="badge b-gold" style="align-self:center" title="Months-of-Pay bonuses apply to December payroll runs only — 13th-month-style annual payout">🎄 December only</span>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');
}

function openBonusTypeModal(id) {
  const b = id ? bonusTypes.find(x=>x.id===id) : null;
  const is13thMonth = !!(b && b.id === 1);
  document.getElementById('bonusTypeModalTitle').textContent = is13thMonth ? 'Edit 13th Month Pay' : (b ? 'Edit Bonus Type' : 'Add Bonus Type');
  const nameEl = document.getElementById('bonName');
  const kindEl = document.getElementById('bonKind');
  nameEl.value = b ? b.name : '';
  kindEl.value = is13thMonth ? 'months' : (b ? b.kind : 'fixed');
  nameEl.disabled = is13thMonth;
  kindEl.disabled = is13thMonth;
  if (is13thMonth) nameEl.title = 'The name of 13th Month Pay cannot be changed.'; else nameEl.title = '';
  const dateEl = document.getElementById('bonReleaseDate');
  if (dateEl) {
    dateEl.value = (b && b.releaseDate) || '';
    dateEl.disabled = is13thMonth;
    dateEl.title = is13thMonth ? 'The 13th Month Pay is paid on or before December 24 (RA 8515).' : '';
  }
  const endDateEl = document.getElementById('bonEndDate');
  if (endDateEl) {
    endDateEl.value = (b && b.endDate) || '';
    endDateEl.disabled = is13thMonth;
    endDateEl.title = is13thMonth ? 'The 13th Month Pay is paid on or before December 24 (RA 8515).' : '';
  }
  document.getElementById('bonValue').value = b ? b.value : '';
  document.getElementById('bonDesc').value = b ? b.desc : '';
  document.getElementById('bonDeMinimis').checked = !!(b && b.deMinimis);
  document.getElementById('bonErr').style.display = 'none';
  document.getElementById('bonusTypeModal').dataset.editId = b ? b.id : '';
  document.getElementById('bonusTypeModal').style.display = 'flex';
}

function saveBonusType() {
  const name = document.getElementById('bonName').value.trim();
  const kind = document.getElementById('bonKind').value;
  const value = parseFloat(document.getElementById('bonValue').value) || 0;
  const desc = document.getElementById('bonDesc').value.trim();
  const deMinimis = document.getElementById('bonDeMinimis').checked;
  const dateEl = document.getElementById('bonReleaseDate');
  const releaseDate = (dateEl && !dateEl.disabled) ? (dateEl.value || '').trim() : '';
  const endDateEl = document.getElementById('bonEndDate');
  const endDate = (endDateEl && !endDateEl.disabled) ? (endDateEl.value || '').trim() : '';
  const err = document.getElementById('bonErr');
  err.style.display = 'none';
  if (!name) { err.textContent='Please enter a bonus name.'; err.style.display='block'; return; }
  if (!value || value<=0) { err.textContent='Please enter a valid multiplier or amount.'; err.style.display='block'; return; }
  if (releaseDate && isNaN(parseDate(releaseDate))) {
    err.textContent='Please enter a valid give date (or leave it blank to apply immediately).';
    err.style.display='block'; return;
  }
  if (endDate && isNaN(parseDate(endDate))) {
    err.textContent='Please enter a valid end date (or leave it blank for no expiry).';
    err.style.display='block'; return;
  }
  if (releaseDate && endDate && parseDate(endDate) < parseDate(releaseDate)) {
    err.textContent='End Date must be on or after the Give Date.';
    err.style.display='block'; return;
  }
  const editId = document.getElementById('bonusTypeModal').dataset.editId;
  const editingId = editId ? parseInt(editId) : null;
  if (bonusTypes.some(b => b.id !== editingId && normalizeBonusName(b.name) === normalizeBonusName(name))) {
    err.textContent=`"${name}" already exists. Bonus names must be unique.`;
    err.style.display='block'; return;
  }
  if (editId) {
    const b = bonusTypes.find(x=>x.id===parseInt(editId));
    if (b) { b.name=name; b.kind=kind; b.value=value; b.desc=desc; b.deMinimis=deMinimis; b.releaseDate=releaseDate; b.endDate=endDate; }
    showToast('✅', `"${name}" updated successfully!`);
  } else {
    bonusTypes.push({id:nextBonusId++, name, kind, value, desc, status:'Active', deMinimis, releaseDate, endDate});
    showToast('✅', `"${name}" added successfully!`);
  }
  closeModal('bonusTypeModal');
  saveDemo();
  renderBonusTypes();
}

function deleteBonusType(id) {
  const b = bonusTypes.find(x=>x.id===id); if(!b) return;
  if (confirm(`Remove "${b.name}"?`)) {
    bonusTypes = bonusTypes.filter(x=>x.id!==id);
    saveDemo();
    renderBonusTypes();
    showToast('🗑️', `"${b.name}" removed.`);
  }
}

function toggleBonusType(id) {
  const b = bonusTypes.find(x=>x.id===id); if(!b) return;
  if (b.status === 'Inactive') {
    openBonusDateModal(b.id, 'activate');
    return;
  }
  b.status = 'Inactive';
  b.releaseDate = '';
  b.endDate = '';
  saveDemo();
  renderBonusTypes();
  const year = parseInt(document.getElementById('bonYear')?.value||2026);
  renderPayoutBanner(year);
  const countEl = document.getElementById('bonTypesCount');
  if (countEl) countEl.textContent = bonusTypes.filter(x=>x.status==='Active').length;
  updateCalc13thState();
  showToast('⏸️', `"${b.name}" is now disabled.`);
}

let _bonusDateModalId = null;
let _bonusDateModalMode = null;

function openBonusDateModal(id, mode) {
  const b = bonusTypes.find(x=>x.id===id); if(!b) return;
  _bonusDateModalId = id;
  _bonusDateModalMode = mode || 'activate';
  document.getElementById('bonusDateModalTitle').textContent = mode === 'restart' ? '📅 Bonus Expired — Set New Schedule' : '📅 Set Bonus Schedule';
  document.getElementById('bonusDateModalBonusName').textContent = b.name;
  document.getElementById('bonusDateGive').value = '';
  document.getElementById('bonusDateEnd').value = '';
  document.getElementById('bonusDateErr').style.display = 'none';
  document.getElementById('bonusDateModal').style.display = 'flex';
}

function saveBonusDateModal() {
  const b = bonusTypes.find(x=>x.id===_bonusDateModalId); if(!b) return;
  const giveDate = (document.getElementById('bonusDateGive').value || '').trim();
  const endDate = (document.getElementById('bonusDateEnd').value || '').trim();
  const err = document.getElementById('bonusDateErr');
  err.style.display = 'none';
  if (!giveDate) { err.textContent = 'Please set a Give Date.'; err.style.display = 'block'; return; }
  if (isNaN(parseDate(giveDate))) { err.textContent = 'Please enter a valid Give Date.'; err.style.display = 'block'; return; }
  if (endDate && isNaN(parseDate(endDate))) { err.textContent = 'Please enter a valid End Date.'; err.style.display = 'block'; return; }
  if (endDate && parseDate(endDate) < parseDate(giveDate)) { err.textContent = 'End Date must be on or after the Give Date.'; err.style.display = 'block'; return; }
  b.releaseDate = giveDate;
  b.endDate = endDate;
  b.status = 'Active';
  saveDemo();
  closeModal('bonusDateModal');
  renderBonusTypes();
  const year = parseInt(document.getElementById('bonYear')?.value||2026);
  renderPayoutBanner(year);
  const countEl = document.getElementById('bonTypesCount');
  if (countEl) countEl.textContent = bonusTypes.filter(x=>x.status==='Active').length;
  updateCalc13thState();
  showToast('✅', `"${b.name}" is now active! Give: ${giveDate}${endDate ? ' → End: ' + endDate : ''}`);
}

function skipBonusDateModal() {
  const b = bonusTypes.find(x=>x.id===_bonusDateModalId); if(!b) return;
  b.releaseDate = '';
  b.endDate = '';
  b.status = 'Active';
  saveDemo();
  closeModal('bonusDateModal');
  renderBonusTypes();
  const year = parseInt(document.getElementById('bonYear')?.value||2026);
  renderPayoutBanner(year);
  const countEl = document.getElementById('bonTypesCount');
  if (countEl) countEl.textContent = bonusTypes.filter(x=>x.status==='Active').length;
  updateCalc13thState();
  showToast('✅', `"${b.name}" is now active (no date schedule).`);
}

let _endDatePromptId = null;

function openEndDatePrompt(id) {
  const b = bonusTypes.find(x=>x.id===id); if(!b) return;
  _endDatePromptId = id;
  document.getElementById('endDatePromptBonusName').textContent = b.name;
  document.getElementById('endDatePromptGiveDate').textContent = b.releaseDate;
  document.getElementById('endDatePromptInput').value = '';
  document.getElementById('endDatePromptErr').style.display = 'none';
  document.getElementById('endDatePromptModal').style.display = 'flex';
}

function saveEndDatePrompt() {
  const b = bonusTypes.find(x=>x.id===_endDatePromptId); if(!b) return;
  const endDate = (document.getElementById('endDatePromptInput').value || '').trim();
  const err = document.getElementById('endDatePromptErr');
  err.style.display = 'none';
  if (!endDate) { err.textContent = 'Please set an End Date.'; err.style.display = 'block'; return; }
  if (isNaN(parseDate(endDate))) { err.textContent = 'Please enter a valid End Date.'; err.style.display = 'block'; return; }
  if (b.releaseDate && parseDate(endDate) < parseDate(b.releaseDate)) { err.textContent = 'End Date must be on or after the Give Date (' + b.releaseDate + ').'; err.style.display = 'block'; return; }
  b.endDate = endDate;
  saveDemo();
  closeModal('endDatePromptModal');
  renderBonusTypes();
  showToast('✅', `"${b.name}" end date set to ${endDate}.`);
}

function checkBonusDates() {
  const now = new Date();
  const todayStr = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  for (const b of bonusTypes) {
    if (b.status !== 'Active' || b.id === 1) continue;
    if (b.endDate && b.endDate < todayStr) {
      b.status = 'Inactive';
      b.releaseDate = '';
      b.endDate = '';
      saveDemo();
      renderBonusTypes();
      const year = parseInt(document.getElementById('bonYear')?.value||2026);
      renderPayoutBanner(year);
      const countEl = document.getElementById('bonTypesCount');
      if (countEl) countEl.textContent = bonusTypes.filter(x=>x.status==='Active').length;
      showToast('⏸️', `"${b.name}" has expired and been deactivated.`);
      openBonusDateModal(b.id, 'restart');
      return;
    }
    if (b.releaseDate && !b.endDate && b.releaseDate <= todayStr) {
      openEndDatePrompt(b.id);
      return;
    }
  }
}

function isThirteenthActive() {
  const b = bonusTypes.find(x=>x.id===1);
  return !!(b && b.status==='Active');
}

// RA 10963 / CREATE: the annual tax-exempt ceiling for 13th Month + bonuses is
// configurable so the system stays compliant when the government amends it.
function renderBonusExemptionLimit() {
  const el = document.getElementById('bonExemptionLimit');
  if (el) el.value = BONUS_EXEMPTION_LIMIT;
  const note = document.getElementById('bonFormulaExemption');
  if (note) note.textContent = fmt(BONUS_EXEMPTION_LIMIT);
}
function saveBonusExemptionLimit() {
  const el = document.getElementById('bonExemptionLimit');
  if (!el) return;
  const v = parseFloat(el.value);
  if (isNaN(v) || v < 0) { showToast('⚠️','Enter a valid exemption limit.'); return; }
  BONUS_EXEMPTION_LIMIT = v;
  saveDemo();
  renderBonusExemptionLimit();
  renderBonusModule();
  showToast('✅', `13th Month exemption limit set to ${fmt(BONUS_EXEMPTION_LIMIT)}/year.`);
}
