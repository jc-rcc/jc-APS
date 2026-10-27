// ── TEACHER RANKS MODULE ──────────────────────────────────────
// Faculty pay rate, organized by department (College / Elementary / High School / Graduate School).
// The rank table is the source of truth for teacher rates unless an employee
// has a custom rate override (rateCustom = true).
// Rate unit varies by department: per hour (College/Grad), per workload (High School), per month (Elementary).

const DEFAULT_RANKS = [
  { id: 1, department: 'College', rank: 'Assistant Instructor 1', rate: 150 },
  { id: 2, department: 'College', rank: 'Assistant Instructor 2', rate: 170 },
  { id: 3, department: 'College', rank: 'Instructor 1', rate: 190 },
  { id: 4, department: 'College', rank: 'Instructor 2', rate: 210 },
  { id: 5, department: 'College', rank: 'Instructor 3', rate: 230 },
  { id: 6, department: 'College', rank: 'Instructor 4', rate: 250 },
  { id: 7, department: 'College', rank: 'Assistant Professor 1', rate: 270 },
  { id: 8, department: 'College', rank: 'Assistant Professor 2', rate: 290 },
  { id: 9, department: 'College', rank: 'Assistant Professor 3', rate: 310 },
  { id: 10, department: 'College', rank: 'Associate Professor 1', rate: 330 },
  { id: 11, department: 'College', rank: 'Associate Professor 2', rate: 350 },
  { id: 12, department: 'College', rank: 'Associate Professor 3', rate: 370 },
  { id: 13, department: 'College', rank: 'Professor 1', rate: 390 },
  { id: 14, department: 'College', rank: 'Professor 2', rate: 420 },
  { id: 15, department: 'College', rank: 'Professor 3', rate: 450 },
  { id: 16, department: 'Elementary', rank: 'Provisional Teacher 1A (PT-1A)', rate: 8000 },
  { id: 17, department: 'Elementary', rank: 'Provisional Teacher 1B (PT-1B)', rate: 9000 },
  { id: 18, department: 'Elementary', rank: 'Teacher 1A (T-1A)', rate: 10000 },
  { id: 19, department: 'Elementary', rank: 'Teacher 1B (T-1B)', rate: 11000 },
  { id: 20, department: 'Elementary', rank: 'Teacher 2A (T-2A)', rate: 12000 },
  { id: 21, department: 'Elementary', rank: 'Teacher 2B (T-2B)', rate: 13000 },
  { id: 22, department: 'Elementary', rank: 'Teacher 3A (T-3A)', rate: 14000 },
  { id: 23, department: 'Elementary', rank: 'Teacher 3B (T-3B)', rate: 15000 },
  { id: 24, department: 'Elementary', rank: 'Master Teacher 1A (MT-1A)', rate: 16000 },
  { id: 25, department: 'Elementary', rank: 'Master Teacher 1B (MT-1B)', rate: 17000 },
  { id: 26, department: 'Elementary', rank: 'Master Teacher 2A (MT-2A)', rate: 18000 },
  { id: 27, department: 'Elementary', rank: 'Master Teacher 2B (MT-2B)', rate: 20000 },
  { id: 28, department: 'High School', rank: 'Provisional Teacher 1A (PT-1A)', rate: 500 },
  { id: 29, department: 'High School', rank: 'Provisional Teacher 1B (PT-1B)', rate: 600 },
  { id: 30, department: 'High School', rank: 'Teacher 1A (T-1A)', rate: 700 },
  { id: 31, department: 'High School', rank: 'Teacher 1B (T-1B)', rate: 800 },
  { id: 32, department: 'High School', rank: 'Teacher 2A (T-2A)', rate: 900 },
  { id: 33, department: 'High School', rank: 'Teacher 2B (T-2B)', rate: 1000 },
  { id: 34, department: 'High School', rank: 'Teacher 3A (T-3A)', rate: 1100 },
  { id: 35, department: 'High School', rank: 'Teacher 3B (T-3B)', rate: 1200 },
  { id: 36, department: 'High School', rank: 'Master Teacher 1A (MT-1A)', rate: 1300 },
  { id: 37, department: 'High School', rank: 'Master Teacher 1B (MT-1B)', rate: 1400 },
  { id: 38, department: 'High School', rank: 'Master Teacher 2A (MT-2A)', rate: 1500 },
  { id: 39, department: 'High School', rank: 'Master Teacher 2B (MT-2B)', rate: 1600 },
  { id: 40, department: 'Graduate School', rank: 'Assistant Instructor 1', rate: 150 },
  { id: 41, department: 'Graduate School', rank: 'Assistant Instructor 2', rate: 170 },
  { id: 42, department: 'Graduate School', rank: 'Instructor 1', rate: 190 },
  { id: 43, department: 'Graduate School', rank: 'Instructor 2', rate: 210 },
  { id: 44, department: 'Graduate School', rank: 'Instructor 3', rate: 230 },
  { id: 45, department: 'Graduate School', rank: 'Instructor 4', rate: 250 },
  { id: 46, department: 'Graduate School', rank: 'Assistant Professor 1', rate: 270 },
  { id: 47, department: 'Graduate School', rank: 'Assistant Professor 2', rate: 290 },
  { id: 48, department: 'Graduate School', rank: 'Assistant Professor 3', rate: 310 },
  { id: 49, department: 'Graduate School', rank: 'Associate Professor 1', rate: 330 },
  { id: 50, department: 'Graduate School', rank: 'Associate Professor 2', rate: 350 },
  { id: 51, department: 'Graduate School', rank: 'Associate Professor 3', rate: 370 },
  { id: 52, department: 'Graduate School', rank: 'Professor 1', rate: 390 },
  { id: 53, department: 'Graduate School', rank: 'Professor 2', rate: 420 },
  { id: 54, department: 'Graduate School', rank: 'Professor 3', rate: 450 }
];

let teacherRanks = (_savedDemo && Array.isArray(_savedDemo.teacherRanks) && _savedDemo.teacherRanks.length)
  ? _savedDemo.teacherRanks
  : DEFAULT_RANKS.map(r => ({ ...r }));

let nextRankId = (_savedDemo && _savedDemo.nextRankId) || 55;

// ── Rate resolution ───────────────────────────────────────────
// Returns the effective rate for a teaching employee.
// Rank table is the source of truth unless the employee has a custom override.
function teacherRate(emp) {
  if (!emp || emp.classification !== 'Teaching') return parseFloat(emp.hourlyRate) || 0;
  if (emp.rateCustom) return parseFloat(emp.hourlyRate) || 0;
  const rank = teacherRanks.find(r => r.id === emp.rankId);
  if (rank) return parseFloat(rank.rate) || 0;
  return parseFloat(emp.hourlyRate) || 0;
}

// Rate unit label per department (used in UI labels)
function rateUnit(dept) {
  if (dept === 'High School') return 'per Workload';
  if (dept === 'Elementary') return 'per Month';
  return 'per Hour';
}

function rankById(id) {
  return teacherRanks.find(r => r.id === id);
}

function ranksByDept(dept) {
  return teacherRanks.filter(r => r.department === dept);
}

// ── Rank select helper (for user modal) ───────────────────────
function fillRankSelect(schoolLevel, selectedId, selId) {
  const sel = document.getElementById(selId || 'uRank');
  if (!sel) return;
  const ranks = ranksByDept(schoolLevel);
  const unit = rateUnit(schoolLevel);
  sel.innerHTML = '<option value="0">— Select Rank —</option>' +
    ranks.map(r => `<option value="${r.id}">${esc(r.rank)} — ₱${(parseFloat(r.rate) || 0).toFixed(2)} ${unit}</option>`).join('');
  sel.value = String(selectedId || 0);
}

// ── Rank table page renderers ─────────────────────────────────
let currentRankDept = 'College';

function showRankTab(dept) {
  currentRankDept = dept;
  document.querySelectorAll('#finRanks .rank-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.dept === dept);
  });
  const hdr = document.getElementById('finRankRateHdr');
  if (hdr) hdr.textContent = 'Rate ' + rateUnit(dept);
  renderRankTable();
}

function renderRankTable() {
  const tbody = document.getElementById('rankTableBody');
  if (!tbody) return;
  const ranks = ranksByDept(currentRankDept);
  if (!ranks.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">No ranks configured for ' + esc(currentRankDept) + ' yet.</td></tr>';
    return;
  }
  tbody.innerHTML = ranks.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${esc(r.rank)}</strong></td>
      <td>₱${(parseFloat(r.rate) || 0).toFixed(2)}</td>
      <td><span class="badge b-blue">${esc(r.department)}</span></td>
    </tr>`).join('');
}

function renderAdmRankTable() {
  const tbody = document.getElementById('admRankTableBody');
  if (!tbody) return;
  if (!teacherRanks.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">No ranks configured yet.</td></tr>';
    return;
  }
  tbody.innerHTML = teacherRanks.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${esc(r.rank)}</strong></td>
      <td>₱${(parseFloat(r.rate) || 0).toFixed(2)}</td>
      <td><span class="badge b-blue">${esc(r.department)}</span></td>
    </tr>`).join('');
}

// ── Rank edit modal (CRUD) ────────────────────────────────────
function openRankEditModal() {
  const dept = currentRankDept;
  document.getElementById('rankModalTitle').textContent = 'Edit Faculty Ranks — ' + dept;
  renderRankEditRows();
  document.getElementById('rankModal').classList.add('show');
}

function renderRankEditRows() {
  const body = document.getElementById('rankModalBody');
  if (!body) return;
  const ranks = ranksByDept(currentRankDept);
  body.innerHTML = `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      Edit faculty ranks for <strong style="color:var(--maroon-dark)">${esc(currentRankDept)}</strong>.
      Changes apply to all future payroll computations.
    </p>
    <div style="max-height:420px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--maroon-dark);color:#fff;position:sticky;top:0">
            <th style="padding:10px 12px;text-align:left">Rank Name</th>
            <th style="padding:10px 12px;text-align:left">Rate per Unit (₱)</th>
            <th style="padding:10px 12px"></th>
          </tr>
        </thead>
        <tbody id="rankEditBody"></tbody>
      </table>
    </div>
    <div style="margin-top:12px;display:flex;gap:12px;align-items:center">
      <button class="btn btn-outline btn-sm" onclick="addRank()">+ Add Rank</button>
      <span style="font-size:11px;color:var(--text-muted)">Edit values inline, then click Save.</span>
    </div>`;
  const tbody = document.getElementById('rankEditBody');
  if (!tbody) return;
  if (!ranks.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-muted)">No ranks yet. Click "+ Add Rank" to create one.</td></tr>';
    return;
  }
  tbody.innerHTML = ranks.map(r => `
    <tr>
      <td><input class="fi" style="width:100%;padding:6px 8px" value="${esc(r.rank)}" onchange="updateRankField(${r.id}, 'rank', this.value)"/></td>
      <td><input class="fi" style="width:100%;padding:6px 8px" type="number" step="0.01" min="0" value="${r.rate}" onchange="updateRankField(${r.id}, 'rate', this.value)"/></td>
      <td><button class="btn btn-outline btn-sm" onclick="deleteRank(${r.id})">🗑</button></td>
    </tr>`).join('');
}

function updateRankField(id, field, value) {
  const r = rankById(id);
  if (!r) return;
  if (field === 'rate') r.rate = Math.max(0, parseFloat(value) || 0);
  else r[field] = value;
}

function addRank() {
  const dept = currentRankDept;
  const maxId = teacherRanks.reduce((m, r) => Math.max(m, r.id), 0);
  teacherRanks.push({ id: maxId + 1, department: dept, rank: 'New Rank', rate: 0 });
  nextRankId = Math.max(nextRankId, maxId + 2);
  renderRankEditRows();
}

function deleteRank(id) {
  const inUse = users.some(u => u.rankId === id);
  if (inUse) {
    const count = users.filter(u => u.rankId === id).length;
    showToast('⚠️', `Cannot delete: ${count} teacher(s) use this rank. Reassign them first.`);
    return;
  }
  teacherRanks = teacherRanks.filter(r => r.id !== id);
  renderRankEditRows();
  showToast('✅', 'Rank deleted.');
}

async function saveRankModal() {
  closeModal('rankModal');
  if (!await saveDemo()) return;
  renderRankTable();
  renderAdmRankTable();
  showToast('✅', 'Faculty ranks updated. Changes apply to the next payroll cycle.');
}
