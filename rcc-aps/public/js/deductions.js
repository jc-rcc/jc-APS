// ── DEDUCTION CATEGORIES ─────────────────────────────────────
let deductionCategories = (_savedDemo && _savedDemo.deductionCategories) || [];
let nextDedCatId = (_savedDemo && _savedDemo.nextDedCatId) || 1;

function renderDeductionCategories() {
  const list  = document.getElementById('deductionCategoryList');
  const empty = document.getElementById('deductionCategoryEmpty');
  if (!list) return;

  const cats = deductionCategories;
  if (!cats.length) {
    list.style.display  = 'none';
    empty.style.display = 'block';
    return;
  }
  list.style.display  = 'grid';
  empty.style.display = 'none';

  const typeLabel = { fixed:'Fixed Amount', percent:'% of Gross' };
  list.innerHTML = cats.map(c => `
    <div class="card" style="margin:0">
      <div class="card-body" style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--maroon-dark)">${esc(c.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${esc(c.desc || '—')}</div>
          </div>
          <span class="badge ${c.status==='Active'?'b-green':'b-gray'}" style="flex-shrink:0">● ${c.status}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
          <div style="background:var(--gold-pale);border:1px solid var(--gold);border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;color:var(--maroon-dark)">
            ${c.type==='fixed' ? '₱'+c.amount.toLocaleString('en-PH',{minimumFractionDigits:2}) : c.amount+'%'}
          </div>
          <div style="font-size:12px;color:var(--text-muted)">${typeLabel[c.type]}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="editDeductionCategory(${c.id})">✏️ Edit</button>
          <button class="btn btn-outline btn-sm" style="color:#C62828;border-color:#FFCDD2" onclick="deleteDeductionCategory(${c.id})">🗑️ Remove</button>
        </div>
      </div>
    </div>`).join('');
}

function openPeraaDeduction() {
  const existing = deductionCategories.find(c => String(c.name).trim().toUpperCase() === 'PERAA');
  if (existing) { editDeductionCategory(existing.id); return; }
  openAddDeductionCategory();
  document.getElementById('dedCatModalTitle').textContent = 'Configure PERAA Contribution';
  document.getElementById('dedCatName').value = 'PERAA';
  document.getElementById('dedCatAmount').value = '0';
  document.getElementById('dedCatDesc').value = 'Private Education Retirement Annuity Association — employee retirement contribution';
}

function openAddDeductionCategory() {
  document.getElementById('dedCatModalTitle').textContent = 'Add Deduction Category';
  document.getElementById('dedCatName').value   = '';
  document.getElementById('dedCatType').value   = 'fixed';
  document.getElementById('dedCatAmount').value = '';
  document.getElementById('dedCatDesc').value   = '';
  document.getElementById('dedCatStatus').value = 'Active';
  document.getElementById('dedCatErr').style.display = 'none';
  document.getElementById('dedCatAmountLabel').textContent = 'Default Amount (₱)';
  document.getElementById('dedCatModal').style.display = 'flex';
  document.getElementById('dedCatModal').dataset.editId = '';
}

function editDeductionCategory(id) {
  const c = deductionCategories.find(x=>x.id===id); if(!c) return;
  document.getElementById('dedCatModalTitle').textContent = 'Edit Deduction Category';
  document.getElementById('dedCatName').value   = c.name;
  document.getElementById('dedCatType').value   = c.type;
  document.getElementById('dedCatAmount').value = c.amount;
  document.getElementById('dedCatDesc').value   = c.desc;
  document.getElementById('dedCatStatus').value = c.status;
  document.getElementById('dedCatErr').style.display = 'none';
  document.getElementById('dedCatAmountLabel').textContent = c.type==='fixed' ? 'Default Amount (₱)' : 'Rate (%)';
  document.getElementById('dedCatModal').style.display = 'flex';
  document.getElementById('dedCatModal').dataset.editId = id;
}

async function saveDeductionCategory() {
  const name   = document.getElementById('dedCatName').value.trim();
  const type   = document.getElementById('dedCatType').value;
  const amount = Number(document.getElementById('dedCatAmount').value);
  const desc   = document.getElementById('dedCatDesc').value.trim();
  const status = document.getElementById('dedCatStatus').value;
  const err    = document.getElementById('dedCatErr');
  err.style.display = 'none';

  if (!name) { err.textContent='Please enter a category name.'; err.style.display='block'; return; }
  if (!Number.isFinite(amount) || amount < 0 || (type === 'percent' && amount > 100)) {
    err.textContent = 'Enter a non-negative amount, or a percentage between 0 and 100.';
    err.style.display = 'block'; return;
  }

  const editId = document.getElementById('dedCatModal').dataset.editId;
  if (deductionCategories.some(c => String(c.name).trim().toLowerCase() === name.toLowerCase() && c.id !== parseInt(editId))) {
    err.textContent = 'A deduction category with this name already exists.';
    err.style.display = 'block'; return;
  }
  if (editId) {
    const c = deductionCategories.find(x=>x.id===parseInt(editId));
    if (c) { c.name=name; c.type=type; c.amount=amount; c.desc=desc; c.status=status; }
    showToast('✅', `"${name}" updated successfully!`);
  } else {
    deductionCategories.push({ id:nextDedCatId++, name, type, amount, desc, status });
    showToast('✅', `"${name}" added successfully!`);
  }
  closeModal('dedCatModal');
  if (!await saveDemo()) return;
  renderDeductionCategories();
}

function deleteDeductionCategory(id) {
  const c = deductionCategories.find(x=>x.id===id); if(!c) return;
  if (confirm(`Remove "${c.name}"? This cannot be undone.`)) {
    deductionCategories = deductionCategories.filter(x=>x.id!==id);
    saveDemo();
    renderDeductionCategories();
    showToast('🗑️', `"${c.name}" removed.`);
  }
}

// Update type label when type changes
document.addEventListener('change', e => {
  if (e.target.id === 'dedCatType') {
    document.getElementById('dedCatAmountLabel').textContent =
      e.target.value === 'fixed' ? 'Default Amount (₱)' : 'Rate (%)';
  }
});



// ── LEAVE TYPES MANAGEMENT ────────────────────────────────────
function renderLeaveTypes() {
  const list = document.getElementById('leaveTypeList');
  const empty = document.getElementById('leaveTypeEmpty');
  if (!list) return;

  const types = LEAVE_TYPES;
  if (!types.length) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  list.style.display = 'grid';
  empty.style.display = 'none';

  list.innerHTML = types.map(lt => `
    <div class="card" style="margin:0">
      <div class="card-body" style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--maroon-dark)">${esc(lt.name)}</div>
          </div>
          <span class="badge ${lt.isPaid ? 'b-green' : 'b-red'}" style="flex-shrink:0">● ${lt.isPaid ? 'Paid' : 'Unpaid'}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px">
          <div style="background:${lt.isPaid ? '#E8F5E9' : '#FFEBEE'};border:1px solid ${lt.isPaid ? '#A5D6A7' : '#FFCDD2'};border-radius:8px;padding:6px 14px;font-size:13px;font-weight:700;color:${lt.isPaid ? '#2E7D32' : '#C62828'}">
            ${lt.isPaid ? '✅ Paid — No deduction' : '❌ Unpaid — Deducted from gross'}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="editLeaveType(${lt.id})">✏️ Edit</button>
          <button class="btn btn-outline btn-sm" style="color:#C62828;border-color:#FFCDD2" onclick="deleteLeaveType(${lt.id})">🗑️ Remove</button>
        </div>
      </div>
    </div>`).join('');
  renderLeaveRecords();
}

function openAddLeaveType() {
  document.getElementById('leaveTypeModalTitle').textContent = 'Add Leave Type';
  document.getElementById('leaveTypeName').value = '';
  document.getElementById('leaveTypePaid').value = 'false';
  document.getElementById('leaveTypeErr').style.display = 'none';
  document.getElementById('leaveTypeModal').style.display = 'flex';
  document.getElementById('leaveTypeModal').dataset.editId = '';
}

function editLeaveType(id) {
  const lt = LEAVE_TYPES.find(x => x.id === id);
  if (!lt) return;
  document.getElementById('leaveTypeModalTitle').textContent = 'Edit Leave Type';
  document.getElementById('leaveTypeName').value = lt.name;
  document.getElementById('leaveTypePaid').value = lt.isPaid ? 'true' : 'false';
  document.getElementById('leaveTypeErr').style.display = 'none';
  document.getElementById('leaveTypeModal').style.display = 'flex';
  document.getElementById('leaveTypeModal').dataset.editId = id;
}

async function saveLeaveType() {
  const name = document.getElementById('leaveTypeName').value.trim();
  const isPaid = document.getElementById('leaveTypePaid').value === 'true';
  const err = document.getElementById('leaveTypeErr');
  err.style.display = 'none';

  if (!name) { err.textContent = 'Please enter a leave type name.'; err.style.display = 'block'; return; }

  const editId = document.getElementById('leaveTypeModal').dataset.editId;
  if (editId) {
    const lt = LEAVE_TYPES.find(x => x.id === parseInt(editId));
    if (lt) { lt.name = name; lt.isPaid = isPaid; }
    showToast('✅', `"${name}" updated successfully!`);
  } else {
    LEAVE_TYPES.push({ id: NEXT_LEAVE_TYPE_ID++, name, isPaid });
    showToast('✅', `"${name}" added successfully!`);
  }
  closeModal('leaveTypeModal');
  if (!await saveDemo()) return;
  renderLeaveTypes();
}

function deleteLeaveType(id) {
  const lt = LEAVE_TYPES.find(x => x.id === id);
  if (!lt) return;
  if (confirm(`Remove "${lt.name}"? This cannot be undone.`)) {
    LEAVE_TYPES = LEAVE_TYPES.filter(x => x.id !== id);
    saveDemo();
    renderLeaveTypes();
    showToast('🗑️', `"${lt.name}" removed.`);
  }
}

// ── LEAVE RECORDS MANAGEMENT ──────────────────────────────────
let leaveRecordDaysManuallySet = false;

// Inclusive day count between two ISO date strings (matches payroll.js).
function computeLeaveDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

// Recompute the Days field from the chosen start/end dates unless the user
// explicitly typed a value, and show a live preview of the resulting deduction.
function updateLeaveRecordDays() {
  const startEl = document.getElementById('leaveRecordStart');
  const endEl = document.getElementById('leaveRecordEnd');
  const daysEl = document.getElementById('leaveRecordDays');
  if (!startEl || !endEl || !daysEl) return;
  if (startEl.value && endEl.value && !leaveRecordDaysManuallySet) {
    daysEl.value = computeLeaveDays(startEl.value, endEl.value) || '';
  }
}

function renderLeaveRecords() {
  const list = document.getElementById('leaveRecordList');
  const empty = document.getElementById('leaveRecordEmpty');
  if (!list) return;

  const records = LEAVE_RECORDS;
  if (!records.length) {
    list.innerHTML = '';
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  // Filter by selected employee
  const selectedEmpId = parseInt(document.getElementById('leaveRecEmp')?.value) || 0;
  const filtered = records.filter(rec => {
    return !selectedEmpId || rec.empId === selectedEmpId;
  });

  list.style.display = 'table-row-group';
  empty.style.display = 'none';

  list.innerHTML = filtered.map(rec => {
    const emp = users.find(u => u.id === rec.empId);
    const lt = LEAVE_TYPES.find(t => t.id === rec.typeId);
    const name = emp ? displayName(emp) : ('#USR-' + (rec.empId || '?'));
    const typeName = lt ? esc(lt.name) : 'Leave Type ' + rec.typeId;
    const paid = lt ? lt.isPaid : false;
    return `<tr>
      <td><strong>${esc(name)}</strong></td>
      <td>${typeName}</td>
      <td>${esc(rec.startDate || '—')} → ${esc(rec.endDate || '—')}</td>
      <td>${rec.days || computeLeaveDays(rec.startDate, rec.endDate)}</td>
      <td><span class="badge ${paid ? 'b-green' : 'b-red'}">● ${paid ? 'Paid' : 'Unpaid'}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="editLeaveRecord(${rec.id || rec._rid})">✏️ Edit</button>
        <button class="btn btn-outline btn-sm" style="color:#C62828;border-color:#FFCDD2" onclick="deleteLeaveRecord(${rec.id || rec._rid})">🗑️ Remove</button>
      </div></td>
    </tr>`;
  }).join('');
}

let nextLeaveRecordId = (_savedDemo && _savedDemo.nextLeaveRecordId) || (LEAVE_RECORDS.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1);

// ── LEAVE RECORDS EMPLOYEE FILTER (combobox) ──────────────────
function leaveRecEmpOptions() {
  return users.filter(u => u.status === 'Active' && (u.role === 'Employee' || u.role === 'Finance Officer' || u.role === 'System Admin'));
}
function getLeaveRecEmpQuery() {
  return ((document.getElementById('leaveRecEmpSearch') || {}).value || '').toLowerCase().trim();
}
function leaveRecEmpMatches(u) {
  const q = getLeaveRecEmpQuery();
  if (!q) return true;
  const name = `${u.first} ${u.last}`.toLowerCase();
  return name.includes(q) || (u.email || '').toLowerCase().includes(q);
}
function renderLeaveRecEmpList(list, show) {
  const box = document.getElementById('leaveRecEmpList');
  if (!box) return;
  const allItem = `<div class="combobox-item" onclick="selectLeaveRecEmp(0)" style="font-weight:600;color:var(--maroon-dark)">📋 All Employees</div>`;
  box.innerHTML = allItem + (list.length
    ? list.map(u => `<div class="combobox-item" onclick="selectLeaveRecEmp(${u.id})">${esc(displayName(u))} — ${u.classification}</div>`).join('')
    : '<div class="combobox-empty">No employee found.</div>');
  box.classList.toggle('show', show !== false);
}
function openLeaveRecEmpList() {
  renderLeaveRecEmpList(leaveRecEmpOptions().filter(leaveRecEmpMatches));
}
function toggleLeaveRecEmpList(e) {
  if (e) e.stopPropagation();
  const box = document.getElementById('leaveRecEmpList');
  if (box && box.classList.contains('show')) closeLeaveRecEmpList();
  else openLeaveRecEmpList();
}
function closeLeaveRecEmpList() {
  const box = document.getElementById('leaveRecEmpList');
  if (box) box.classList.remove('show');
}
function onLeaveRecEmpInput() {
  openLeaveRecEmpList();
}
function onLeaveRecEmpKey(e) {
  if (e.key === 'Escape') { closeLeaveRecEmpList(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); openLeaveRecEmpList(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const item = document.querySelector('#leaveRecEmpList .combobox-item');
    if (item) item.click();
  }
  if (e.key === 'Backspace' && !e.target.value) {
    selectLeaveRecEmp(0);
  }
}
function selectLeaveRecEmp(id) {
  document.getElementById('leaveRecEmp').value = id;
  const inp = document.getElementById('leaveRecEmpSearch');
  if (id === 0) {
    inp.value = '';
    inp.placeholder = 'All Employees';
  } else {
    const emp = users.find(u => u.id === id);
    if (emp) inp.value = displayName(emp);
  }
  closeLeaveRecEmpList();
  renderLeaveRecords();
}
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('leaveRecEmpWrap');
  if (wrap && !wrap.contains(e.target)) closeLeaveRecEmpList();
});

// Render HRIS attendance (read-only, imported via sync). Shows one row per day.
function renderAttendance() {
  const list = document.getElementById('attendanceList');
  const empty = document.getElementById('attendanceEmpty');
  if (!list) return;

  const records = (ATTENDANCE || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (!records.length) {
    list.innerHTML = '';
    list.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  // Filter by selected employee
  const selectedEmpId = parseInt(document.getElementById('attEmp')?.value) || 0;
  const filtered = records.filter(r => {
    return !selectedEmpId || r.empId === selectedEmpId;
  });

  if (empty) empty.style.display = 'none';
  list.style.display = 'table-row-group';

  list.innerHTML = filtered.map(r => {
    const emp = users.find(u => u.id === r.empId);
    const name = emp ? displayName(emp) : ('#USR-' + (r.empId || '?'));
    const inTxt = fmtClock(r.clockInAt);
    const outTxt = fmtClock(r.clockOutAt);
    const hrs = r.hours != null ? r.hours : '—';
    return `<tr>
      <td><strong>${esc(name)}</strong></td>
      <td>${esc(r.date || '—')}</td>
      <td>${inTxt}</td>
      <td>${outTxt}</td>
      <td>${hrs} hrs</td>
    </tr>`;
  }).join('');
}

// Format an ISO UTC time into Manila local (UTC+8) HH:MM for display.
function fmtClock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  d.setMinutes(d.getMinutes() + 8 * 60); // UTC -> Asia/Manila
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

// ── ATTENDANCE EMPLOYEE FILTER (combobox) ─────────────────────
function attEmpOptions() {
  return users.filter(u => u.status === 'Active' && (u.role === 'Employee' || u.role === 'Finance Officer' || u.role === 'System Admin'));
}
function getAttEmpQuery() {
  return ((document.getElementById('attEmpSearch') || {}).value || '').toLowerCase().trim();
}
function attEmpMatches(u) {
  const q = getAttEmpQuery();
  if (!q) return true;
  const name = `${u.first} ${u.last}`.toLowerCase();
  return name.includes(q) || (u.email || '').toLowerCase().includes(q);
}
function renderAttEmpList(list, show) {
  const box = document.getElementById('attEmpList');
  if (!box) return;
  const allItem = `<div class="combobox-item" onclick="selectAttEmp(0)" style="font-weight:600;color:var(--maroon-dark)">📋 All Employees</div>`;
  box.innerHTML = allItem + (list.length
    ? list.map(u => `<div class="combobox-item" onclick="selectAttEmp(${u.id})">${esc(displayName(u))} — ${u.classification}</div>`).join('')
    : '<div class="combobox-empty">No employee found.</div>');
  box.classList.toggle('show', show !== false);
}
function openAttEmpList() {
  renderAttEmpList(attEmpOptions().filter(attEmpMatches));
}
function toggleAttEmpList(e) {
  if (e) e.stopPropagation();
  const box = document.getElementById('attEmpList');
  if (box && box.classList.contains('show')) closeAttEmpList();
  else openAttEmpList();
}
function closeAttEmpList() {
  const box = document.getElementById('attEmpList');
  if (box) box.classList.remove('show');
}
function onAttEmpInput() {
  openAttEmpList();
}
function onAttEmpKey(e) {
  if (e.key === 'Escape') { closeAttEmpList(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); openAttEmpList(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const item = document.querySelector('#attEmpList .combobox-item');
    if (item) item.click();
  }
  if (e.key === 'Backspace' && !e.target.value) {
    selectAttEmp(0);
  }
}
function selectAttEmp(id) {
  document.getElementById('attEmp').value = id;
  const inp = document.getElementById('attEmpSearch');
  if (id === 0) {
    inp.value = '';
    inp.placeholder = 'All Employees';
  } else {
    const emp = users.find(u => u.id === id);
    if (emp) inp.value = displayName(emp);
  }
  closeAttEmpList();
  renderAttendance();
}
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('attEmpWrap');
  if (wrap && !wrap.contains(e.target)) closeAttEmpList();
});

function leaveRecordEmpOptions() {
  return users.filter(u => u.status === 'Active' && (u.role === 'Employee' || u.role === 'Finance Officer' || u.role === 'System Admin'));
}
function closeLeaveRecordEmpList() {
  document.getElementById('leaveRecordEmpList').classList.remove('show');
  document.getElementById('leaveRecordEmpSearch').setAttribute('aria-expanded', 'false');
}
function openLeaveRecordEmpList() {
  const input = document.getElementById('leaveRecordEmpSearch');
  const selected = document.getElementById('leaveRecordEmp').value;
  const query = selected ? '' : input.value.trim().toLowerCase();
  const list = leaveRecordEmpOptions().filter(u =>
    displayName(u).toLowerCase().includes(query) || `${u.first} ${u.last}`.toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query));
  const box = document.getElementById('leaveRecordEmpList');
  box.innerHTML = list.length
    ? list.map(u => `<div class="combobox-item" role="option" aria-selected="${String(u.id) === selected}" onclick="selectLeaveRecordEmp(${u.id})">${esc(displayName(u))} — ${esc(u.classification || '')}</div>`).join('')
    : '<div class="combobox-empty">No employee found.</div>';
  box.classList.add('show');
  input.setAttribute('aria-expanded', 'true');
}
function selectLeaveRecordEmp(id) {
  const emp = users.find(u => u.id === id);
  document.getElementById('leaveRecordEmp').value = emp ? emp.id : '';
  document.getElementById('leaveRecordEmpSearch').value = emp ? displayName(emp) : '';
  closeLeaveRecordEmpList();
}
function onLeaveRecordEmpInput() {
  document.getElementById('leaveRecordEmp').value = '';
  openLeaveRecordEmpList();
}
function toggleLeaveRecordEmpList() {
  if (document.getElementById('leaveRecordEmpList').classList.contains('show')) closeLeaveRecordEmpList();
  else openLeaveRecordEmpList();
}
function onLeaveRecordEmpKey(e) {
  if (e.key === 'Escape' || e.key === 'Tab') { closeLeaveRecordEmpList(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); openLeaveRecordEmpList(); }
  if (e.key === 'Enter') {
    e.preventDefault();
    const item = document.querySelector('#leaveRecordEmpList.show .combobox-item');
    if (item) item.click();
  }
}
document.addEventListener('click', function(e) {
  const wrap = document.getElementById('leaveRecordEmpWrap');
  if (wrap && !wrap.contains(e.target)) closeLeaveRecordEmpList();
});

function openAddLeaveRecord() {
  selectLeaveRecordEmp(0);
  const typeSel = document.getElementById('leaveRecordType');
  if (typeSel) typeSel.innerHTML = LEAVE_TYPES
    .map(t => `<option value="${t.id}">${esc(t.name)} (${t.isPaid ? 'Paid' : 'Unpaid'})</option>`).join('');

  document.getElementById('leaveRecordModalTitle').textContent = 'Add Leave Record';
  document.getElementById('leaveRecordStart').value = '';
  document.getElementById('leaveRecordEnd').value = '';
  document.getElementById('leaveRecordDays').value = '';
  document.getElementById('leaveRecordErr').style.display = 'none';
  document.getElementById('leaveRecordModal').dataset.editId = '';
  leaveRecordDaysManuallySet = false;
  document.getElementById('leaveRecordModal').style.display = 'flex';
}

function editLeaveRecord(id) {
  const rec = LEAVE_RECORDS.find(r => r.id === id);
  if (!rec) return;
  const typeSel = document.getElementById('leaveRecordType');
  if (typeSel) typeSel.innerHTML = LEAVE_TYPES
    .map(t => `<option value="${t.id}">${esc(t.name)} (${t.isPaid ? 'Paid' : 'Unpaid'})</option>`).join('');

  document.getElementById('leaveRecordModalTitle').textContent = 'Edit Leave Record';
  selectLeaveRecordEmp(rec.empId);
  document.getElementById('leaveRecordType').value = rec.typeId;
  document.getElementById('leaveRecordStart').value = rec.startDate || '';
  document.getElementById('leaveRecordEnd').value = rec.endDate || '';
  document.getElementById('leaveRecordDays').value = rec.days || '';
  document.getElementById('leaveRecordErr').style.display = 'none';
  document.getElementById('leaveRecordModal').dataset.editId = id;
  leaveRecordDaysManuallySet = true;
  document.getElementById('leaveRecordModal').style.display = 'flex';
}

async function saveLeaveRecord() {
  const empId = parseInt(document.getElementById('leaveRecordEmp').value) || 0;
  const typeId = parseInt(document.getElementById('leaveRecordType').value) || 0;
  const startDate = document.getElementById('leaveRecordStart').value;
  const endDate = document.getElementById('leaveRecordEnd').value;
  const days = parseFloat(document.getElementById('leaveRecordDays').value);
  const err = document.getElementById('leaveRecordErr');
  err.style.display = 'none';

  if (!empId) { err.textContent = 'Please select an employee.'; err.style.display = 'block'; return; }
  if (!typeId) { err.textContent = 'Please select a leave type.'; err.style.display = 'block'; return; }
  if (!startDate || !endDate) { err.textContent = 'Please enter both start and end dates.'; err.style.display = 'block'; return; }
  if (new Date(endDate) < new Date(startDate)) { err.textContent = 'End date cannot be before the start date.'; err.style.display = 'block'; return; }
  if (!(days > 0)) { err.textContent = 'Please enter the number of days (or make sure dates are valid).'; err.style.display = 'block'; return; }

  const editId = document.getElementById('leaveRecordModal').dataset.editId;
  if (editId) {
    const rec = LEAVE_RECORDS.find(r => r.id === parseInt(editId));
    if (rec) { rec.empId = empId; rec.typeId = typeId; rec.startDate = startDate; rec.endDate = endDate; rec.days = days; }
    showToast('✅', 'Leave record updated successfully!');
  } else {
    LEAVE_RECORDS.push({ id: nextLeaveRecordId++, empId, typeId, startDate, endDate, days });
    showToast('✅', 'Leave record added successfully!');
  }
  closeModal('leaveRecordModal');
  if (!await saveDemo()) return;
  renderLeaveRecords();
}

function deleteLeaveRecord(id) {
  if (confirm('Remove this leave record? This cannot be undone.')) {
    LEAVE_RECORDS = LEAVE_RECORDS.filter(r => r.id !== id);
    nextLeaveRecordId = LEAVE_RECORDS.reduce((m, r) => Math.max(m, r.id || 0), 0) + 1;
    saveDemo();
    renderLeaveRecords();
    showToast('🗑️', 'Leave record removed.');
  }
}

// ── USER MANAGEMENT ───────────────────────────────────────────
const roleColor = {'System Admin':'#880E4F','Finance Officer':'#7D5A00','Employee':'#1565C0'};
const roleBadge = {'System Admin':'b-pink','Finance Officer':'b-gold','Employee':'b-blue'};
function initials(f,l){ return (f[0]+(l[0]||'')).toUpperCase(); }

function renderUserTable() {
  const q      = (document.getElementById('uSearch')||{}).value?.toLowerCase()||'';
  const role   = (document.getElementById('uRoleFilter')||{}).value||'';
  const status = (document.getElementById('uStatusFilter')||{}).value||'';
  const filtered = users.filter(u=>{
    const name = `${u.first} ${u.last}`.toLowerCase();
    return (!q || name.includes(q)||u.email.includes(q)) && (!role||u.role===role) && (!status||u.status===status);
  });
  const tbody = document.getElementById('userTableBody');
  if (!tbody) return;
  tbody.innerHTML = filtered.map(u=>`
    <tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:34px;height:34px;border-radius:50%;background:${roleColor[u.role]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${userPhotoMarkup(u)}</div>
        <div><div style="font-weight:600">${esc(displayName(u))} <span class="badge ${EMP_CLASS[u.classification||'Non-Teaching']?.badge||'b-gray'}" style="margin-left:6px;font-size:10px">${u.classification||'Non-Teaching'}</span></div><div style="font-size:11px;color:var(--text-muted)">#USR-00${u.id}</div></div>
      </div></td>
      <td>${esc(u.email)}</td>
      <td><span class="badge ${roleBadge[u.role]}">${u.role}</span></td>
      <td><span class="badge ${u.status==='Active'?'b-green':'b-gray'}">${u.status==='Active'?'● Active':'● Inactive'}</span></td>
      <td>${u.date}</td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-outline btn-sm btn-icon" title="Edit" onclick="openEditUserModal(${u.id})">✏️</button>
        <button class="btn btn-outline btn-sm btn-icon" title="View" onclick="viewUser(${u.id})">👁</button>
        ${u.status==='Active'
          ? `<button class="btn btn-outline btn-sm btn-icon" style="color:#C62828;border-color:#FFCDD2" title="Deactivate" onclick="confirmDeactivate(${u.id})">⏸</button>`
          : `<button class="btn btn-outline btn-sm btn-icon" title="Reactivate" onclick="reactivateUser(${u.id})">▶</button>`}
        <button class="btn btn-outline btn-sm btn-icon" style="color:#C62828;border-color:#FFCDD2" title="Remove" onclick="confirmRemove(${u.id})">🗑️</button>
      </div></td>
    </tr>`).join('');
  document.getElementById('uEmpty').style.display = filtered.length ? 'none' : 'block';
  updateAdminStats();
}

function updateAdminStats() {
  const tot = users.length, act = users.filter(u=>u.status==='Active').length;
  const inact = users.filter(u=>u.status==='Inactive').length;
  const adm = users.filter(u=>u.role==='System Admin').length;
  const fin = users.filter(u=>u.role==='Finance Officer').length;
  const emp = users.filter(u=>u.role==='Employee').length;
  ['admTot','admTotStat'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=tot; });
  ['admAct','admActStat'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=act; });
  ['admInact','admInactStat'].forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=inact; });
  const bd = document.getElementById('admBreakdown'); if(bd) bd.textContent=`${adm} Admin · ${fin} Finance · ${emp} Emp`;
  const now = new Date();
  const nw = document.getElementById('admNew');
  if (nw) nw.textContent = users.filter(u => {
    const t = Date.parse(u.date);
    if (!t) return false;
    const d = new Date(t);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  ['u-admin','u-finance','u-employee','u-inactive'].forEach((id,i)=>{
    const el=document.getElementById(id); if(el) el.textContent=[adm,fin,emp,inact][i];
  });
}

function renderAdminRecentUsers() {
  const tbody = document.getElementById('admRecentUsers');
  if (!tbody) return;
  // Most recently ADDED accounts first, using each account's real added date.
  const recent = users.slice()
    .sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0))
    .slice(0,4);
  tbody.innerHTML = recent.map(u=>`
    <tr>
      <td><strong>${esc(displayName(u))}</strong></td>
      <td><span class="badge ${roleBadge[u.role]}">${u.role}</span></td>
      <td style="font-size:12px;color:var(--text-muted)">${u.date || '—'}</td>
      <td><span class="badge ${u.status==='Active'?'b-green':'b-gray'}">${u.status==='Active'?'● Active':'● Inactive'}</span></td>
    </tr>`).join('');
}

function isAdminUserManagement() {
  return typeof loggedInUser !== 'undefined' && loggedInUser && loggedInUser.role === 'admin';
}

function openAddUserModal() {
  editingUserId = null;
  document.getElementById('uModalTitle').textContent = 'Add New User';
  document.getElementById('uHire').max = new Date().toISOString().slice(0,10);
  document.getElementById('uFirst').value  = '';
  document.getElementById('uLast').value   = '';
  document.getElementById('uEmail').value  = '';
  document.getElementById('uRole').value   = 'Employee';
  document.getElementById('uStatus').value = 'Active';
  document.getElementById('uPass').value   = '';
  document.getElementById('uClass').value  = 'Non-Teaching';
  document.getElementById('uDept').value   = '';
  document.getElementById('uSalary').value = '';
  document.getElementById('uHourly').value = '';
  document.getElementById('uSchoolLevel').value = '';
  document.getElementById('uRank').value = '0';
  document.getElementById('uHire').value   = '';
  document.getElementById('uHrsAbs').value = '';
  document.getElementById('uPassGroup').style.display = 'block';
  document.getElementById('uErr').classList.remove('show');
  salaryAuto = true; // new users: auto-suggest Basic Salary from rate × hours
  toggleUserClassFields();
  document.getElementById('userModal').classList.add('show');
}
function openEditUserModal(id) {
  const u = users.find(x=>x.id===id); if(!u) return;
  editingUserId = id;
  document.getElementById('uModalTitle').textContent = 'Edit User';
  document.getElementById('uHire').max = new Date().toISOString().slice(0,10);
  document.getElementById('uFirst').value  = u.first;
  document.getElementById('uLast').value   = u.last;
  document.getElementById('uEmail').value  = u.email;
  document.getElementById('uRole').value   = u.role;
  document.getElementById('uStatus').value = u.status;
  document.getElementById('uClass').value  = u.classification || 'Non-Teaching';
  document.getElementById('uDept').value   = u.department || '';
  document.getElementById('uSalary').value = isAdminUserManagement() ? '' : (u.salary || '');
  document.getElementById('uHourly').value = isAdminUserManagement() ? '' : (u.hourlyRate || '');
  document.getElementById('uSchoolLevel').value = u.schoolLevel || '';
  if (!isAdminUserManagement() && typeof fillRankSelect === 'function') fillRankSelect(u.schoolLevel || '', u.rankId || 0);
  document.getElementById('uHire').value   = u.hireDate || '';
  document.getElementById('uHrsAbs').value = (u.hoursWorked || u.absenceDays || '');
  document.getElementById('uPassGroup').style.display = 'none';
  document.getElementById('uErr').classList.remove('show');
  salaryAuto = false; // respect the stored salary — never auto-overwrite on edit
  toggleUserClassFields();
  closeModal('viewUserModal');
  document.getElementById('userModal').classList.add('show');
}
function toggleUserClassFields() {
  const hidePay = isAdminUserManagement();
  const compensation = document.getElementById('uCompensationFields');
  if (compensation) compensation.hidden = hidePay;
  if (hidePay) {
    document.getElementById('uSalary').value = '';
    document.getElementById('uHourly').value = '';
    document.getElementById('uRank').innerHTML = '';
  }
  const c = document.getElementById('uClass')?.value;
  const teaching = c === 'Teaching';
  const hg = document.getElementById('uHourlyGroup');
  if (hg) hg.style.display = teaching ? 'block' : 'none';
  const hr = document.getElementById('uHourly');
  if (hr) hr.disabled = !teaching;
  const title = document.getElementById('uPaySectionTitle');
  if (title) title.textContent = teaching
    ? '⏱️ PAY SETUP — HOURLY-RATE'
    : '💰 PAY SETUP — MONTHLY-RATE';
  const lbl = document.getElementById('uHrsLabel');
  if (lbl) lbl.textContent = teaching
    ? 'Default Hours Worked (/month)'
    : 'Default Absences (days/month)';
  const hrs = document.getElementById('uHrsAbs');
  if (hrs) hrs.placeholder = teaching ? 'e.g. 150' : 'e.g. 0';
  const hrsCap = document.getElementById('uHrsCap');
  if (hrsCap) hrsCap.textContent = teaching
    ? 'Default hours pre-filled when computing payroll (pay = rate × hours).'
    : 'Absence days are deducted as salary ÷ Working Days per Month per day.';
  const cap = document.getElementById('uSalaryCap');
  if (cap) cap.innerHTML = teaching
    ? 'Required for ALL personnel — benefits &amp; records basis. <strong>Auto-filled</strong> as Hourly Rate × Hours Worked; you may override it.'
    : 'Fixed monthly rate — used for benefits &amp; records eligibility and absence deductions.';
  const slg = document.getElementById('uSchoolLevelGroup');
  if (slg) slg.style.display = teaching ? 'block' : 'none';
  const rg = document.getElementById('uRankGroup');
  if (rg) rg.style.display = teaching ? 'block' : 'none';
  if (teaching && !hidePay) {
    const sl = document.getElementById('uSchoolLevel')?.value || 'College';
    if (typeof fillRankSelect === 'function') fillRankSelect(sl, 0);
    updateHourlyRateLabel(sl);
  }
}

// ── Rate label helper per school level ──────────────────────────
function updateHourlyRateLabel(sl) {
  const lbl = document.getElementById('uHourlyLabel');
  const hint = document.getElementById('uHourlyHint');
  if (!lbl && !hint) return;
  const isWorkload = sl === 'High School';
  const isMonth = sl === 'Elementary';
  if (lbl) lbl.textContent = isWorkload ? 'Rate per Workload (₱) *' : isMonth ? 'Rate per Month (₱) *' : 'Rate per Hour (₱) *';
  if (hint) hint.textContent = isMonth
    ? 'Teaching pay = Monthly Rate − Absence Deduction (÷ Working Days per Month).'
    : isWorkload
    ? 'Teaching pay = Rate per Workload × Workloads (1 workload = ' + ((typeof HOURS_PER_WORKLOAD !== 'undefined' && HOURS_PER_WORKLOAD) ? HOURS_PER_WORKLOAD : 3) + ' hrs).'
    : 'Teaching pay = Rate per Hour × Hours Worked.';
}

// ── Teaching auto-suggest: Basic Salary ≈ Hourly Rate × Hours ──
let salaryAuto = true;
function recalcSuggestedSalary() {
  if (isAdminUserManagement()) return;
  if (!salaryAuto) return;
  const cls = document.getElementById('uClass')?.value;
  if (cls !== 'Teaching') return;
  const sl = document.getElementById('uSchoolLevel')?.value || '';
  const r = parseFloat(document.getElementById('uHourly')?.value);
  const h = parseFloat(document.getElementById('uHrsAbs')?.value);
  if ((!isNaN(r) && r > 0) && (!isNaN(h) && h > 0)) {
    const sal = document.getElementById('uSalary');
    if (sal) {
      let computed;
      if (sl === 'Elementary') {
        computed = r; // monthly rate from rank
      } else if (sl === 'High School') {
        computed = Math.round(r * h / ((typeof HOURS_PER_WORKLOAD !== 'undefined' && HOURS_PER_WORKLOAD) ? HOURS_PER_WORKLOAD : 3) * 100) / 100; // rate × workloads (hrs ÷ hours-per-workload)
      } else {
        computed = Math.round(r * h * 100) / 100; // College/Grad: rate × hours
      }
      sal.value = computed;
    }
  }
}
(function wirePaySetupListeners() {
  ['uHourly','uHrsAbs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => { salaryAuto = true; recalcSuggestedSalary(); });
  });
  const sal = document.getElementById('uSalary');
  if (sal) sal.addEventListener('input', () => { salaryAuto = false; });
})();

function onSchoolLevelChange() {
  const sl = document.getElementById('uSchoolLevel')?.value || '';
  if (!isAdminUserManagement() && typeof fillRankSelect === 'function') fillRankSelect(sl, 0);
  updateHourlyRateLabel(sl);
}

function onRankChange() {
  if (isAdminUserManagement()) return;
  const rankId = parseInt(document.getElementById('uRank')?.value) || 0;
  const rankObj = rankId ? (typeof rankById === 'function' ? rankById(rankId) : null) : null;
  if (rankObj) {
    document.getElementById('uHourly').value = rankObj.rate;
    salaryAuto = true;
    recalcSuggestedSalary();
  }
}
async function saveUser() {
  const hidePay = isAdminUserManagement();
  const existingUser = users.find(u => u.id === editingUserId);
  const first=document.getElementById('uFirst').value.trim(), last=document.getElementById('uLast').value.trim();
  const email=document.getElementById('uEmail').value.trim(), role=document.getElementById('uRole').value;
  const status=document.getElementById('uStatus').value, pass=document.getElementById('uPass').value.trim();
  const classification=document.getElementById('uClass').value;
  const department=document.getElementById('uDept').value.trim();
  const salary=hidePay ? (existingUser?.salary || 0) : Math.max(0,parseFloat(document.getElementById('uSalary').value)||0);
  const hourlyRate=hidePay ? (existingUser?.hourlyRate || 0) : Math.max(0,parseFloat(document.getElementById('uHourly').value)||0);
  const schoolLevel=document.getElementById('uSchoolLevel')?.value || '';
  const rankId=hidePay ? (existingUser?.rankId || 0) : (parseInt(document.getElementById('uRank')?.value)||0);
  const rankObj = rankId ? (typeof rankById === 'function' ? rankById(rankId) : null) : null;
  const rankName = hidePay ? (existingUser?.rankName || '') : (rankObj ? rankObj.rank : '');
  const rateCustom = hidePay ? !!existingUser?.rateCustom : (!rankObj || (Math.abs(hourlyRate - parseFloat(rankObj.rate)) > 0.001));
  const hireDate=document.getElementById('uHire').value;
  const hrsAbs=Math.max(0,parseFloat(document.getElementById('uHrsAbs').value)||0);
  const err=document.getElementById('uErr');
  err.classList.remove('show');
  if (!first||!last) { err.textContent='Please enter first and last name.'; err.classList.add('show'); return; }
  if (!email||!email.includes('@')) { err.textContent='Please enter a valid email address.'; err.classList.add('show'); return; }
  if (!/^[^\s@]+@rcc\.edu\.ph$/i.test(email)) { err.textContent='Only @rcc.edu.ph school emails can be registered.'; err.classList.add('show'); return; }
  if (!editingUserId&&!pass) { err.textContent='Please set an initial password.'; err.classList.add('show'); return; }
  if (!hidePay && (!salary||salary<=0)) { err.textContent='Please enter a valid monthly basic salary (required for all personnel — benefits basis).'; err.classList.add('show'); return; }
  if (!hidePay && classification==='Teaching' && (!hourlyRate||hourlyRate<=0)) { err.textContent='Teaching personnel require a valid hourly rate (pay = rate × hours worked).'; err.classList.add('show'); return; }
  // Date of hire is REQUIRED — the RA 8515 proration (and thus 13th Month Pay
  // eligibility) depends on it. It also cannot be in the future.
  if (!hireDate) { err.textContent='Please set the date of hire (required for 13th Month Pay proration).'; err.classList.add('show'); return; }
  {
    const today = new Date(); today.setHours(0,0,0,0);
    const hd = new Date(hireDate + 'T00:00:00');
    if (isNaN(hd)) { err.textContent='Please enter a valid date of hire.'; err.classList.add('show'); return; }
    if (hd > today) { err.textContent='Date of hire cannot be in the future.'; err.classList.add('show'); return; }
  }
  const dup = users.find(u=>u.email.toLowerCase()===email.toLowerCase()&&u.id!==editingUserId);
  if (dup) { err.textContent='This email is already in use.'; err.classList.add('show'); return; }
  if (editingUserId) {
    const u=users.find(x=>x.id===editingUserId);
    u.first=first; u.last=last; u.email=email; u.role=role; u.status=status; u.salary=salary;
    u.classification=classification; u.department=department; u.hourlyRate=hourlyRate; u.hireDate=hireDate;
    u.schoolLevel=schoolLevel; u.rankId=rankId; u.rankName=rankName; u.rateCustom=rateCustom;
    if (classification==='Teaching' && schoolLevel !== 'Elementary') u.hoursWorked=hrsAbs; else u.absenceDays=hrsAbs;
    ensureAuth(u, pass);
    showToast('✅',`${first} ${last} updated successfully.`);
  } else {
    const today=new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    const nu={id:nextUserId++,first,last,email,role,status,date:today,salary,classification,department,hireDate};
    if (classification==='Teaching' && schoolLevel !== 'Elementary') nu.hourlyRate=hourlyRate, nu.hoursWorked=hrsAbs; else nu.absenceDays=hrsAbs;
    nu.schoolLevel=schoolLevel; nu.rankId=rankId; nu.rankName=rankName; nu.rateCustom=rateCustom;
    users.push(nu);
    ensureAuth(nu, pass);
    showToast('✅',`${first} ${last} added successfully.`);
  }
  closeModal('userModal');
  if (!await saveDemo()) return;
  renderUserTable(); renderAdminRecentUsers(); updateAdminStats();
}
let viewCurrentUserId = null;   // user id shown in the User Profile (view) modal
function viewUser(id) {
  const u=users.find(x=>x.id===id); if(!u) return;
  viewCurrentUserId = id;
  document.getElementById('viewUserBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
      <div style="width:56px;height:56px;border-radius:50%;background:${roleColor[u.role]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700">${userPhotoMarkup(u)}</div>
      <div><div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--maroon-dark)">${esc(displayName(u))}</div><div style="font-size:12px;color:var(--text-muted)">#USR-00${u.id} &nbsp;·&nbsp; Added ${u.date}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${infoBox('✉️ Email',esc(u.email))}${infoBox('🏷️ Role',`<span class="badge ${roleBadge[u.role]}">${u.role}</span>`)}
      ${infoBox('⚡ Status',`<span class="badge ${u.status==='Active'?'b-green':'b-gray'}">${u.status==='Active'?'● Active':'● Inactive'}</span>`)}${infoBox('📅 Date Added',u.date)}
      ${infoBox('🎓 Classification',`<span class="badge ${EMP_CLASS[u.classification]?.badge||'b-gray'}">${u.classification||'Non-Teaching'}</span>`)}      ${infoBox('🏢 Department',esc(u.department||'—'))}
      ${u.classification==='Teaching' && u.rankName ? infoBox('🎓 Academic Rank', esc(u.rankName)) : ''}
      ${u.classification==='Teaching' ? infoBox('🏫 School Level', esc(u.schoolLevel || '—')) : ''}
      ${!isAdminUserManagement() ? infoBox('💰 Monthly Base',`<strong>₱${(u.salary||0).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2})}</strong>`) : ''}${infoBox('🆔 Employee ID',`#USR-00${u.id}`)}
      ${!isAdminUserManagement() && u.classification==='Teaching' ? infoBox('⏱ Hourly Rate', '₱'+(u.hourlyRate||0).toFixed(2)) : ''}${infoBox('📅 Date Hired', u.hireDate||'—')}${infoBox(u.classification==='Teaching'?'🕒 Hours Worked':'🚫 Absence Days', u.classification==='Teaching' ? (u.hoursWorked||0)+' hrs' : (u.absenceDays||0)+' days')}
    </div>`;
  // edit removed
  document.getElementById('viewUserModal').classList.add('show');
}
function infoBox(label,value){return`<div style="background:var(--bg);border-radius:8px;padding:12px 14px"><div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${label}</div><div style="font-size:13px;font-weight:600;color:var(--text)">${value}</div></div>`;}
function confirmDeactivate(id) {
  const u=users.find(x=>x.id===id); if(!u) return;
  document.getElementById('confirmIcon').textContent='⚠️';
  document.getElementById('confirmMsg').innerHTML=`Are you sure you want to deactivate <strong>${esc(u.first+' '+u.last)}</strong>? Their access will be suspended.`;
  document.getElementById('confirmActionBtn').textContent='Deactivate';
  document.getElementById('confirmActionBtn').onclick=()=>{ u.status='Inactive'; ensureAuth(u); saveDemo(); closeModal('confirmModal'); renderUserTable(); renderAdminRecentUsers(); showToast('⏸',`${u.first} ${u.last} deactivated.`); };
  document.getElementById('confirmModal').classList.add('show');
}
function reactivateUser(id) {
  const u=users.find(x=>x.id===id); if(!u) return;
  u.status='Active'; ensureAuth(u); saveDemo(); renderUserTable(); renderAdminRecentUsers();
  showToast('✅',`${u.first} ${u.last} reactivated.`);
}

// Pure guard logic (testable): why can't this user be removed? null = allowed.
function removalBlockReason(id) {
  const u = users.find(x=>x.id===id);
  if (!u) return 'User not found.';
  if (typeof loggedInUser !== 'undefined' && loggedInUser && u.id === loggedInUser.id)
    return 'You cannot remove the account you are currently logged into.';
  if (u.role === 'System Admin' && users.filter(x=>x.role==='System Admin' && x.id!==id).length === 0)
    return 'Cannot remove the last System Admin. Deactivate the account instead, or promote another admin first.';
  return null;
}

function confirmRemove(id) {
  const u=users.find(x=>x.id===id); if(!u) return;
  const block = removalBlockReason(id);
  if (block) { showToast('🛡️', block); return; }
  // Update title based on role
  const titles = {
    'Employee': 'Remove Employee',
    'Finance Officer': 'Remove Finance Officer',
    'System Admin': 'Remove System Admin'
  };
  const recCount = payrollRecords.filter(r=>r.empId===id).length;
  document.getElementById('removeTitle').textContent = titles[u.role] || 'Remove User';
  document.getElementById('removeUserName').textContent = `${u.first} ${u.last} (#USR-00${u.id})`;
  document.getElementById('removeMsg').innerHTML =
    `⚠️ This will permanently delete the account and cannot be undone. Consider Deactivating instead.` +
    (recCount ? `<br><br>📁 Their <strong>${recCount}</strong> released payslip${recCount>1?'s':''} will be <strong>kept</strong> for audit purposes.` : '');
  document.getElementById('removeConfirmBtn').onclick = () => {
    users = users.filter(x=>x.id!==id);
    removeAuth(id);
    delete cashAdvances[id];
    Object.keys(bonusPayouts).forEach(k => { if (k.startsWith(id + '_')) delete bonusPayouts[k]; });
    saveDemo();
    closeModal('removeModal');
    renderUserTable();
    renderAdminRecentUsers();
    updateAdminStats();
    showToast('🗑️',`${u.first} ${u.last} has been permanently removed.`);
  };
  document.getElementById('removeModal').classList.add('show');
}

// ── HRIS SYNC ─────────────────────────────────────────────────
async function syncFromHris() {
  const btn = document.getElementById('hrisSyncBtn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Syncing...'; }
  try {
    const response = await fetch('/api/hris/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(getAuthToken() || '')},body:JSON.stringify({stateRevision:serverStateRevision})});
    const result = await response.json();
    if (!response.ok) { if(response.status===409)await syncDemo(); throw new Error(result.error || 'HRIS sync failed.'); }
    localStorage.setItem(DEMO_KEY,JSON.stringify(result.state));
    applyServerData(result.state);
    renderUserTable();renderAdminRecentUsers();updateAdminStats();renderLeaveTypes();renderAttendance();
    const counts=result.counts;
    showToast('✅','HRIS sync: '+counts.added+' accounts added, '+counts.updated+' updated, '+counts.leaves+' leaves, '+counts.attendance+' attendance records.'+(counts.skipped?' '+counts.skipped+' unmatched or incomplete accounts skipped.':''));
  } catch(error) { showToast('⚠️',error.message || 'HRIS sync failed. Please try again.'); }
  finally { if(btn){btn.disabled=false;btn.textContent='🔄 Sync from HRIS';} }
}

// ── DEDUCTION MODAL ───────────────────────────────────────────
// ── DEDUCTION TABLE DATA (editable) ──────────────────────────
// Brackets use a structured {min, max} model so they can be added, removed,
// and edited from the UI. A row matches when salary >= min and salary < max;
// max = null means "and above" (open-ended top bracket).
let sssTable = (() => {
  const rows = [{min:0, max:5250, emp:250, er:500}];
  for (let min = 5250, emp = 275; min < 34750; min += 500, emp += 25) {
    rows.push({min, max:min + 500, emp, er:emp * 2});
  }
  rows.push({min:34750, max:null, emp:1750, er:3500});
  return rows;
})();
let philData = { rate:5.00, min:500.00, max:5000.00, floor:10000, ceiling:100000 };
let pagData  = { rate1:1, rate2:2, empMax:100.00, erMax:100.00 };
// Tracks when deduction tables were last saved so every view can show a live
// "Last updated" stamp instead of a hardcoded verification date.
let dedMeta  = (_savedDemo && _savedDemo.dedMeta) || {};
let birData  = [
  {min:0,       max:250000,  base:0,       rate:0},
  {min:250000,  max:400000,  base:0,       rate:15},
  {min:400000,  max:800000,  base:22500,   rate:20},
  {min:800000,  max:2000000, base:102500,  rate:25},
  {min:2000000, max:8000000, base:402500,  rate:30},
  {min:8000000, max:null,    base:2202500, rate:35},
];

const numOnly = v => parseFloat(String(v).replace(/[^\d.]/g, '')) || 0;
const pesoP0  = v => '₱' + Math.round(parseFloat(v) || 0).toLocaleString('en-PH');
function openMax(r) { return r.max === null || r.max === undefined || r.max === ''; }

// Display label regenerated from the structured bracket so UI text always
// matches the numbers the payroll engine actually uses.
function sssRangeLabel(r) {
  const min = parseFloat(r.min) || 0, max = openMax(r) ? null : parseFloat(r.max);
  if (min <= 0 && max) return 'Below ' + pesoP0(max);
  if (!max) return pesoP0(min) + ' and above';
  return pesoP0(min) + ' – ' + pesoP0(max - 1);
}
function birRangeLabel(r) {
  const min = parseFloat(r.min) || 0, max = openMax(r) ? null : parseFloat(r.max);
  if (min <= 0) return 'Up to ' + pesoP0(max);
  if (!max) return 'Over ' + pesoP0(min);
  return 'Over ' + pesoP0(min) + ' – ' + pesoP0(max);
}

// Migrates legacy string-based bracket tables ("Below ₱X", "₱A – ₱B",
// "Over ₱A – ₱B", "Above ₱X") saved by older versions into the structured
// {min, max} model. Already-structured rows pass through untouched.
// SSS dash brackets are inclusive on both ends in their labels
// ("₱5,250 – ₱5,749"), so the stored upper bound is B+1 (exclusive).
function migrateSssTable(t) {
  return (t || []).map(row => {
    if (row.min !== undefined && row.max !== undefined) return Object.assign({}, row);
    const r = row.range || '';
    if (r.indexOf('Below') === 0) return Object.assign({}, row, {min:0, max:numOnly(r)});
    const parts = r.split('–');
    if (parts.length > 1 && numOnly(parts[1]) > 0) return Object.assign({}, row, {min:numOnly(parts[0]), max:numOnly(parts[1]) + 1});
    return Object.assign({}, row, {min:numOnly(r), max:null});
  });
}
// BIR phrasing is "(A, B]": "Up to X" → [0, X]; "Over A – B" → (A, B];
// legacy "₱A+1 – ₱B" ranges normalize their lower bound to A.
function migrateBirTable(t) {
  return (t || []).map(row => {
    if (row.min !== undefined && row.max !== undefined) return Object.assign({}, row);
    const r = row.range || '';
    if (r.indexOf('Up to') === 0) return Object.assign({}, row, {min:0, max:numOnly(r)});
    const parts = r.split('–');
    if (parts.length > 1) {
      let lo = numOnly(parts[0]);
      if (r.indexOf('Over') !== 0) lo = Math.max(0, lo - 1);
      return Object.assign({}, row, {min:lo, max:numOnly(parts[1])});
    }
    return Object.assign({}, row, {min:numOnly(r), max:null});
  });
}
// Restore government tables edited by the Finance Officer so they persist
// across sessions and keep the system compliant with the latest regulations.
if (_savedDemo && Array.isArray(_savedDemo.sssTable) && _savedDemo.sssTable.length) sssTable = migrateSssTable(_savedDemo.sssTable);
if (_savedDemo && _savedDemo.philData) philData = Object.assign({}, philData, _savedDemo.philData);
if (_savedDemo && _savedDemo.pagData)  pagData  = Object.assign({}, pagData,  _savedDemo.pagData);
if (_savedDemo && Array.isArray(_savedDemo.birData) && _savedDemo.birData.length) birData = migrateBirTable(_savedDemo.birData);

function openDedModal(type) {
  const titles = {
    SSS:'Edit SSS Contribution Table',
    PhilHealth:'Edit PhilHealth Premium Rates',
    PagIBIG:'Edit Pag-IBIG Contribution Rates',
    BIR:'Edit BIR Withholding Tax Table'
  };
  document.getElementById('dedModalTitle').textContent = titles[type];
  document.getElementById('dedModal').dataset.type = type;

  let html = '';

  if (type === 'SSS') {
    html = `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        Update SSS contribution amounts for each salary bracket. Changes apply to all future payroll computations.
        <strong style="color:var(--maroon-dark)"> Republic Act No. 11199 — Rate: 15% of MSC.</strong>
      </p>
      <div style="max-height:420px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--maroon-dark);color:#fff;position:sticky;top:0">
              <th style="padding:10px 12px;text-align:left">#</th>
              <th style="padding:10px 12px;text-align:left">MSC From (₱)</th>
              <th style="padding:10px 12px;text-align:left">MSC Up To (₱)</th>
              <th style="padding:10px 12px;text-align:left">Employee Share (₱)</th>
              <th style="padding:10px 12px;text-align:left">Employer Share (₱)</th>
              <th style="padding:10px 12px;text-align:left">Total</th>
              <th style="padding:10px 12px"></th>
            </tr>
          </thead>
          <tbody id="sssEditBody"></tbody>
        </table>
      </div>
      <div style="margin-top:12px;display:flex;gap:12px;align-items:center">
        <button class="btn btn-outline btn-sm" onclick="addSssBracket()">+ Add Bracket</button>
        <span style="font-size:11px;color:var(--text-muted)">Leave "Up To" blank for the top (and above) bracket. Rows are sorted by "From" on save.</span>
      </div>`;
  }

  else if (type === 'PhilHealth') {
    html = `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        Update PhilHealth premium rate and contribution limits. <strong style="color:var(--maroon-dark)">Republic Act No. 11223 — UHC Act.</strong>
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div>
          <label class="fl">Total Premium Rate (%)</label>
          <input class="fi" id="ph-rate" type="number" step="0.5" min="1" max="10" value="${philData.rate.toFixed(2)}"
            oninput="philData.rate=parseFloat(this.value)||5"/>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Split equally — employee & employer each pay half</div>
        </div>
        <div style="background:var(--gold-pale);border:1px solid var(--gold);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--text-muted)">Employee / Employer Share</div>
          <div style="font-size:22px;font-weight:700;color:var(--maroon-dark)" id="ph-split-display">${(philData.rate/2).toFixed(2)}% each</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="fl">Minimum Monthly Contribution (₱)</label>
          <input class="fi" id="ph-min" type="number" step="50" value="${philData.min.toFixed(2)}"
            oninput="philData.min=parseFloat(this.value)||500"/>
        </div>
        <div>
          <label class="fl">Maximum Monthly Contribution (₱)</label>
          <input class="fi" id="ph-max" type="number" step="100" value="${philData.max.toFixed(2)}"
            oninput="philData.max=parseFloat(this.value)||5000"/>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
        <div>
          <label class="fl">Salary Floor — Min Base (₱)</label>
          <input class="fi" id="ph-floor" type="number" step="1000" value="${(philData.floor||0).toFixed(2)}"
            oninput="philData.floor=parseFloat(this.value)||10000"/>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Salaries below this are computed at the floor</div>
        </div>
        <div>
          <label class="fl">Salary Ceiling — Max Base (₱)</label>
          <input class="fi" id="ph-ceiling" type="number" step="10000" value="${(philData.ceiling||0).toFixed(2)}"
            oninput="philData.ceiling=parseFloat(this.value)||100000"/>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Salaries above this are computed at the ceiling</div>
        </div>
      </div>
      <div style="margin-top:16px;background:#EFF8FF;border:1px solid #B3D9FF;border-radius:10px;padding:12px 16px;font-size:12px;color:#1A4A7A">
        ℹ️ <strong>Formula reminder:</strong> Monthly Contribution = Basic Salary × Rate% ÷ 2 (employee share only)
      </div>`;
  }

  else if (type === 'PagIBIG') {
    html = `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        Update Pag-IBIG Fund contribution rates and maximum amounts. <strong style="color:var(--maroon-dark)">Republic Act No. 9679 — HDMF Law.</strong>
      </p>
      <div style="overflow-x:auto;margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--maroon-dark);color:#fff">
              <th style="padding:10px 12px">Monthly Compensation</th>
              <th style="padding:10px 12px">Employee Rate (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:#F9F7F4">
              <td style="padding:8px 12px;font-weight:600">₱1,500 and below</td>
              <td style="padding:4px 8px;text-align:center">
                <input type="number" step="0.5" min="0.5" max="5" value="${pagData.rate1}"
                  style="width:80px;padding:6px 10px;border:1px solid #DDD;border-radius:6px;font-size:13px;text-align:center"
                  oninput="pagData.rate1=parseFloat(this.value)||1"/>
              </td>
            </tr>
            <tr style="background:#fff">
              <td style="padding:8px 12px;font-weight:600">Above ₱1,500</td>
              <td style="padding:4px 8px;text-align:center">
                <input type="number" step="0.5" min="0.5" max="5" value="${pagData.rate2}"
                  style="width:80px;padding:6px 10px;border:1px solid #DDD;border-radius:6px;font-size:13px;text-align:center"
                  oninput="pagData.rate2=parseFloat(this.value)||2"/>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="margin-bottom:16px;background:#EFF8FF;border:1px solid #B3D9FF;border-radius:10px;padding:12px 16px;font-size:12px;color:#1A4A7A">
        ℹ️ The employer share mirrors the employee rate per RA 9679 and is shouldered by the school — it is not deducted from payroll.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label class="fl">Max Employee Contribution (₱/month)</label>
          <input class="fi" id="pag-emp-max" type="number" step="10" value="${pagData.empMax.toFixed(2)}"
            oninput="pagData.empMax=parseFloat(this.value)||100"/>
        </div>
        <div>
          <label class="fl">Max Employer Contribution (₱/month)</label>
          <input class="fi" id="pag-er-max" type="number" step="10" value="${pagData.erMax.toFixed(2)}"
            oninput="pagData.erMax=parseFloat(this.value)||100"/>
        </div>
      </div>`;
  }

  else if (type === 'BIR') {
    html = `
      <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
        Update BIR TRAIN Law annual income tax brackets. <strong style="color:var(--maroon-dark)">Republic Act No. 10963.</strong>
        Only update when the BIR issues new official tax tables.
      </p>
      <div style="max-height:420px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--maroon-dark);color:#fff;position:sticky;top:0">
              <th style="padding:10px 12px">#</th>
              <th style="padding:10px 12px">Income Over (₱)</th>
              <th style="padding:10px 12px">Up To (₱)</th>
              <th style="padding:10px 12px">Base Tax (₱)</th>
              <th style="padding:10px 12px">Rate on Excess (%)</th>
              <th style="padding:10px 12px"></th>
            </tr>
          </thead>
          <tbody id="birEditBody"></tbody>
        </table>
      </div>
      <div style="margin-top:12px;display:flex;gap:12px;align-items:center">
        <button class="btn btn-outline btn-sm" onclick="addBirBracket()">+ Add Bracket</button>
        <span style="font-size:11px;color:var(--text-muted)">Leave "Up To" blank for the top bracket. Rows are sorted by "Over" on save.</span>
      </div>
      <div style="margin-top:12px;background:#FFF8E1;border:1px solid #FFD54F;border-radius:10px;padding:12px 16px;font-size:12px;color:#6D4C00">
        ⚠️ <strong>Important:</strong> BIR tax tables are mandated by law. Only update when the BIR officially issues a new TRAIN Law amendment or Revenue Regulation.
      </div>`;
  }

  document.getElementById('dedModalBody').innerHTML = html;
  if (type === 'SSS') renderSssEditRows();
  if (type === 'BIR') renderBirEditRows();
  document.getElementById('dedModal').classList.add('show');
}

// ── SSS / BIR BRACKET EDITING ────────────────────────────────
const dedInp = 'width:95px;padding:6px 8px;border:1px solid #DDD;border-radius:6px;font-size:13px';

function renderSssEditRows() {
  const tb = document.getElementById('sssEditBody');
  if (!tb) return;
  tb.innerHTML = sssTable.map((row, i) => `
    <tr style="background:${i%2===0?'#F9F7F4':'#fff'}">
      <td style="padding:6px 10px;color:var(--text-muted)">${i+1}</td>
      <td style="padding:4px 6px"><input type="number" step="1" min="0" value="${Math.round(parseFloat(row.min)||0)}"
        style="${dedInp}" oninput="updateSssBracket(${i},'min',this.value)"/></td>
      <td style="padding:4px 6px">${openMax(row)
        ? '<span style="color:var(--text-muted);font-size:12px;padding:0 4px">and above</span>'
        : '<input type="number" step="1" min="0" value="' + Math.round(parseFloat(row.max)) + '" style="' + dedInp + '" oninput="updateSssBracket(' + i + ',\'max\',this.value)"/>'}</td>
      <td style="padding:4px 6px"><input type="number" step="0.01" value="${(parseFloat(row.emp)||0).toFixed(2)}"
        style="${dedInp}" oninput="updateSssBracket(${i},'emp',this.value)"/></td>
      <td style="padding:4px 6px"><input type="number" step="0.01" value="${(parseFloat(row.er)||0).toFixed(2)}"
        style="${dedInp}" oninput="updateSssBracket(${i},'er',this.value)"/></td>
      <td style="padding:6px 10px;font-weight:600" id="sss-total-${i}">₱${((parseFloat(row.emp)||0)+(parseFloat(row.er)||0)).toFixed(2)}</td>
      <td style="padding:4px 6px;text-align:center"><button class="btn btn-outline btn-sm" title="Remove bracket"
        style="color:#C62828;border-color:#FFCDD2;padding:4px 8px" onclick="removeSssBracket(${i})">✕</button></td>
    </tr>`).join('');
}
function updateSssBracket(i, field, val) {
  if (!sssTable[i]) return;
  sssTable[i][field] = (field === 'min' || field === 'max')
    ? (val === '' ? null : parseFloat(val) || 0)
    : parseFloat(val) || 0;
  if (field === 'max' && val === '') sssTable[i].max = null;
  const total = (parseFloat(sssTable[i].emp)||0) + (parseFloat(sssTable[i].er)||0);
  const el = document.getElementById('sss-total-'+i);
  if (el) el.textContent = '₱' + total.toFixed(2);
}
function addSssBracket() {
  const last = sssTable[sssTable.length - 1];
  const insertAt = sssTable.length - (last && openMax(last) ? 1 : 0);
  const prev = sssTable[insertAt - 1];
  const start = prev ? (openMax(prev) ? (parseFloat(prev.min)||0) + 500 : (parseFloat(prev.max)||0)) : 0;
  sssTable.splice(insertAt, 0, {min:start, max:start + 500, emp:0, er:0});
  renderSssEditRows();
}
function removeSssBracket(i) {
  if (sssTable.length <= 1) { showToast('⚠️','At least one bracket is required.'); return; }
  sssTable.splice(i, 1);
  renderSssEditRows();
}

function renderBirEditRows() {
  const tb = document.getElementById('birEditBody');
  if (!tb) return;
  tb.innerHTML = birData.map((row, i) => `
    <tr style="background:${i%2===0?'#F9F7F4':'#fff'}">
      <td style="padding:6px 10px;color:var(--text-muted)">${i+1}</td>
      <td style="padding:4px 6px"><input type="number" step="1" min="0" value="${Math.round(parseFloat(row.min)||0)}"
        style="${dedInp}" oninput="updateBirBracket(${i},'min',this.value)"/></td>
      <td style="padding:4px 6px">${openMax(row)
        ? '<span style="color:var(--text-muted);font-size:12px;padding:0 4px">and above</span>'
        : '<input type="number" step="1" min="0" value="' + Math.round(parseFloat(row.max)) + '" style="' + dedInp + '" oninput="updateBirBracket(' + i + ',\'max\',this.value)"/>'}</td>
      <td style="padding:4px 6px"><input type="number" step="0.01" value="${(parseFloat(row.base)||0).toFixed(2)}"
        style="${dedInp}" oninput="updateBirBracket(${i},'base',this.value)"/></td>
      <td style="padding:4px 6px"><input type="number" step="1" min="0" max="100" value="${parseFloat(row.rate)||0}"
        style="${dedInp};text-align:center" oninput="updateBirBracket(${i},'rate',this.value)"/></td>
      <td style="padding:4px 6px;text-align:center"><button class="btn btn-outline btn-sm" title="Remove bracket"
        style="color:#C62828;border-color:#FFCDD2;padding:4px 8px" onclick="removeBirBracket(${i})">✕</button></td>
    </tr>`).join('');
}
function updateBirBracket(i, field, val) {
  if (!birData[i]) return;
  birData[i][field] = (field === 'min' || field === 'max')
    ? (val === '' ? null : parseFloat(val) || 0)
    : parseFloat(val) || 0;
  if (field === 'max' && val === '') birData[i].max = null;
}
function addBirBracket() {
  const last = birData[birData.length - 1];
  const insertAt = birData.length - (last && openMax(last) ? 1 : 0);
  const prev = birData[insertAt - 1];
  const start = prev ? (openMax(prev) ? (parseFloat(prev.min)||0) + 100000 : (parseFloat(prev.max)||0)) : 0;
  birData.splice(insertAt, 0, {min:start, max:start + 150000, base:0, rate:0});
  renderBirEditRows();
}
function removeBirBracket(i) {
  if (birData.length <= 1) { showToast('⚠️','At least one bracket is required.'); return; }
  birData.splice(i, 1);
  renderBirEditRows();
}

// Sorts brackets by their lower bound and heals boundary gaps/overlaps: each
// non-final row's upper bound snaps to the next row's lower bound so salary
// matching stays continuous, and the final row is always open-ended.
// Returns an error message or null when the table is usable.
function normalizeBrackets(t) {
  t.sort((a, b) => (parseFloat(a.min)||0) - (parseFloat(b.min)||0));
  for (let i = 0; i < t.length - 1; i++) {
    const row = t[i], nextMin = parseFloat(t[i+1].min)||0;
    if (nextMin <= (parseFloat(row.min)||0)) return 'Each bracket needs its own unique "From" value (rows sort by "From").';
    row.max = nextMin;
  }
  if (t.length) t[t.length-1].max = null;
  return null;
}

function showDedPage(type) {
  document.getElementById('finDeduction').style.display = 'none';
  const pages = ['finDedSSS','finDedPhilHealth','finDedPagIBIG','finDedBIR'];
  pages.forEach(p => document.getElementById(p).style.display = 'none');
  const map = { SSS:'finDedSSS', PhilHealth:'finDedPhilHealth', PagIBIG:'finDedPagIBIG', BIR:'finDedBIR' };
  const page = document.getElementById(map[type]);
  if (page) {
    page.style.display = 'block';
    if (type === 'SSS') renderSSSTable();
    if (type === 'PhilHealth') renderPhilHealthDisplay();
    if (type === 'PagIBIG') renderPagIBIGDisplay();
    if (type === 'BIR') renderBIRTable();
  }
}

function showDedMain() {
  const pages = ['finDedSSS','finDedPhilHealth','finDedPagIBIG','finDedBIR'];
  pages.forEach(p => document.getElementById(p).style.display = 'none');
  document.getElementById('finDeduction').style.display = 'block';
}

function renderSSSTable() {
  const tbody = document.getElementById('sssTableBody');
  if (!tbody) return;
  tbody.innerHTML = sssTable.map((row, i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${sssRangeLabel(row)}</strong></td>
      <td>₱${(parseFloat(row.emp)||0).toFixed(2)}</td>
      <td>₱${(parseFloat(row.er)||0).toFixed(2)}</td>
      <td><strong>₱${((parseFloat(row.emp)||0)+(parseFloat(row.er)||0)).toFixed(2)}</strong></td>
    </tr>`).join('');
}

function peso2(v) { return '₱' + (parseFloat(v)||0).toLocaleString('en-PH',{minimumFractionDigits:2}); }

function renderPhilHealthDisplay() {
  const r = document.getElementById('philRateDisplay');
  const e = document.getElementById('philEmpDisplay');
  const er = document.getElementById('philErDisplay');
  const mn = document.getElementById('philMinDisplay');
  const mx = document.getElementById('philMaxDisplay');
  const fl = document.getElementById('philFloorDisplay');
  const ce = document.getElementById('philCeilDisplay');
  const fo = document.getElementById('philFormulaText');
  if (r) r.textContent = philData.rate.toFixed(2) + '%';
  if (e) e.textContent = (philData.rate/2).toFixed(2) + '%';
  if (er) er.textContent = (philData.rate/2).toFixed(2) + '%';
  if (mn) mn.textContent = peso2(philData.min);
  if (mx) mx.textContent = peso2(philData.max);
  if (fl) fl.textContent = peso2(philData.floor || 0);
  if (ce) ce.textContent = peso2(philData.ceiling || 0);
  if (fo) fo.innerHTML = '<strong>Formula:</strong> Basic Monthly Salary × ' + philData.rate.toFixed(2) + '% ÷ 2 = Employee Share';
  renderPhilExamples();
}

// Recomputes the "Computation Example" table from the live philData so the
// samples always match what the payroll engine actually deducts.
function renderPhilExamples() {
  const tb = document.getElementById('philExampleBody');
  if (!tb) return;
  const floor = philData.floor || 0;
  const ceiling = philData.ceiling || Infinity;
  tb.innerHTML = [10000,20000,28500,50000,100000].map(s => {
    const share = philMonthlyTotal(s) / 2;
    let tag = '';
    if (s <= floor) tag = ' <span style="font-size:11px;color:var(--text-muted)">(min)</span>';
    else if (s >= ceiling) tag = ' <span style="font-size:11px;color:var(--text-muted)">(max)</span>';
    return `<tr><td>${peso2(s)}</td><td>${peso2(share)}${tag}</td></tr>`;
  }).join('');
}

function renderPagIBIGDisplay() {
  const tbody = document.getElementById('pagTableBody');
  if (!tbody) return;
  const r1 = Math.min(1500 * pagData.rate1 / 100, parseFloat(pagData.empMax) || Infinity);
  tbody.innerHTML = `
    <tr><td>₱1,500 and below</td><td>${pagData.rate1}%</td><td>${peso2(r1)}</td></tr>
    <tr><td>Above ₱1,500</td><td><strong>${pagData.rate2}%</strong></td><td><strong>${peso2(pagData.empMax)}</strong></td></tr>`;
  const fe = document.getElementById('pagFootEmpMax'), fr = document.getElementById('pagFootErMax');
  if (fe) fe.textContent = peso2(pagData.empMax) + ' / month';
  if (fr) fr.textContent = peso2(pagData.erMax) + ' / month';
}

// System Admin "Deduction Tables" is a read-only mirror of the Finance tables.
// Rendered from the same live data so rate edits are visible everywhere.
function renderAdmDedTables() {
  const sssB = document.getElementById('admSSSBody');
  if (sssB) sssB.innerHTML = sssTable.map(r =>
    `<tr><td>${r.range}</td><td>₱${r.emp.toFixed(2)}</td><td>₱${r.er.toFixed(2)}</td></tr>`).join('');
  const pr = document.getElementById('admPhilRate');
  if (pr) pr.textContent = philData.rate.toFixed(2) + '%';
  const ps = document.getElementById('admPhilSplit');
  if (ps) ps.textContent = 'Split equally — ' + (philData.rate/2).toFixed(2) + '% employee, ' + (philData.rate/2).toFixed(2) + '% employer';
  const pg = document.getElementById('admPagBody');
  if (pg) pg.innerHTML = `
    <tr><td>₱1,500 and below</td><td>${pagData.rate1}%</td></tr>
    <tr><td>Above ₱1,500</td><td>${pagData.rate2}%</td></tr>`;
  const birB = document.getElementById('admBIRBody');
  if (birB) birB.innerHTML = birData.map(r => {
    const desc = (parseFloat(r.base) === 0 && parseFloat(r.rate) === 0)
      ? '<span class="badge b-green">0% — Exempt</span>'
      : (parseFloat(r.base) > 0 ? '₱' + r.base.toLocaleString('en-PH') + ' + ' : '') + r.rate + '% on excess';
    return `<tr><td>${r.range}</td><td>${desc}</td></tr>`;
  }).join('');
}

// Status banner stamp — falls back to the original verification note until the
// Finance Officer saves a rate change for the first time.
function renderDedBanner() {
  const el = document.getElementById('dedBannerSub');
  if (!el) return;
  let txt = 'SSS • PhilHealth • Pag-IBIG • BIR TRAIN Law — Last verified: May 2026';
  if (dedMeta && dedMeta.updatedAt) {
    const d = new Date(dedMeta.updatedAt);
    txt = 'SSS • PhilHealth • Pag-IBIG • BIR TRAIN Law — Last updated: ' +
      d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) + ', ' +
      d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  }
  el.textContent = txt;
}
function stampDedMeta() { dedMeta = Object.assign({}, dedMeta, { updatedAt: new Date().toISOString() }); }

// ── Payroll Basis — Working Days per Month (absence divisor) ──
function renderWorkDaysSetting() {
  const el = document.getElementById('workDaysInput');
  if (el) el.value = WORK_DAYS;
  const note = document.getElementById('workDaysFormula');
  if (note) note.textContent = WORK_DAYS;
}
async function saveWorkDays() {
  const el = document.getElementById('workDaysInput');
  if (!el) return;
  const v = Math.round(Number(el.value) * 100) / 100;
  if (!v || v < 1 || v > 31) {
    showToast('⚠️','Enter a whole number between 1 and 31.');
    renderWorkDaysSetting();
    return;
  }
  WORK_DAYS = v;
  stampDedMeta();
  if (!await saveDemo()) return;
  renderWorkDaysSetting();
  showToast('✅', `Working days per month set to ${WORK_DAYS}. Absence deductions will use ÷${WORK_DAYS}.`);
}

function renderBIRTable() {
  const tbody = document.getElementById('birTableBody');
  if (!tbody) return;
  tbody.innerHTML = birData.map((row, i) => {
    const min = parseFloat(row.min)||0;
    const excess = min > 0 ? '₱' + Math.round(min).toLocaleString('en-PH') : '—';
    const baseCell = i === 0 && (parseFloat(row.base)||0) === 0 && (parseFloat(row.rate)||0) === 0
      ? '<span class="badge b-green">₱0 — Exempt</span>'
      : '₱' + (parseFloat(row.base)||0).toLocaleString('en-PH', {minimumFractionDigits:2});
    return `<tr>
      <td>${i+1}</td>
      <td>${birRangeLabel(row)}</td>
      <td>${baseCell}</td>
      <td>${parseFloat(row.rate)||0}%</td>
      <td>${excess}</td>
    </tr>`;
  }).join('');
}

async function saveDedModal() {
  const type = document.getElementById('dedModal').dataset.type;

  if (type === 'SSS' || type === 'BIR') {
    const err = normalizeBrackets(type === 'SSS' ? sssTable : birData);
    if (err) { showToast('⚠️', err); return; }
  }
  if (type === 'PhilHealth') {
    const el = document.getElementById('philRate');
    if (el) el.textContent = philData.rate.toFixed(2) + '%';
  }

  closeModal('dedModal');
  stampDedMeta();
  if (!await saveDemo()) return;
  // Refresh the detail page display
  if (type === 'SSS') renderSSSTable();
  if (type === 'PhilHealth') renderPhilHealthDisplay();
  if (type === 'PagIBIG') renderPagIBIGDisplay();
  if (type === 'BIR') renderBIRTable();
  // Keep every other view (banner, admin mirror) in sync with the new rates
  renderDedBanner();
  renderAdmDedTables();
  showToast('✅', `${type} rates updated successfully! Changes will apply to the next payroll cycle.`);
}
