// ── GOVERNMENT CONTRIBUTION REPORT ────────────────────────────
const GOV_REPORT_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function onGovYearChange() {
  const yearEl  = document.getElementById('govYear');
  const monthEl = document.getElementById('govMonth');
  const year    = yearEl.value;
  monthEl.value    = '';
  monthEl.disabled = !year;
  monthEl.style.opacity = year ? '1' : '0.4';
  document.getElementById('govMonthLabel').style.color = year ? '#444' : '#BBB';
  document.getElementById('govReportOutput').style.display = 'none';
  if (!year) return;
  monthEl.innerHTML = `<option value="">— Select Month —</option>` +
    GOV_REPORT_MONTHS.map((m, i) => `<option value="${i+1}">${m}</option>`).join('');
}
function onGovMonthChange() {
  const year  = parseInt(document.getElementById('govYear').value);
  const month = parseInt(document.getElementById('govMonth').value);
  if (!year || !month) return;
  renderGovReport(month, year);
}
function renderGovReport(month, year) {
  const out = document.getElementById('govReportOutput');
  out.style.display = 'block';
  out.scrollIntoView({behavior:'smooth'});
  document.getElementById('govReportTitle').textContent = `Government Contribution Report — ${GOV_REPORT_MONTHS[month-1]} ${year}`;
  document.getElementById('govHead').innerHTML = `<tr>
    <th>EMPLOYEE</th><th>TYPE</th><th>GROSS</th><th>SSS</th><th>PHILHEALTH</th><th>PAG-IBIG</th><th>BIR</th><th>TOTAL REMITTANCE</th>
  </tr>`;
  const records = getPayrollRecords(month, year);
  const employees = users.filter(u=>u.salary>0 && u.status==='Active');
  const rows = records.filter(r => employees.some(u => u.id === r.empId));
  if (!rows.length) {
    document.getElementById('govBody').innerHTML = '';
    document.getElementById('govEmpty') && (document.getElementById('govEmpty').style.display = 'block');
    document.getElementById('govTotals').innerHTML = '';
    return;
  }
  if (document.getElementById('govEmpty')) document.getElementById('govEmpty').style.display = 'none';
  let tSSS=0, tPhil=0, tPag=0, tBIR=0, tGross=0;
  document.getElementById('govBody').innerHTML = rows.map(r=>{
    const emp = employees.find(u => u.id === r.empId);
    const birTotal = r.bir + (r.thirteenTax || 0);
    tGross+=r.gross; tSSS+=r.sss; tPhil+=r.phil; tPag+=r.pag; tBIR+=birTotal;
    return `<tr>
      <td><strong>${emp ? esc(displayName(emp)) : esc(r.name)}</strong></td>
      <td><span class="badge ${EMP_CLASS[emp?.classification]?.badge||'b-gray'}">${emp?.classification||'Non-Teaching'}</span></td>
      <td>${fmt(r.gross)}</td>
      <td>${fmt(r.sss)}</td>
      <td>${fmt(r.phil)}</td>
      <td>${fmt(r.pag)}</td>
      <td>${fmt(birTotal)}</td>
      <td><strong style="color:var(--maroon-dark)">${fmt(r.sss+r.phil+r.pag+birTotal)}</strong></td>
    </tr>`;
  }).join('');
  const grand = tSSS+tPhil+tPag+tBIR;
  document.getElementById('govTotals').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px;align-items:center">
      <span><strong>Employees:</strong> ${rows.length}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total SSS:</strong> ${fmt(tSSS)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total PhilHealth:</strong> ${fmt(tPhil)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total Pag-IBIG:</strong> ${fmt(tPag)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total BIR:</strong> ${fmt(tBIR)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total Govt Remittance: <span style="color:var(--maroon-dark)">${fmt(grand)}</span></strong></span>
    </div>`;
}

// ── ANALYTICS ─────────────────────────────────────────────────
const ANALYTIC_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function renderAnalytics() {
  const allRecords = payrollRecords || [];
  if (!allRecords.length) return;
  const employees = users.filter(u=>u.salary>0 && u.status==='Active');
  const teach = allRecords.filter(r=>{ const emp = employees.find(u=>u.id===r.empId); return emp && emp.classification==='Teaching'; });
  const nonT  = allRecords.filter(r=>{ const emp = employees.find(u=>u.id===r.empId); return emp && emp.classification!=='Teaching'; });
  const tGross = teach.reduce((s,r)=>s+(parseFloat(r.gross)||0),0);
  const nGross = nonT.reduce((s,r)=>s+(parseFloat(r.gross)||0),0);
  const total  = tGross + nGross;
  document.getElementById('anGross').textContent = fmt(total);
  const gov = {sss:0, phil:0, pag:0, bir:0};
  allRecords.forEach(r=>{ gov.sss+=parseFloat(r.sss)||0; gov.phil+=parseFloat(r.phil)||0; gov.pag+=parseFloat(r.pag)||0; gov.bir+=parseFloat(r.bir)||0; });
  document.getElementById('anGovDed').textContent = fmt(gov.sss+gov.phil+gov.pag+gov.bir);
  document.getElementById('anTeach').textContent = fmt(tGross);
  const tn = document.getElementById('anTeachNote'); if (tn) tn.textContent = total ? Math.round(tGross/total*100)+'% of total' : '0% of total';
  document.getElementById('anNonTeach').textContent = fmt(nGross);
  const nn = document.getElementById('anNonTeachNote'); if (nn) nn.textContent = total ? Math.round(nGross/total*100)+'% of total' : '0% of total';

  // Trend chart — REAL monthly gross payroll from confirmed records
  // (latest calendar year present in the data; no synthetic projections).
  const years = [...new Set(allRecords.map(r=>r.year))].sort((a,b)=>a-b);
  const trendYear = years.length ? years[years.length-1] : new Date().getFullYear();
  const monthlyTotals = Array(12).fill(0);
  allRecords.forEach(r=>{
    if (r.year !== trendYear) return;
    monthlyTotals[r.month-1] += (parseFloat(r.gross)||0) + (parseFloat(r.deMinimisSum)||0) + (parseFloat(r.thirteenth)||0);
  });
  const activeMonths = ANALYTIC_MONTHS.map((m,i)=>({ m, v: monthlyTotals[i] })).filter(x=>x.v>0);
  if (!activeMonths.length) {
    document.getElementById('trendChart').innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:40px 0;font-size:13px">No confirmed payroll yet for '+trendYear+' — the monthly trend appears here once payroll is released.</div>';
  } else {
    const maxV = Math.max(...activeMonths.map(x=>x.v));
    document.getElementById('trendChart').innerHTML = `
      <div style="text-align:right;font-size:11px;color:var(--text-muted);margin-bottom:4px">Calendar Year ${trendYear}</div>
      <div style="display:flex;align-items:flex-end;gap:18px;height:220px;padding:8px 4px 0">
        ${activeMonths.map(x=>`
          <div style="flex:1;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${fmt(x.v)}</div>
            <div style="width:100%;background:linear-gradient(180deg,var(--maroon),var(--maroon-light));border-radius:8px 8px 0 0;height:${Math.max(12, Math.round(x.v/maxV*190))}px;margin:0 auto"></div>
            <div style="font-size:11px;font-weight:600;color:var(--maroon-dark);margin-top:6px">${x.m}</div>
          </div>`).join('')}
      </div>`;
  }

  // Teaching vs Non-Teaching donut + legend
  const pT = total ? Math.round(tGross/total*100) : 0;
  const pN = 100-pT;
  document.getElementById('tnBreakdown').innerHTML = `
    <div style="display:flex;align-items:center;gap:20px">
      <div style="width:130px;height:130px;border-radius:50%;background:conic-gradient(var(--maroon) 0 ${pT}%, var(--gold) ${pT}% 100%);position:relative;flex-shrink:0">
        <div style="position:absolute;inset:18px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column">
          <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:var(--maroon-dark)">${pT}%</div>
          <div style="font-size:10px;color:var(--text-muted)">Teaching</div>
        </div>
      </div>
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #F5F0EA"><span style="width:12px;height:12px;border-radius:3px;background:var(--maroon)"></span><span style="font-size:13px;font-weight:600;color:var(--text)">Teaching</span><span style="margin-left:auto;font-size:13px;font-weight:700;color:var(--maroon-dark)">${fmt(tGross)}</span></div>
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0"><span style="width:12px;height:12px;border-radius:3px;background:var(--gold)"></span><span style="font-size:13px;font-weight:600;color:var(--text)">Non-Teaching</span><span style="margin-left:auto;font-size:13px;font-weight:700;color:var(--maroon-dark)">${fmt(nGross)}</span></div>
      </div>
    </div>`;

  // Government deductions summary — Monthly = average per processed month,
  // YTD = actual total across ALL confirmed payroll records.
  const processedKeys = new Set(allRecords.map(r => r.year + '-' + r.month));
  const monthsCount = processedKeys.size || 1;
  const rows = [['SSS',gov.sss],['PhilHealth',gov.phil],['Pag-IBIG',gov.pag],['BIR Withholding Tax',gov.bir]];
  const gTot = gov.sss+gov.phil+gov.pag+gov.bir;
  document.getElementById('govtDedBody').innerHTML = rows.map(([l,v])=>`
    <tr><td><strong>${l}</strong></td><td>${fmt(v/monthsCount)}</td><td>${fmt(v)}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;max-width:120px;background:#F0EBE3;border-radius:4px;height:6px;overflow:hidden"><div style="height:6px;width:${gTot?Math.round(v/gTot*100):0}%;background:linear-gradient(90deg,var(--maroon),var(--gold));border-radius:4px"></div></div><span style="font-size:12px;font-weight:600">${gTot?Math.round(v/gTot*100):0}%</span></div></td></tr>`).join('');

  // 13th Month Pay cost impact (December)
  const bonusEl = document.getElementById('bonusImpact');
  if (bonusEl) {
    const decRegular = parseFloat(total.toFixed(2));
    const thirteenth = parseFloat(allRecords.reduce((s,r)=>s+(parseFloat(r.thirteenth)||0),0).toFixed(2));
    const decTotal = decRegular + thirteenth;
    const pct = decRegular ? Math.round((thirteenth/decRegular)*100) : 0;
    const maxB = Math.max(decRegular, decTotal, 1);
    bonusEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div>
          <div style="display:flex;align-items:flex-end;gap:24px;height:200px;padding:0 8px">
            <div style="flex:1;text-align:center">
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${fmt(decRegular)}</div>
              <div style="width:100%;background:linear-gradient(180deg,var(--maroon),var(--maroon-light));border-radius:8px 8px 0 0;height:${Math.round(decRegular/maxB*180)}px;margin:0 auto"></div>
              <div style="font-size:11px;font-weight:600;color:var(--maroon-dark);margin-top:6px">Regular Monthly</div>
            </div>
            <div style="flex:1;text-align:center">
              <div style="font-size:11px;font-weight:700;color:var(--gold);margin-bottom:6px">+${fmt(thirteenth)}</div>
              <div style="width:100%;background:linear-gradient(180deg,#B8860B,var(--gold));border-radius:8px 8px 0 0;height:${Math.round(decTotal/maxB*180)}px;margin:0 auto"></div>
              <div style="font-size:11px;font-weight:600;color:var(--maroon-dark);margin-top:6px">December (incl. 13th Month)</div>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center;gap:12px">
          <div style="background:var(--gold-pale);border:1px solid var(--gold);border-radius:12px;padding:16px 20px;text-align:center">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Total 13th Month Payout</div>
            <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--maroon-dark)">${fmt(thirteenth)}</div>
          </div>
          <div style="background:var(--maroon-dark);border-radius:12px;padding:16px 20px;text-align:center">
            <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:4px">December Payroll</div>
            <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--gold-light)">${fmt(decTotal)}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:6px">+${pct}% vs regular monthly</div>
          </div>
        </div>
      </div>`;
  }
}
// Export the displayed report so downloaded rows match the selected period.
function reportExportData(kind) {
  const government = kind === 'government';
  const output = document.getElementById(government ? 'govReportOutput' : 'reportOutput');
  const body = document.getElementById(government ? 'govBody' : 'rptBody');
  if (!output || output.style.display === 'none' || !body || !body.rows.length) {
    showToast('⚠️', 'Select a report period with payroll records before exporting.');
    return null;
  }
  const title = document.getElementById(government ? 'govReportTitle' : 'reportTitle').textContent.trim();
  const table = body.closest('table');
  const totals = document.getElementById(government ? 'govTotals' : 'rptTotals').textContent.replace(/\s+/g, ' ').trim();
  const rows = Array.from(table.querySelectorAll('tr')).map(row =>
    Array.from(row.cells).map(cell => cell.textContent.replace(/\s+/g, ' ').trim()));
  const filename = title.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, '_');
  return { title, table, totals, rows, filename };
}

function reportCsvCell(value) {
  let text = String(value);
  // Keep monetary columns numeric when opened in a spreadsheet.
  if (/^[+−-]?₱\s*[\d,]+(?:\.\d+)?$/.test(text)) text = text.replace(/[₱,\s+]/g, '').replace('−', '-');
  // Employee names and other text must not execute spreadsheet formulas.
  if (/^[=+@-]/.test(text.trimStart()) && !/^-?\d+(?:\.\d+)?$/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function exportReport(kind = 'payroll') {
  const report = reportExportData(kind);
  if (!report) return;
  const rows = [[report.title], [], ...report.rows, [], [report.totals]];
  const csv = '\uFEFF' + rows.map(row => row.map(reportCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = report.filename + '.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  showToast('📥', 'CSV download started. Open the file in Excel or another spreadsheet app.');
}

function printReport(kind = 'payroll') {
  const report = reportExportData(kind);
  if (!report) return;
  const old = document.getElementById('printOverlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'printOverlay';
  overlay.className = 'report-print';
  const heading = document.createElement('h2');
  heading.textContent = 'Republic Central Colleges';
  const title = document.createElement('h3');
  title.textContent = report.title;
  const table = report.table.cloneNode(true);
  table.removeAttribute('id');
  table.className = 'report-print-table';
  table.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  const totals = document.createElement('p');
  totals.textContent = report.totals;
  overlay.append(heading, title, table, totals);
  document.body.appendChild(overlay);
  const oldTitle = document.title;
  document.title = report.filename;
  const cleanup = () => {
    overlay.remove();
    document.title = oldTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  try { window.print(); } catch (error) { cleanup(); throw error; }
}
