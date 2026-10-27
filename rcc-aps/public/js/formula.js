// ── FORMULA MANAGEMENT (Finance) ─────────────────────────────
// Shows the payroll computation formulas per school level and lets
// Finance edit the global parameters that feed every computation:
//   - workDays          : absence divisor (÷ Work Days)
//   - hoursPerWorkload  : High School workload size (hrs per workload)
// Rates themselves are managed in Faculty Rank Tables.

function renderFormulaManagement() {
  const host = document.getElementById('finFormulaContent');
  if (!host) return;

  const WD = (typeof WORK_DAYS !== 'undefined' && WORK_DAYS) ? WORK_DAYS : 22;
  const HPW = (typeof HOURS_PER_WORKLOAD !== 'undefined' && HOURS_PER_WORKLOAD) ? HOURS_PER_WORKLOAD : 3;

  const card = (icon, title, unit, formula, sample, extra) =>
    '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-head" style="padding:14px 18px">' +
        '<div class="card-title">' + icon + ' ' + title + '</div>' +
        '<span class="badge b-blue">' + unit + '</span>' +
      '</div>' +
      '<div style="padding:14px 18px 16px">' +
        '<div style="font-family:monospace;font-size:13.5px;font-weight:700;color:var(--maroon-dark);margin-bottom:6px">' + formula + '</div>' +
        '<div style="font-size:12.5px;color:var(--text-muted)">Example: ' + sample + '</div>' +
        (extra ? '<div style="font-size:12px;color:var(--text-muted);margin-top:6px">' + extra + '</div>' : '') +
      '</div>' +
    '</div>';

  host.innerHTML =
    // ── Parameters card (editable) ──
    '<div class="card" style="margin-top:20px;border:2px solid var(--maroon)">' +
      '<div class="card-head" style="padding:14px 18px">' +
        '<div class="card-title">⚙️ Computation Parameters</div>' +
        '<div style="font-size:12px;color:var(--text-muted)">Feeds every payroll computation and teaching load estimate</div>' +
      '</div>' +
      '<div style="padding:16px 18px">' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px 20px">' +
          '<div class="fg">' +
            '<label class="fl">Work Days per Month (absence divisor)</label>' +
            '<input class="fi" id="fmWorkDays" type="number" min="1" max="31" step="1" value="' + WD + '"/>' +
            '<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">Used as: Absences ÷ ' + WD + ' × base pay</div>' +
          '</div>' +
          '<div class="fg">' +
            '<label class="fl">Hours per Workload (High School)</label>' +
            '<input class="fi" id="fmHpw" type="number" min="1" max="40" step="0.5" value="' + HPW + '"/>' +
            '<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">1 workload = ' + HPW + ' hrs (Teaching Load + Payroll)</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
          '<button class="btn btn-primary" onclick="saveFormulaParams()">💾 Save Parameters</button>' +
          '<button class="btn btn-outline" onclick="showFinPage(\'finRanks\',null)">🎓 Manage Rates in Faculty Rank Tables</button>' +
          '<button class="btn btn-outline" onclick="showFinPage(\'finDeduction\',null)">⚙️ Absence settings in Deduction Tables</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div style="font-size:14px;font-weight:700;margin:22px 0 10px;color:var(--maroon-dark)">Computation Formulas by Level</div>' +

    card('💼', 'Non-Teaching', 'Salary per Month',
      'Gross = Salary − (Absences ÷ Work Days) × Salary',
      fmt(18000) + ' − (3 ÷ ' + WD + ') × ' + fmt(18000) + ' = ' + fmt(18000 - (3 / WD) * 18000),
      'Salary comes from User Management.') +

    card('🏫', 'Elementary', 'Salary per Month',
      'Gross = Monthly Salary − (Absences ÷ Work Days) × Monthly Salary',
      fmt(14000) + ' − (2 ÷ ' + WD + ') × ' + fmt(14000) + ' = ' + fmt(14000 - (2 / WD) * 14000),
      'Monthly salary comes from Teaching Load (encoded by Finance) or User Management.') +

    card('📖', 'High School', 'Rate per Workload',
      'Gross = Rate per Workload × (Total Hours ÷ ' + HPW + ')',
      '92.4 hrs ÷ ' + HPW + ' = ' + (92.4 / HPW).toFixed(2) + ' wl × ' + fmt(500) + ' = ' + fmt((92.4 / HPW) * 500),
      '1 workload = ' + HPW + ' hrs · payroll hours = session hours × matching schedule dates in the selected payroll month. Teaching Load pay estimates use average weeks (Work Days ÷ 5).') +

    card('🎓', 'College', 'Rate per Hour',
      'Gross = Rate per Hour × Total Hours',
      '92.4 hrs × ' + fmt(190) + ' = ' + fmt(92.4 * 190),
      'Payroll hours = session hours × matching schedule dates in the selected payroll month. Teaching Load pay estimates use average weeks (Work Days ÷ 5).') +

    card('🎓', 'Graduate School', 'Rate per Hour',
      'Gross = Rate per Hour × Total Hours',
      '92.4 hrs × ' + fmt(230) + ' = ' + fmt(92.4 * 230),
      'Payroll hours = session hours × matching schedule dates in the selected payroll month. Teaching Load pay estimates use average weeks (Work Days ÷ 5).');
}

async function saveFormulaParams() {
  const wdEl = document.getElementById('fmWorkDays');
  const hpwEl = document.getElementById('fmHpw');
  const wd = Math.round(Number(wdEl ? wdEl.value : 0) * 100) / 100;
  const hpw = Math.round(Number(hpwEl ? hpwEl.value : 0) * 100) / 100;
  if (!wd || wd < 1 || wd > 31) {
    showToast('⚠️', 'Work Days must be between 1 and 31.');
    if (wdEl) wdEl.value = (typeof WORK_DAYS !== 'undefined') ? WORK_DAYS : 22;
    return;
  }
  if (!hpw || hpw < 1 || hpw > 40) {
    showToast('⚠️', 'Hours per Workload must be between 1 and 40.');
    if (hpwEl) hpwEl.value = (typeof HOURS_PER_WORKLOAD !== 'undefined') ? HOURS_PER_WORKLOAD : 3;
    return;
  }
  if (typeof WORK_DAYS !== 'undefined') WORK_DAYS = wd;
  if (typeof HOURS_PER_WORKLOAD !== 'undefined') HOURS_PER_WORKLOAD = hpw;
  if (typeof stampDedMeta === 'function') stampDedMeta();
  if (typeof saveDemo === 'function' && !await saveDemo()) return;
  renderFormulaManagement();
  showToast('✅', 'Parameters saved — Work Days = ' + wd + ', Hours per Workload = ' + hpw + '.');
}
