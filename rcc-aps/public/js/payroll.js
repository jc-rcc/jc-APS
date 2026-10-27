// ── USERS DATA ───────────────────────────────────────────────
let users = (_savedDemo && _savedDemo.users) || [
  {id:1, first:'Nash',        last:'Valencia',  email:'admin@rcc.edu.ph',    role:'System Admin',   status:'Active',  date:'Jan 10, 2026', salary:45000, classification:'Non-Teaching', department:'IT Office',            hireDate:'2020-01-10'},
  {id:2, first:'John',        last:'Cabigting', email:'finance@rcc.edu.ph', role:'Finance Officer', status:'Active',  date:'Jan 10, 2026', salary:38000, classification:'Non-Teaching', department:'Finance Office',       hireDate:'2019-06-01'},
  {id:3, first:'Jhon Gerald', last:'Batuaan',   email:'employee@rcc.edu.ph',role:'Employee',        status:'Active',  date:'Jan 12, 2026', salary:28500, classification:'Teaching',      department:'College of Computer Studies', hireDate:'2025-06-01', hourlyRate:190,  hoursWorked:150},
  {id:4, first:'Ana',         last:'Cruz',      email:'ana@rcc.edu.ph',     role:'Employee',        status:'Active',  date:'Feb 5, 2026',  salary:22000, classification:'Non-Teaching', department:'Accounting Office',   hireDate:'2023-08-15'},
  {id:5, first:'Roberto',     last:'Lim',       email:'roberto@rcc.edu.ph', role:'Finance Officer', status:'Inactive', date:'Feb 12, 2026', salary:35000, classification:'Non-Teaching', department:'Finance Office',       hireDate:'2018-01-20', endDate:'2026-05-31'},
  {id:6, first:'Luz',         last:'Reyes',     email:'luz@rcc.edu.ph',     role:'Employee',        status:'Active',  date:'Mar 3, 2026',  salary:32500, classification:'Teaching',      department:'College of Education', hireDate:'2022-06-01', hourlyRate:217,  hoursWorked:150},
  {id:7, first:'Carlo',       last:'Mendoza',   email:'carlo@rcc.edu.ph',   role:'Employee',        status:'Active',  date:'Mar 15, 2026', salary:20000, classification:'Non-Teaching', department:'Maintenance Office',  hireDate:'2024-02-01'},
  {id:8, first:'Sofia',       last:'Garcia',    email:'sofia@rcc.edu.ph',   role:'Employee',        status:'Inactive', date:'Apr 1, 2026',  salary:25000, classification:'Teaching',      department:'College of Arts & Sciences', hireDate:'2025-11-03', endDate:'2026-03-31', hourlyRate:167, hoursWorked:150},
  {id:9, first:'Maricel',     last:'Dela Cruz', email:'maricel@rcc.edu.ph', role:'Employee',        status:'Active',  date:'Apr 14, 2026', salary:27000, classification:'Non-Teaching', department:'Registrar Office',       hireDate:'2023-01-16'},
  {id:10,first:'Rey',         last:'Santos',    email:'rey@rcc.edu.ph',     role:'Employee',        status:'Active',  date:'Apr 22, 2026', salary:31000, classification:'Teaching',      department:'College of Business & Accountancy', hireDate:'2021-06-01', hourlyRate:207, hoursWorked:150},
  {id:11,first:'Jennifer',    last:'Torres',    email:'jennifer@rcc.edu.ph',role:'Employee',        status:'Active',  date:'May 5, 2026',  salary:24000, classification:'Non-Teaching', department:'Guidance Office',       hireDate:'2024-07-01'},
  {id:12,first:'Edwin',       last:'Navarro',   email:'edwin@rcc.edu.ph',   role:'Employee',        status:'Active',  date:'May 12, 2026', salary:33000, classification:'Teaching',      department:'College of Criminal Justice', hireDate:'2019-06-01', hourlyRate:220, hoursWorked:150},
];
let nextUserId = (_savedDemo && _savedDemo.nextUserId) || 13;
let editingUserId = null;
let cashAdvances = (_savedDemo && _savedDemo.cashAdvances) || {}; // per-employee cash advance: { id: amount }
// Payroll runs confirmed from the calculator (persisted). { empId, period, month, year, gross, sss, phil, pag, bir, cash, thirteenth, net, date }
let payrollRecords = (_savedDemo && _savedDemo.payrollRecords) || [];
// 13th-month payout tracking: { empId_year: { date } }
let bonusPayouts = (_savedDemo && _savedDemo.bonusPayouts) || {};

// ── LEAVE DATA ────────────────────────────────────────────────
let LEAVE_TYPES = (_savedDemo && _savedDemo.leaveTypes) || [
  { id: 1, name: 'Sick Leave', isPaid: true },
  { id: 2, name: 'Personal Leave', isPaid: false },
  { id: 3, name: 'Vacation Leave', isPaid: false },
  { id: 4, name: 'Maternity Leave', isPaid: true },
  { id: 5, name: 'Paternity Leave', isPaid: true }
];
let NEXT_LEAVE_TYPE_ID = (_savedDemo && _savedDemo.nextLeaveTypeId) || 6;
let LEAVE_RECORDS = (_savedDemo && _savedDemo.leaveRecords) || [];
// Per-day clock-in/out imported from HRIS. Matched to a local user by email.
// Record shape: { empId, employeeId, date (YYYY-MM-DD local), clockInAt, clockOutAt, hours }
let ATTENDANCE = (_savedDemo && _savedDemo.attendance) || [];

// Get leave breakdown for an employee in a given month/year
function getLeaveBreakdown(empId, monthNum, year) {
  const empRecords = LEAVE_RECORDS.filter(r => r.empId === empId);
  const breakdown = {};
  let totalUnpaidDays = 0;
  let totalPaidDays = 0;

  empRecords.forEach(record => {
    const start = new Date(record.startDate);
    const end = new Date(record.endDate);
    const recMonth = start.getMonth() + 1;
    const recYear = start.getFullYear();

    if (recMonth === monthNum && recYear === year) {
      const leaveType = LEAVE_TYPES.find(lt => lt.id === record.typeId);
      if (!leaveType) return;

      const days = record.days || Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

      if (!breakdown[leaveType.name]) {
        breakdown[leaveType.name] = { name: leaveType.name, isPaid: leaveType.isPaid, days: 0 };
      }
      breakdown[leaveType.name].days += days;

      if (leaveType.isPaid) {
        totalPaidDays += days;
      } else {
        totalUnpaidDays += days;
      }
    }
  });

  return { breakdown: Object.values(breakdown), totalPaidDays, totalUnpaidDays };
}

// Get total unpaid days for an employee in a given month/year
function getUnpaidDays(empId, monthNum, year) {
  const { totalUnpaidDays } = getLeaveBreakdown(empId, monthNum, year);
  return totalUnpaidDays;
}

// ── ATTENDANCE HELPERS ────────────────────────────────────────
const HOURS_PER_DAY = 8; // payroll policy: 1 absent/unpaid day = 8 hours

// Exact Mon-Fri calendar days of a month (matches WORK_DAYS=22 for a standard month).
function getPeriodWorkingDays(monthNum, year) {
  const days = [];
  const last = new Date(year, monthNum, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const dow = new Date(year, monthNum - 1, d).getDay();
    if (dow >= 1 && dow <= 5) days.push(d);
  }
  return days;
}

// True when an employee has any attendance or leave record in a given month, so
// "no data" periods are not misread as a full month of unexplained absences.
function periodHasData(empId, monthNum, year) {
  const p = String(year) + '-' + String(monthNum).padStart(2, '0');
  if (ATTENDANCE.some(r => r.empId === empId && String(r.date).indexOf(p) === 0)) return true;
  if (LEAVE_RECORDS.some(r => r.empId === empId && String(r.startDate).indexOf(p) === 0)) return true;
  return false;
}

// Adopt a full server snapshot (/api/data) into the shared in-memory state so the
// current session reflects MySQL without needing a page reload. Only fields the
// received payload actually carries are overwritten.
function applyServerData(d) {
  if (!d) return;
  if (Number.isInteger(d.stateRevision)) serverStateRevision = d.stateRevision;
  if (d.profiles && typeof d.profiles === 'object' && !Array.isArray(d.profiles)) {
    Object.keys(PROFILES).forEach(id => delete PROFILES[id]);
    Object.assign(PROFILES, d.profiles);
  }
  if (d.users) users = d.users;
  if (d.auth) {
    Object.keys(USERS_AUTH).forEach(k => delete USERS_AUTH[k]);
    Object.assign(USERS_AUTH, d.auth);
  }
  if (d.nextUserId) nextUserId = d.nextUserId;
  if (d.cashAdvances) cashAdvances = d.cashAdvances;
  if (Array.isArray(d.payrollRecords)) payrollRecords = d.payrollRecords;
  if (d.bonusPayouts) bonusPayouts = d.bonusPayouts;
  if (Array.isArray(d.leaveTypes)) LEAVE_TYPES = d.leaveTypes;
  if (d.nextLeaveTypeId) NEXT_LEAVE_TYPE_ID = d.nextLeaveTypeId;
  if (Array.isArray(d.leaveRecords)) LEAVE_RECORDS = d.leaveRecords;
  if (Array.isArray(d.attendance)) ATTENDANCE = d.attendance;
  if (d.nextLeaveRecordId) nextLeaveRecordId = d.nextLeaveRecordId;
  if (d.bonusExemptionLimit != null && !isNaN(parseFloat(d.bonusExemptionLimit))) BONUS_EXEMPTION_LIMIT = parseFloat(d.bonusExemptionLimit);
  if (d.workDays != null && !isNaN(parseFloat(d.workDays))) WORK_DAYS = parseFloat(d.workDays);
  if (d.hoursPerWorkload != null && !isNaN(parseFloat(d.hoursPerWorkload))) HOURS_PER_WORKLOAD = parseFloat(d.hoursPerWorkload);
  if (typeof deductionCategories !== 'undefined' && Array.isArray(d.deductionCategories)) deductionCategories = d.deductionCategories;
  if (d.nextDedCatId) nextDedCatId = d.nextDedCatId;
  if (typeof bonusTypes !== 'undefined' && Array.isArray(d.bonusTypes)) bonusTypes = d.bonusTypes;
  if (d.nextBonusId) nextBonusId = d.nextBonusId;
  if (typeof sssTable !== 'undefined' && Array.isArray(d.sssTable) && d.sssTable.length) sssTable = migrateSssTable(d.sssTable);
  if (typeof philData !== 'undefined' && d.philData) philData = Object.assign({}, philData, d.philData);
  if (typeof pagData  !== 'undefined' && d.pagData)  pagData  = Object.assign({}, pagData,  d.pagData);
  if (typeof birData  !== 'undefined' && Array.isArray(d.birData) && d.birData.length) birData = migrateBirTable(d.birData);
  if (typeof dedMeta  !== 'undefined' && d.dedMeta)  dedMeta  = Object.assign({}, dedMeta,  d.dedMeta);
  if (typeof teacherRanks !== 'undefined' && Array.isArray(d.teacherRanks) && d.teacherRanks.length) teacherRanks = d.teacherRanks;
  if (d.nextRankId) nextRankId = d.nextRankId;
  if (typeof teachingLoadRecords !== 'undefined' && Array.isArray(d.teachingLoadRecords)) teachingLoadRecords = d.teachingLoadRecords;
  if (typeof teachingLoadClasses !== 'undefined' && Array.isArray(d.teachingLoadClasses)) teachingLoadClasses = d.teachingLoadClasses;
  if (d.nextTeachingLoadId) nextTeachingLoadId = d.nextTeachingLoadId;
  if (d.nextTeachingLoadClassId) nextTeachingLoadClassId = d.nextTeachingLoadClassId;
}

// Default to the current Philippine calendar month, independently of old records.
function setDefaultPayPeriod(now = new Date()) {
  const sel = document.getElementById('payPeriod');
  if (!sel) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', month: 'long', year: 'numeric'
  }).formatToParts(now);
  const month = parts.find(p => p.type === 'month').value;
  const year = Number(parts.find(p => p.type === 'year').value);
  // Retain existing periods and make every month in the current year available.
  const periods = new Set(Array.from(sel.options).map(o => o.value));
  MONTHS.forEach(name => periods.add(name + ' ' + year));
  const sorted = [...periods].sort((a, b) => {
    const [am, ay] = a.split(' '), [bm, by] = b.split(' ');
    return Number(by) - Number(ay) || MONTHS.indexOf(bm) - MONTHS.indexOf(am);
  });
  sel.innerHTML = sorted.map(period => '<option>' + period + '</option>').join('');
  sel.value = month + ' ' + year;
  return true;
}

// Hours worked in a period = sum of (clockOut - clockIn), +24h if graveyard
// (clockOut < clockIn). Dates are matched by the stored 'date' field.
function getAttendanceHours(empId, monthNum, year) {
  const recs = ATTENDANCE.filter(r =>
    r.empId === empId &&
    parseInt(String(r.date).slice(0, 4), 10) === year &&
    parseInt(String(r.date).slice(5, 7), 10) === monthNum
  );
  return recs.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);
}

// PHP icon hours for a clockIn/clockOut (returns the day's hours, computing if needed).
function attendanceRecordHours(r) {
  if (r.hours != null) return parseFloat(r.hours) || 0;
  const a = new Date(r.clockInAt).getTime();
  const b = new Date(r.clockOutAt).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  let diff = (b - a) / 3600000;
  if (diff < 0) diff += 24; // graveyard shift
  return Math.max(0, Math.round(diff * 100) / 100);
}

// Set of dates (YYYY-MM-DD) with an attendance record for an employee.
function getAttendanceDaySet(empId) {
  const s = new Set();
  ATTENDANCE.forEach(r => { if (r.empId === empId && r.date) s.add(r.date); });
  return s;
}

// Set of dates covered by ANY leave record for the employee in the period.
// Uses the leave's stored days / start/end to build a day set.
function getLeaveCoveredDaySet(empId, monthNum, year) {
  const s = new Set();
  LEAVE_RECORDS.filter(r => r.empId === empId).forEach(rec => {
    const start = new Date(rec.startDate + 'T00:00:00');
    const end = new Date(rec.endDate + 'T00:00:00');
    const days = rec.days || Math.floor((end - start) / 86400000) + 1;
    for (let i = 0; i < days; i++) {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if ((day.getMonth() + 1) === monthNum && day.getFullYear() === year) {
        s.add(day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0'));
      }
    }
  });
  return s;
}

// Absent days = working days with no clock-in record AND no approved leave.
function getDetectedAbsences(empId, monthNum, year) {
  const attDays = getAttendanceDaySet(empId);
  const leaveDays = getLeaveCoveredDaySet(empId, monthNum, year);
  const workingDays = getPeriodWorkingDays(monthNum, year);
  let count = 0;
  workingDays.forEach(d => {
    const key = year + '-' + String(monthNum).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    if (!attDays.has(key) && !leaveDays.has(key)) count++;
  });
  return count;
}

// Total unpaid days for the payroll = unpaid leave days + detected absences.
function getTotalUnpaidDaysAll(empId, monthNum, year) {
  const { totalUnpaidDays } = getLeaveBreakdown(empId, monthNum, year);
  return totalUnpaidDays + getDetectedAbsences(empId, monthNum, year);
}

// ── PAYROLL RECORDS (per employee per month) ─────────────────
// Employee classification helpers
const EMP_CLASS = { Teaching: {badge:'b-blue'}, 'Non-Teaching': {badge:'b-gold'} };
function empGrossPay(emp, hours, absences) {
  if (emp.classification === 'Teaching') {
    const r = teacherRate(emp);
    const lvl = emp.schoolLevel;
    if (lvl === 'Elementary') {
      // Monthly salary (profile) is the pay base; rank rate is the fallback.
      const s = parseFloat(emp.salary) || 0;
      return parseFloat((s > 0 ? s : r).toFixed(2));
    }
    const h = Math.max(0, (hours != null && hours !== '') ? parseFloat(hours) : (emp.hoursWorked || 0));
    // High School pays per workload (HOURS_PER_WORKLOAD hrs = 1 workload); College/Grad per hour.
    if (lvl === 'High School') return parseFloat((r * h / HOURS_PER_WORKLOAD).toFixed(2));
    return parseFloat((h * r).toFixed(2));
  }
  const base = Math.max(0, parseFloat(emp.salary) || 0);
  const a = Math.max(0, (absences != null && absences !== '') ? parseFloat(absences) : (emp.absenceDays || 0));
  return parseFloat((base - (a / WORK_DAYS) * base).toFixed(2));
}
function empHrsOrAbs(emp) {
  return emp.classification === 'Teaching'
    ? { label:'Hours Worked', unit:'hrs',  value: emp.hoursWorked || 0 }
    : { label:'Absences',     unit:'days', value: emp.absenceDays || 0 };
}
function getEmpCashAdvance(id) { return parseFloat(cashAdvances[id]) || 0; }

// RA 10963 (TRAIN) / CREATE Act: 13th month pay + other bonuses are exempt
// from income tax only up to a configurable annual limit (default ₱90,000);
// the excess is taxable income. Editable in Bonus Management.
let BONUS_EXEMPTION_LIMIT = (_savedDemo && _savedDemo.bonusExemptionLimit) || 90000;
// Payroll basis: working days per month used as the absence divisor for
// monthly-paid (Non-Teaching) staff. Configurable in Deduction Tables —
// standard convention is 22; holidays stay paid so they are not deducted.
let WORK_DAYS = (_savedDemo && _savedDemo.workDays) || 22;
// High School workload size: 1 workload = this many teaching hours.
// Configurable in Formula Management; feeds payroll + teaching load estimates.
let HOURS_PER_WORKLOAD = (_savedDemo && _savedDemo.hoursPerWorkload) || 3;
// Splits bonuses (13th month + other bonuses) into exempt and taxable parts.
// Returns the taxable excess and how much of it comes from the 13th month.
function splitBonusTaxable(thirteenth, otherBonuses) {
  const t13 = parseFloat(thirteenth) || 0;
  const ob  = parseFloat(otherBonuses) || 0;
  const total = t13 + ob;
  const taxableTotal = Math.max(0, total - BONUS_EXEMPTION_LIMIT);
  const taxable13 = Math.min(t13, taxableTotal);
  const taxableBonus = taxableTotal - taxable13;
  return {
    total, taxableTotal,
    taxable13, taxableBonus,
    exempt13: t13 - taxable13,
    exemptBonus: ob - taxableBonus,
    exemptTotal: Math.min(total, BONUS_EXEMPTION_LIMIT),
  };
}

// BIR annual withholding (TRAIN Law brackets) — computed from the EDITABLE
// birData table (Deduction Tables → BIR). Keeping the tax in sync with what
// the Finance Officer configures keeps the system compliant when BIR issues
// new schedules. Brackets are structured {min, max, base, rate} rows matching
// income in (min, max]; max = null is the open-ended top bracket.
function annualBIR(annual) {
  for (const row of birData) {
    const min = parseFloat(row.min) || 0;
    const max = openMax(row) ? Infinity : (parseFloat(row.max) || Infinity);
    if (annual > min && annual <= max) {
      return parseFloat(((parseFloat(row.base)||0) + (annual - min) * ((parseFloat(row.rate)||0)) / 100).toFixed(2));
    }
  }
  return 0;
}
// Taxable monthly income = gross minus the employee's mandatory contributions
// (SSS, PhilHealth, Pag-IBIG). Per BIR RR 11-2018 this is the base the BIR taxes.
function taxableMonthlyOf(gross, d) {
  return Math.max(0, (parseFloat(gross)||0) - (parseFloat(d?.sss)||0) - (parseFloat(d?.phil)||0) - (parseFloat(d?.pag)||0));
}
// Extra ANNUAL BIR tax caused by the taxable one-time bonus (0 when fully exempt ≤₱90,000).
// Computed on the annual TAXABLE income so it is consistent with the monthly BIR method.
function bonusAnnualTax(taxableMonthly, taxableBonus) {
  const base = Math.max(0, parseFloat(taxableMonthly) || 0) * 12;
  const b = parseFloat(taxableBonus) || 0;
  if (b <= 0) return 0;
  return Math.max(0, annualBIR(base + b) - annualBIR(base));
}
// 13th Month Excess Tax (RA 10963 / CREATE): the FULL tax on the taxable excess is
// withheld from the December 13th Month Pay per BIR annualized withholding rules.
// d.bir here is the regular monthly withholding (13th is NOT added to monthly BIR).
function thirteenthTaxSplit(d, monthlyGross, taxable13) {
  const annualTax = bonusAnnualTax(taxableMonthlyOf(monthlyGross, d), taxable13);
  return { annualTax, baseBir: parseFloat((d.bir || 0).toFixed(2)) };
}

// Active custom deduction categories (Deduction Tables → Other Deduction
// Categories) applied on top of statutory deductions. Non-statutory: they do
// NOT reduce taxable income — they lower net pay only, like a cash advance.
// customOverrides maps category id → amount for per-run calculator overrides;
// ids left blank fall back to the category default (fixed ₱ or % of gross).
function payrollDeductionCategories() {
  const cats = deductionCategories.filter(c => c.status === 'Active');
  const peraa = deductionCategories.find(c => String(c.name).trim().toUpperCase() === 'PERAA');
  if (!peraa) cats.unshift({ id: 'peraa', name: 'PERAA', type: 'fixed', amount: 0, status: 'Active', unconfigured: true });
  else if (peraa.status !== 'Active') cats.unshift(peraa);
  return cats;
}

function activeCustomDeductions(gross, customOverrides) {
  return payrollDeductionCategories()
    .filter(c => c.status === 'Active')
    .map(c => {
      let amt;
      if (customOverrides && customOverrides[c.id] !== undefined) amt = parseFloat(customOverrides[c.id]) || 0;
      else if (c.type === 'percent') amt = (parseFloat(gross) || 0) * c.amount / 100;
      else amt = parseFloat(c.amount) || 0;
      return { id: c.id, name: c.name, amount: parseFloat(amt.toFixed(2)) };
    })
    .filter(x => x.amount > 0);
}

// Reads the per-run override inputs from the Payroll Calculator. Blank = use
// the category default; an explicit 0 excludes the category for this run.
function collectCustomOverrides() {
  const ov = {};
  payrollDeductionCategories().filter(c => c.status === 'Active').forEach(c => {
    const el = document.getElementById('calcCustom_' + c.id);
    if (el && el.value !== '') ov[c.id] = Math.max(0, parseFloat(el.value) || 0);
  });
  return ov;
}

// Helper: compute deductions
function computeDeductions(gross, cashAdv, extraAnnual, customOverrides) {
  const salary = Math.max(0, parseFloat(gross) || 0);
  // SSS — 2025 schedule (RA 11199, Circular 2024-006): Employee share is read
  // from the editable structured sssTable brackets (MSC ₱5,000–₱35,000, 5%
  // employee share). A bracket matches when salary >= min and salary < max.
  function getSSS(s) {
    for (const row of sssTable) {
      const min = parseFloat(row.min) || 0;
      const max = openMax(row) ? Infinity : (parseFloat(row.max) || Infinity);
      if (s >= min && s < max) return parseFloat(row.emp) || 0;
    }
    return sssTable.length ? (parseFloat(sssTable[sssTable.length - 1].emp) || 0) : 0;
  }
// Total monthly PhilHealth premium (employee + employer) for a salary base,
// clamped to the editable min/max contribution. Shared by the calculator and
// the Deduction Tables example renderer so both always agree.
function philMonthlyTotal(s) {
  return Math.min(philData.max, Math.max(philData.min, s * philData.rate / 100));
}
// PhilHealth — rate% of the salary base (half = employee share). The base is
// clamped to the editable salary floor/ceiling before applying the rate.
function getPhil(s) {
  const base = Math.min(philData.ceiling || Infinity, Math.max(philData.floor || 0, s));
  return parseFloat((philMonthlyTotal(base) / 2).toFixed(2));
}
  // Pag-IBIG — 2% of monthly compensation (1% for ≤₱1,500), max ₱100 employee
  function getPag(s) {
    const r = s <= 1500 ? pagData.rate1 : pagData.rate2;
    return parseFloat(Math.min(s * r / 100, pagData.empMax).toFixed(2));
  }
  // BIR TRAIN Law (CREATE MORE brackets retained) — BIR withholds on the monthly
  // TAXABLE income (gross minus mandatory SSS/PhilHealth/Pag-IBIG), annualized.
  // extraAnnual is the one-time taxable bonus excess (e.g. 13th month over ₱90,000).
  function getBIR(s, sss, phil, pag) {
    const taxable = Math.max(0, s - sss - phil - pag);
    const annual = taxable * 12 + (parseFloat(extraAnnual) || 0);
    return parseFloat((annualBIR(annual) / 12).toFixed(2));
  }
  const sss  = getSSS(salary);
  const phil = getPhil(salary);
  const pag  = getPag(salary);
  const bir  = getBIR(salary, sss, phil, pag);
  const cash = parseFloat(cashAdv) || 0;
  const custom = activeCustomDeductions(salary, customOverrides);
  const customTotal = parseFloat(custom.reduce((s, x) => s + x.amount, 0).toFixed(2));
  const net  = parseFloat((salary - sss - phil - pag - bir - cash - customTotal).toFixed(2));
  return { sss, phil, pag, bir, cash, custom, customTotal, gross: salary, net };
}

// ── PAYROLL CALCULATOR ────────────────────────────────────────
// Active calculator tab (department group): 'Non-Teaching', 'Elementary',
// 'High School', or 'College / Graduate' (College + Graduate School share
// one tab — rates differ per subject via the Level tag).
let currentCalcTab = 'Non-Teaching';

// Whether an employee belongs to the given calculator tab group.
function calcTabMatches(u, group) {
  if (group === 'Non-Teaching') return u.classification === 'Non-Teaching';
  if (group === 'Elementary') return u.classification === 'Teaching' && u.schoolLevel === 'Elementary';
  if (group === 'College / Graduate') return u.classification === 'Teaching'
    && (u.schoolLevel === 'College' || u.schoolLevel === 'Graduate School');
  return u.classification === 'Teaching' && u.schoolLevel === group;
}

function calcEmpOptions() {
  return users.filter(u=>u.status==='Active' && (u.role==='Employee'||u.role==='Finance Officer'||u.role==='System Admin'))
    .filter(u=>calcTabMatches(u, currentCalcTab));
}

function getCalcEmpQuery() {
  return ((document.getElementById('calcEmpSearch')||{}).value||'').toLowerCase().trim();
}

function calcEmpMatches(u) {
  const q = getCalcEmpQuery();
  if (!q) return true;
  const name = `${u.first} ${u.last}`.toLowerCase();
  return name.includes(q) || (u.email||'').toLowerCase().includes(q) || (u.department||'').toLowerCase().includes(q);
}

function renderCalcEmpList(list, show) {
  const box = document.getElementById('calcEmpList');
  if (!box) return;
  box.innerHTML = list.length
    ? list.map(u=>`<div class="combobox-item" onclick="selectCalcEmp(${u.id})">${esc(displayName(u))} — ${u.classification}${u.classification==='Teaching'&&u.schoolLevel?' · '+esc(u.schoolLevel):''}${u.department?' · '+esc(u.department):''}</div>`).join('')
    : '<div class="combobox-empty">No employee found.</div>';
  box.classList.toggle('show', show !== false);
}

function openCalcEmpList() {
  const hidden = document.getElementById('calcEmp');
  const inp = document.getElementById('calcEmpSearch');
  // If a selection is already made and the input still shows its full label,
  // drop the label first so the list reopens with all options (no manual erase).
  if (hidden && hidden.value && inp && inp.value.trim()) {
    const emp = users.find(u=>u.id===parseInt(hidden.value));
    if (emp && inp.value.trim() === calcEmpLabel(emp)) inp.value = '';
  }
  renderCalcEmpList(calcEmpOptions().filter(calcEmpMatches));
}

function toggleCalcEmpList(e) {
  if (e) e.stopPropagation();
  const box = document.getElementById('calcEmpList');
  if (box && box.classList.contains('show')) closeCalcEmpList();
  else openCalcEmpList();
}

function closeCalcEmpList() {
  const box = document.getElementById('calcEmpList');
  if (box) box.classList.remove('show');
}

function resetCalcOutput() {
  const res = document.getElementById('calcResult');
  const empty = document.getElementById('calcEmpty');
  const meta = document.getElementById('calcEmpMeta');
  if (res) res.style.display = 'none';
  if (empty) { empty.style.display = 'block'; empty.innerHTML = '<div style="font-size:36px;margin-bottom:8px">💰</div><div>Select an employee, enter hours worked (Teaching) or absences (Non-Teaching), and any cash advance to begin computation.</div>'; }
  if (meta) meta.style.display = 'none';
}

function onCalcEmpInput() {
  const hidden = document.getElementById('calcEmp');
  if (hidden && hidden.value) { hidden.value = ''; resetCalcOutput(); }
  openCalcEmpList();
}

// Label shown in the search field once an employee is selected
function calcEmpLabel(u) {
  return `${displayName(u)} — ${u.classification}${u.classification==='Teaching'&&u.schoolLevel?' · '+u.schoolLevel:''}${u.department?' · '+u.department:''}`;
}

function selectCalcEmp(id) {
  const emp = users.find(u=>u.id===id);
  if (!emp) return;
  document.getElementById('calcEmp').value = id;
  const inp = document.getElementById('calcEmpSearch');
  if (inp) inp.value = calcEmpLabel(emp);
  closeCalcEmpList();
  loadEmployeeData();
}

function onCalcEmpKey(e) {
  if (e.key === 'Escape') { closeCalcEmpList(); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); openCalcEmpList(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const item = document.querySelector('#calcEmpList .combobox-item');
    if (item) item.click();
  }
}

function populateCalcEmployees() {
  renderCalcEmpList(calcEmpOptions(), false);
  renderCalcCustomInputs();
  updateCalc13thState();
  syncCalcTabUI();
}

// Per-run override inputs for active custom deduction categories. Fixed
// categories pre-fill their default amount; percent categories start blank
// (auto % of gross) and any typed value overrides the computed amount.
function renderCalcCustomInputs() {
  const row = document.getElementById('calcCustomRow');
  if (!row) return;
  const cats = payrollDeductionCategories();
  if (!cats.length) { row.style.display = 'none'; row.innerHTML = ''; return; }
  row.style.display = 'grid';
  row.innerHTML = cats.map(c => `
    <div class="fg">
      <label class="fl" for="calcCustom_${c.id}">📌 ${esc(c.name)} ${c.type === 'percent' ? '(' + c.amount + '% of gross)' : '(₱)'}</label>
      <input class="fi" type="number" step="0.01" min="0" id="calcCustom_${c.id}"
        value="${c.type === 'fixed' ? (parseFloat(c.amount)||0).toFixed(2) : ''}"
        placeholder="${c.type === 'percent' ? 'auto — ' + c.amount + '% of gross' : '0.00'}"
        ${c.status !== 'Active' ? 'disabled' : ''} oninput="computePayroll()"/>
      ${String(c.name).trim().toUpperCase() === 'PERAA' ? '<div style="font-size:11.5px;color:var(--text-muted);margin-top:4px">' + (c.status !== 'Active' ? 'Inactive in Deduction Management. No contribution will be deducted.' : c.unconfigured ? 'Enter the employee contribution for this payroll. Set a default in Deduction Management → Configure PERAA.' : 'Use 0 for an employee who does not contribute. Default is managed in Deduction Management.') + '</div>' : ''}
    </div>`).join('');
}

// Enable/disable the 13th Month option in the payroll calculator based on Bonus Management toggle
function updateCalc13thState() {
  const chk = document.getElementById('calc13th');
  const wrap = document.getElementById('calc13thWrap');
  const lbl = document.getElementById('calc13thLabel');
  if (!chk) return;
  const active = isThirteenthActive();
  const period = (document.getElementById('payPeriod')?.value || 'December 2026');
  const isDec = /^december/i.test(period.split(' ')[0]);
  const canUse = active && isDec;
  chk.disabled = !canUse;
  chk.checked = canUse;
  if (wrap) wrap.style.opacity = canUse ? '1' : '0.5';
  if (wrap) wrap.style.cursor = canUse ? 'pointer' : 'not-allowed';
  if (lbl) lbl.textContent = canUse
    ? '🎁 Include 13th Month Pay (RA 8515)'
    : active
      ? '🎁 13th Month Pay — applies only in the December run'
      : '🎁 13th Month Pay — disabled (enable in Bonus Management)';
  computePayroll();
}

function onPayPeriodChange() {
  updateCalc13thState();
  updateCalcStatusBadge();
  renderPayrollSummary();
  // Update leave breakdown when period changes
  const empId = parseInt(document.getElementById('calcEmp').value);
  if (empId) {
    // Re-run loadEmployeeData to update absences from leave records
    loadEmployeeData();
  }
}

function filterCalcEmployees() {
  const hidden = document.getElementById('calcEmp');
  const cur = parseInt(hidden.value) || 0;
  if (cur && !calcEmpOptions().some(u=>u.id===cur)) {
    hidden.value = '';
    const inp = document.getElementById('calcEmpSearch');
    if (inp) inp.value = '';
    resetCalcOutput();
  }
  openCalcEmpList();
}

// Switch the calculator to a department tab: toggles the active tab button,
// shows/hides the absences row vs. the EXPLANATION editor, updates labels,
// re-filters the employee list and clears the calculator output.
function showCalcTab(group) {
  currentCalcTab = group;
  syncCalcTabUI();
  const hidden = document.getElementById('calcEmp');
  if (hidden) hidden.value = '';
  const inp = document.getElementById('calcEmpSearch');
  if (inp) inp.value = '';
  const note = document.getElementById('calcPayNote');
  if (note) note.value = '';
  // Drop the EXPLANATION rows too — they belong to the previous Payroll Group
  // (subjects/rates are per level), so they must never leak into the new tab.
  const subjBody = document.getElementById('calcSubjectBody');
  if (subjBody) subjBody.innerHTML = '';
  resetCalcOutput();
  recomputeCalcTotals();
  populateCalcEmployees();
}

// Sync row visibility/labels with the current tab without touching the
// selected employee (also initializes the calculator on page load).
function syncCalcTabUI() {
  const group = currentCalcTab;
  document.querySelectorAll('#calcTabs .calc-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.group === group);
  });
  const isNT = group === 'Non-Teaching';
  const isElem = group === 'Elementary';
  const isExpl = group === 'High School' || group === 'College / Graduate';
  const attField = document.getElementById('calcAttField');
  const attLabel = document.getElementById('calcAttLabel');
  const explRow = document.getElementById('calcExplanationRow');
  const rateHdr = document.getElementById('calcRateHdr');
  const qtyHdr = document.getElementById('calcQtyHdr');
  const grossWrap = document.getElementById('calcGrossLabel');
  // Only the Absences field is NT/Elem-only — the row stays visible so
  // Cash Advance works for every Payroll Group (incl. HS/College/Grad).
  if (attField) attField.style.display = (isNT || isElem) ? '' : 'none';
  if (attLabel) attLabel.textContent = 'Absences (days)';
  const workDaysField = document.getElementById('calcWorkDaysField');
  if (workDaysField) workDaysField.style.display = (isNT || isElem) ? '' : 'none';
  if (explRow) explRow.style.display = isExpl ? 'block' : 'none';
  if (rateHdr) rateHdr.textContent = group === 'High School' ? 'Rate per Workload (₱)' : 'Rate per Hour (₱)';
  if (qtyHdr) qtyHdr.textContent = group === 'High School' ? 'Qty (Workloads)' : 'Qty (Hrs/Month)';
  if (grossWrap) {
    grossWrap.style.display = (isNT || isElem) ? '' : 'none';
    const grossLbl = document.getElementById('calcGrossFieldLabel');
    if (grossLbl) grossLbl.textContent = 'Monthly Base Salary (₱)';
  }
}

// Level options for per-subject "For College / For Grad" tagging.
const CALC_LEVELS = ['College', 'Graduate School', 'High School', 'Elementary'];
function calcLevelOpts(cur) {
  return ['<option value="">(auto)</option>']
    .concat(CALC_LEVELS.map(l => '<option value="' + l + '"' + ((cur || '') === l ? ' selected' : '') + '>' + l + '</option>'))
    .join('');
}
// Subject level is a schedule tag; rates follow the employee's assigned rank.
function onCalcSubjectLevel(sel) {
  recomputeCalcTotals();
  computePayroll();
}

// Refresh rank rates while keeping quantities and manual increments intact.
function syncCalcRankRates() {
  const selected = document.getElementById('calcEmp');
  const emp = users.find(u => u.id === parseInt(selected ? selected.value : ''));
  if (!emp || emp.classification !== 'Teaching') return;
  if (currentCalcTab !== 'High School' && currentCalcTab !== 'College / Graduate') return;
  const rate = teacherRate(emp);
  const salary = document.getElementById('calcSalary');
  if (salary) salary.value = rate;
  const body = document.getElementById('calcSubjectBody');
  if (body) body.querySelectorAll('tr').forEach(tr => {
    if (tr.dataset.type === 'increment') return;
    const input = tr.querySelector('.calc-rate');
    if (input) { input.value = rate.toFixed(2); input.readOnly = true; }
  });
}

// Add a subject row to the EXPLANATION editor. Rate is auto-filled from
// teacherRate(emp) when known; qty is left at 0 for Finance to encode.
function addCalcSubject(prefill) {
  const tbody = document.getElementById('calcSubjectBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.dataset.type = 'subject';
  tr.innerHTML =
    '<td style="padding:4px 4px"><input class="fi" style="width:100%;padding:4px 6px" placeholder="Subject" value="' + esc((prefill && prefill.subject) || '') + '" oninput="recomputeCalcTotals();computePayroll()"/></td>' +
    '<td style="padding:4px 4px"><select class="fi calc-level-sel" style="width:104px;padding:4px 6px" title="For College / For Grad — tag which level this subject is for" onchange="onCalcSubjectLevel(this)">' + calcLevelOpts((prefill && prefill.level) || '') + '</select></td>' +
    '<td style="padding:4px 4px"><input class="fi calc-dept" style="width:90px;padding:4px 6px" aria-label="Subject department" placeholder="e.g. CCS" value="' + esc((prefill && prefill.deptCode) || '') + '" oninput="computePayroll()"/></td>' +
    '<td style="padding:4px 4px"><input class="fi calc-days" style="width:90px;padding:4px 6px" placeholder="e.g. MWF" title="Schedule days" value="' + esc((prefill && prefill.days) || '') + '" oninput="recomputeCalcTotals();computePayroll()"/></td>' +
    '<td style="padding:4px 4px"><input class="fi calc-qty" style="width:100px;padding:4px 6px" type="number" step="any" min="0" placeholder="0" value="' + ((prefill && prefill.qty != null) ? prefill.qty : 0) + '" oninput="recomputeCalcTotals();computePayroll()"/></td>' +
    '<td style="padding:4px 4px"><input class="fi calc-rate" style="width:90px;padding:4px 6px" type="number" step="0.01" min="0" placeholder="0" value="' + ((prefill && prefill.rate != null) ? prefill.rate : '') + '" oninput="recomputeCalcTotals();computePayroll()"/></td>' +
    '<td style="padding:4px 4px;font-weight:600" class="calc-amt">0.00</td>' +
    '<td style="padding:4px 4px"><button type="button" class="btn btn-outline btn-sm" title="Remove subject" onclick="this.closest(\'tr\').remove();recomputeCalcTotals();computePayroll()">✕</button></td>';
  tbody.appendChild(tr);
  recomputeCalcTotals();
}

// Add an "Increment - S.Y" row to the EXPLANATION editor.
function addCalcIncrement() {
  const tbody = document.getElementById('calcSubjectBody');
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.dataset.type = 'increment';
  tr.innerHTML =
    '<td colspan="4" style="padding:4px 4px;font-weight:600">Increment - S.Y</td>' +
    '<td style="padding:4px 4px"><input class="fi calc-qty" style="width:70px;padding:4px 6px" type="number" step="0.5" min="0" placeholder="0" oninput="recomputeCalcTotals();computePayroll()"/></td>' +
    '<td style="padding:4px 4px"><input class="fi calc-rate" style="width:90px;padding:4px 6px" type="number" step="0.01" min="0" placeholder="0" oninput="recomputeCalcTotals();computePayroll()"/></td>' +
    '<td style="padding:4px 4px;font-weight:600" class="calc-amt">0.00</td>' +
    '<td style="padding:4px 4px"><button type="button" class="btn btn-outline btn-sm" title="Remove increment" onclick="this.closest(\'tr\').remove();recomputeCalcTotals();computePayroll()">✕</button></td>';
  tbody.appendChild(tr);
  recomputeCalcTotals();
}

// Recompute per-row amounts and the Total Qty / Gross from Subjects totals.
function recomputeCalcTotals() {
  syncCalcRankRates();
  const tbody = document.getElementById('calcSubjectBody');
  if (!tbody) return;
  let totalQty = 0, gross = 0;
  tbody.querySelectorAll('tr').forEach(tr => {
    const qtyEl = tr.querySelector('.calc-qty');
    const rateEl = tr.querySelector('.calc-rate');
    const qty = Math.max(0, parseFloat(qtyEl ? qtyEl.value : '') || 0);
    const rate = Math.max(0, parseFloat(rateEl ? rateEl.value : '') || 0);
    const amt = parseFloat((qty * rate).toFixed(2));
    totalQty += qty;
    gross += amt;
    const amtCell = tr.querySelector('.calc-amt');
    if (amtCell) amtCell.textContent = amt.toFixed(2);
  });
  const tq = document.getElementById('calcTotalQty');
  const sg = document.getElementById('calcSubjGross');
  if (tq) tq.textContent = totalQty;
  if (sg) sg.textContent = gross.toFixed(2);
}

// Latest teaching load rows from the Teaching Load module (most recent
// school year / semester on file) — used to pre-fill the EXPLANATION
// editor for High School / College + Graduate tabs. TL stores
// hrs/week per subject; converted here to hrs/month for the calculator.
function calcScheduledMonthHours(cls, month, year) {
  const days = tlDaysParse(cls.days);
  if (!days.length) return 0;
  const range = tlParseTimeRange((cls.timeStart || '') + '-' + (cls.timeEnd || ''));
  const sessionHours = range ? range.hours : (parseFloat(cls.hoursPerWeek) || 0) / days.length;
  const dayCodes = ['', 'M', 'T', 'W', 'Th', 'F', 'S'];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let sessions = 0;
  for (let day = 1; day <= lastDay; day++) {
    const code = dayCodes[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    if (code && days.includes(code)) sessions++;
  }
  return Number((sessions * sessionHours).toPrecision(15));
}

function latestTeachingLoads(empId, semester, schoolYear, month, year) {
  if (typeof teachingLoadRecords === 'undefined' || !Array.isArray(teachingLoadRecords)) return [];
  if (typeof teachingLoadClasses === 'undefined' || !Array.isArray(teachingLoadClasses)) return [];
  const recs = teachingLoadRecords.filter(r => r.empId === empId &&
    (!semester || r.semester === semester) && (!schoolYear || r.schoolYear === schoolYear));
  if (!recs.length) return [];
  const semOrder = s => ['1st', '2nd', 'Summer'].indexOf(s);
  // Sort newest-first: SY desc → semester desc → id desc.
  const latest = recs.slice().sort((a, b) =>
    (b.schoolYear || '').localeCompare(a.schoolYear || '') ||
    semOrder(b.semester) - semOrder(a.semester) ||
    (b.id || 0) - (a.id || 0))[0];
  const weeks = ((typeof WORK_DAYS !== 'undefined' && WORK_DAYS) ? WORK_DAYS : 22) / 5;
  const hpw = ((typeof HOURS_PER_WORKLOAD !== 'undefined' && HOURS_PER_WORKLOAD) ? HOURS_PER_WORKLOAD : 3);
  return teachingLoadClasses
    .filter(c => c.recordId === latest.id)
    .map(c => {
      const hours = month >= 1 && month <= 12 && Number.isInteger(year)
        ? calcScheduledMonthHours(c, month, year)
        : (parseFloat(c.hoursPerWeek) || 0) * weeks;
      return {
      subject: c.subject || '',
      deptCode: c.deptCode || '',
      level: c.level || '',
      days: c.days || '',
      // Normalize floating-point noise without rounding to half-hour steps.
      qty: Number(hours.toPrecision(15)),
      // Workloads per month — what Finance encodes on the High School tab.
      wlQty: Number((hours / hpw).toPrecision(15))
    }; });
}

document.addEventListener('click', function(e){
  const wrap = document.getElementById('calcEmpWrap');
  if (wrap && !wrap.contains(e.target)) closeCalcEmpList();
});

function syncCalcTeachingYears(empId) {
  const select = document.getElementById('calcSchoolYear');
  if (!select) return;
  const previous = select.value;
  const records = typeof teachingLoadRecords !== 'undefined' ? teachingLoadRecords : [];
  const years = [...new Set(records.filter(r => r.empId === empId).map(r => r.schoolYear).filter(Boolean))].sort().reverse();
  if (!years.length && typeof tlDefaultSY === 'function') years.push(tlDefaultSY());
  select.innerHTML = years.map(year => '<option value="' + esc(year) + '">' + esc(year) + '</option>').join('');
  select.value = years.includes(previous) ? previous : (years[0] || '');
}

function onCalcTeachingTermChange() {
  const selected = document.getElementById('calcEmp');
  if (!selected || !selected.value) return;
  const note = document.getElementById('calcPayNote');
  if (note) note.value = '';
  const cash = document.getElementById('calcCash');
  const cashValue = cash ? cash.value : '';
  loadEmployeeData();
  if (cash) cash.value = cashValue;
  computePayroll();
}

function loadEmployeeData() {
  const id = parseInt(document.getElementById('calcEmp').value);
  const emp = users.find(u=>u.id===id);
  const res = document.getElementById('calcResult');
  const empty = document.getElementById('calcEmpty');
  const meta = document.getElementById('calcEmpMeta');
  const salEl = document.getElementById('calcSalary');
  const attEl = document.getElementById('calcAtt');
  const cashEl = document.getElementById('calcCash');
  if (!emp) {
    res.style.display='none'; empty.style.display='block'; meta.style.display='none';
    return;
  }
  const isTeaching = emp.classification === 'Teaching';
  const group = currentCalcTab;
  const isExplTab = group === 'High School' || group === 'College / Graduate';
  document.getElementById('calcMetaName').textContent = displayName(emp);
  document.getElementById('calcMetaClass').textContent = emp.classification + (isTeaching && emp.schoolLevel ? ' · ' + emp.schoolLevel : '') + (emp.rankName ? ' · ' + emp.rankName : '');
  document.getElementById('calcMetaDept').textContent = emp.department || '—';
  meta.style.display = 'block';

  const period = document.getElementById('payPeriod').value || 'December 2026';
  const [monthName, yearStr] = period.split(' ');
  const year = parseInt(yearStr) || 2026;
  const monthNum = MONTHS.indexOf(monthName) + 1;

  const workDaysInput = document.getElementById('calcWorkDays');
  const workDaysContext = emp.id + '|' + period;
  const customRow = document.getElementById('calcCustomRow');
  if (customRow && customRow.dataset.context !== workDaysContext) {
    renderCalcCustomInputs();
    customRow.dataset.context = workDaysContext;
  }
  if (workDaysInput && workDaysInput.dataset.context !== workDaysContext) {
    workDaysInput.value = WORK_DAYS;
    workDaysInput.dataset.context = workDaysContext;
  }

  const hasData = periodHasData(emp.id, monthNum, year);
  if (isExplTab) {
    // High School / College + Graduate: pre-fill the EXPLANATION
    // editor from the employee's selected Teaching Load term. Subject and
    // days come from the load schedule; qty is hrs/month for College/Grad
    // but workloads/month for High School; rate is auto-filled from the
    // rank table (per hour / per workload respectively).
    const tbody = document.getElementById('calcSubjectBody');
    if (tbody) tbody.innerHTML = '';
    syncCalcTeachingYears(emp.id);
    const semester = document.getElementById('calcSemester').value;
    const schoolYear = document.getElementById('calcSchoolYear').value;
    const loads = latestTeachingLoads(emp.id, semester, schoolYear, monthNum, year);
    const termStatus = document.getElementById('calcTeachingTermStatus');
    if (termStatus) termStatus.textContent = loads.length
      ? 'Loaded ' + loads.length + ' subject(s) from Teaching Load · ' + (semester === 'Summer' ? 'Summer' : semester + ' Sem') + ' · SY ' + schoolYear + '. Hours follow scheduled class dates for the full month of ' + period + '.'
      : 'No saved Teaching Load subjects for this employee in the selected semester and school year.';
    const rate = teacherRate(emp);
    loads.forEach(l => {
      addCalcSubject({ subject: l.subject || '', level: l.level || '', deptCode: l.deptCode || '', days: l.days || '', qty: (group === 'High School' ? l.wlQty : l.qty) || 0, rate });
    });
    salEl.value = rate || '';
    attEl.value = '';
  } else if (isTeaching) {
    // Elementary: monthly salary with absences deducted (÷ WORK_DAYS).
    // Prefill from the profile salary (encoded in Teaching Load / synced
    // from the last payroll run); fall back to the rank-table rate.
    const totalUnpaidDays = hasData ? getTotalUnpaidDaysAll(emp.id, monthNum, year) : '';
    attEl.value = totalUnpaidDays;
    salEl.value = (parseFloat(emp.salary) || teacherRate(emp)) || '';
  } else {
    // Non-Teaching: auto-populate absences = unpaid leave + detected absences
    const totalUnpaidDays = hasData ? getTotalUnpaidDaysAll(emp.id, monthNum, year) : '';
    attEl.value = totalUnpaidDays;
    salEl.value = emp.salary || '';
  }
  cashEl.value = getEmpCashAdvance(emp.id) || '';
  empty.style.display = 'none';
  res.style.display = 'block';
  computePayroll();
  updateCalcStatusBadge();
  renderLeaveBreakdown(emp.id);
}

// Render leave breakdown for the selected employee and period
function renderLeaveBreakdown(empId) {
  const container = document.getElementById('leaveBreakdown');
  if (!container) return;

  const period = document.getElementById('payPeriod').value || 'December 2026';
  const [monthName, yearStr] = period.split(' ');
  const year = parseInt(yearStr) || 2026;
  const monthNum = MONTHS.indexOf(monthName) + 1;

  const { breakdown, totalPaidDays, totalUnpaidDays } = getLeaveBreakdown(empId, monthNum, year);
  const absentDays = getDetectedAbsences(empId, monthNum, year);
  const totalDly = totalUnpaidDays + absentDays;

  if (!periodHasData(empId, monthNum, year)) {
    container.style.display = 'block';
    container.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:4px 8px">📅 No attendance or leave records for ' + esc(monthName) + ' ' + year + '.</div>';
    return;
  }

  if (breakdown.length === 0 && totalDly === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const emp = users.find(u => u.id === empId);
  const isTeaching = emp && emp.classification === 'Teaching';
  // Per-day deduction value: Teaching = 8h × hourly rate; Non-Teaching = salary / WORK_DAYS.
  const isMonthly = emp && (!isTeaching || emp.schoolLevel === 'Elementary');
  const divisor = calcAbsenceWorkDays();
  const salaryInput = document.getElementById('calcSalary');
  const dayValue = isMonthly
    ? (divisor ? Math.max(0, parseFloat(salaryInput.value) || 0) / divisor : 0)
    : isTeaching
    ? (HOURS_PER_DAY * teacherRate(emp))
    : ((parseFloat(emp.salary) || 0) / WORK_DAYS);
  const totalDeduction = totalDly * dayValue;

  let html = '<div style="font-size:12px;font-weight:700;color:var(--maroon-dark);margin-bottom:8px">📅 LEAVE &amp; ATTENDANCE — ' + monthName + ' ' + year + '</div>';
  html += '<div style="display:flex;flex-wrap:wrap;gap:4px 8px">';

  breakdown.forEach(item => {
    const label = item.isPaid ? '(Paid)' : '(Unpaid)';
    const color = item.isPaid ? '#2E7D32' : '#C62828';
    const amount = item.isPaid ? '' : ' −' + fmt(item.days * dayValue);
    html += '<div style="display:inline-flex;align-items:baseline;gap:8px;font-size:12px;padding:4px 10px;background:' + (item.isPaid ? '#E8F5E9' : '#FFEBEE') + ';border-radius:6px;white-space:nowrap">';
    html += '<span><strong>' + esc(item.name) + '</strong> <span style="color:' + color + ';font-size:11px">' + label + '</span></span>';
    html += '<span style="color:' + color + ';font-weight:600">' + item.days + ' day' + (item.days > 1 ? 's' : '') + amount + '</span>';
    html += '</div>';
  });

  if (absentDays > 0) {
    html += '<div style="display:inline-flex;align-items:baseline;gap:8px;font-size:12px;padding:4px 10px;background:#FFF3E0;border-radius:6px;white-space:nowrap">';
    html += '<span><strong>🚫 Absent (no clock-in)</strong> <span style="color:#E65100;font-size:11px">(Unpaid)</span></span>';
    html += '<span style="color:#E65100;font-weight:600">' + absentDays + ' day' + (absentDays > 1 ? 's' : '') + ' −' + fmt(absentDays * dayValue) + '</span>';
    html += '</div>';
  }

  html += '</div>';
  html += '<div style="margin-top:8px;font-size:11px;color:var(--text-muted)">';
  html += 'Total: ' + (totalPaidDays > 0 ? '<span style="color:#2E7D32">' + totalPaidDays + ' paid</span>' : '');
  html += (totalPaidDays > 0 && totalDly > 0 ? ' · ' : '');
  html += (totalDly > 0 ? '<span style="color:#C62828">' + totalDly + ' unpaid</span>' : '');
  if (totalDly > 0) {
    html += ' → Deduction: <strong style="color:#C62828">' + fmt(totalDeduction) + '</strong>';
  }
  html += '</div>';

  container.innerHTML = html;
}

// Shows a warning badge when the selected employee already has a released
// payroll record for the current pay period, so the user knows confirming will overwrite it.
function updateCalcStatusBadge() {
  const badge = document.getElementById('calcStatusBadge');
  if (!badge) return;
  const id = parseInt(document.getElementById('calcEmp').value) || 0;
  const emp = users.find(u=>u.id===id);
  const period = document.getElementById('payPeriod').value || 'December 2026';
  const [monthName, yearStr] = period.split(' ');
  const year = parseInt(yearStr) || 2026;
  const monthNum = MONTHS.indexOf(monthName) + 1;
  const rec = payrollRecords.find(r=>r.empId===id && r.month===monthNum && r.year===year);
  if (emp && rec) {
    badge.style.display = 'block';
    badge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;background:#FFEBEE;border:1px solid #F5C6C6;color:#C62828;border-radius:8px;padding:8px 12px;font-size:12.5px;font-weight:600">✓ Already processed for <strong>${rec.period}</strong> — Net ${fmt(rec.net)} · Released ${rec.date}. Confirming will <u>overwrite</u> the existing record.</span>`;
  } else {
    badge.style.display = 'none';
    badge.innerHTML = '';
  }
}

// Holds the last computed payroll so "Confirm & Generate Payslip" can store it
let lastCalc = null;

// Active configurable bonus types (excl. statutory 13th month, id=1) applied to earnings.
// Defense-in-depth: legacy entries saved before the reserved-name rule
// (duplicates of "13th Month Pay") are ignored in every computation, even if
// they still exist in stored data or a stale cache. Months-of-Pay customs are
// 13th-month-style annual payouts: DECEMBER-ONLY (fail-closed when the period
// cannot be determined), computed as value × the employee's average monthly pay.
// Last calendar day of a payroll period string like "November 2026".
function periodEndDate(periodStr) {
  const parts = String(periodStr || '').trim().split(/\s+/);
  const m = MONTHS.indexOf(parts[0]);
  const y = parseInt(parts[1]);
  if (m < 0 || isNaN(y)) return null;
  return new Date(y, m + 1, 0);
}

function activeBonusTypes(emp, baseGross, periodEnd) {
  const isDecemberPeriod = !!periodEnd && periodEnd.getMonth() === 11;
  return bonusTypes
    .filter(b => {
      if (b.status !== 'Active') return false;
      // Months-of-Pay bonuses apply to December payroll runs only.
      if (b.kind === 'months' && !isDecemberPeriod) return false;
      // Give-date scheduling: a bonus with a release date only applies to
      // payroll periods ending on or after that date — and only once the
      // give date has arrived (future-scheduled bonuses are never included,
      // matching the "Scheduled / Active since" badge on Bonus Management).
      if (b.releaseDate && periodEnd) {
        const rd = parseDate(b.releaseDate);
        const now = new Date();
        if (!isNaN(rd) && (rd > periodEnd || rd > now)) return false;
      }
      // End-date expiry: a bonus never appears in payroll after its end date.
      if (b.endDate && periodEnd) {
        const ed = parseDate(b.endDate);
        if (!isNaN(ed) && periodEnd > ed) return false;
      }
      return true;
    })
    .map(b => {
      let amount = 0;
      if (b.kind === 'fixed')       amount = b.value;
      else if (b.kind === 'percent') amount = baseGross * (b.value / 100);
      else if (b.kind === 'months')  amount = avgMonthlyPay(emp) * b.value;
      return { name: b.name, amount: parseFloat(amount.toFixed(2)), deMinimis: !!b.deMinimis };
    })
    .filter(b => b.amount > 0);
}

// Splits active bonuses into taxable (subject to BIR + ₱90k pool + contributions)
// and de minimis (BIR RR 11-2018: exempt from tax & contributions, NOT in ₱90k pool)
function splitBonuses(bonuses) {
  const deMinimisSum = bonuses.filter(b => b.deMinimis).reduce((s, b) => s + b.amount, 0);
  const taxableSum   = bonuses.filter(b => !b.deMinimis).reduce((s, b) => s + b.amount, 0);
  return { deMinimisSum: parseFloat(deMinimisSum.toFixed(2)), taxableSum: parseFloat(taxableSum.toFixed(2)) };
}

function calcAbsenceWorkDays() {
  const input = document.getElementById('calcWorkDays');
  const days = input ? Number(input.value) : WORK_DAYS;
  return Number.isFinite(days) && days >= 1 && days <= 31 ? days : null;
}

function computePayroll() {
  const id = parseInt(document.getElementById('calcEmp').value);
  const emp = users.find(u=>u.id===id);
  if (!emp) return;
  recomputeCalcTotals();
  const isTeaching = emp.classification === 'Teaching';
  const rateEl = document.getElementById('calcSalary');
  const attEl = document.getElementById('calcAtt');
  const cashEl = document.getElementById('calcCash');
  const period = document.getElementById('payPeriod').value || 'December 2026';
  const [monthName, yearStr] = period.split(' ');
  const year = parseInt(yearStr) || 2026;
  const isDec = /^december/i.test(monthName);

  let gross = 0, meta = '';
  let subjectBreakdown = null;
  const group = currentCalcTab;
  const isExplTab = group === 'High School' || group === 'College / Graduate';
  const workDays = isExplTab ? null : calcAbsenceWorkDays();
  const workDaysError = document.getElementById('calcWorkDaysErr');
  if (workDaysError) workDaysError.style.display = !isExplTab && !workDays ? 'block' : 'none';
  if (!isExplTab && !workDays) {
    lastCalc = null;
    document.getElementById('calcResult').style.display = 'none';
    return;
  }
  document.getElementById('calcResult').style.display = 'block';
  if (isExplTab) {
    // Gross comes from the EXPLANATION editor rows.
    // High School: qty IS workloads (hrs/month ÷ HOURS_PER_WORKLOAD at
    // prefill time), paid at the rank table's per-workload rate — qty × rate.
    // College / Graduate: paid at teacherRate per hour.
    const R = teacherRate(emp);
    subjectBreakdown = [];
    let totalQty = 0, subjGross = 0;
    document.querySelectorAll('#calcSubjectBody tr').forEach(tr => {
      const qtyEl = tr.querySelector('.calc-qty');
      const rateEl = tr.querySelector('.calc-rate');
      const qty = Math.max(0, parseFloat(qtyEl ? qtyEl.value : '') || 0);
      const typedRate = parseFloat(rateEl ? rateEl.value : '');
      const rate = isNaN(typedRate) ? 0 : typedRate;
      const isIncr = tr.dataset.type === 'increment';
      const nameEl = tr.querySelector('input');
      const daysEl = tr.querySelector('.calc-days');
      const deptEl = tr.querySelector('.calc-dept');
      const lvEl = tr.querySelector('.calc-level-sel');
      const subject = isIncr ? 'Increment - S.Y' : (nameEl ? nameEl.value : '');
      const days = isIncr ? '' : (daysEl ? daysEl.value : '');
      const level = lvEl ? (lvEl.value || '') : '';
      const deptCode = isIncr ? '' : (deptEl ? deptEl.value.trim() : '');
      const amount = parseFloat((qty * rate).toFixed(2));
      subjectBreakdown.push({ type: isIncr ? 'increment' : 'subject', subject, days, level, deptCode, qty, rate, amount });
      subjGross += amount;
      totalQty += qty;
    });
    gross = parseFloat(subjGross.toFixed(2));
    const Rfmt = R.toLocaleString('en-PH',{minimumFractionDigits:2});
    meta = group === 'High School'
      ? `${totalQty} workload(s) × ₱${Rfmt} = ${fmt(gross)}`
      : `${totalQty} hrs × ₱${Rfmt} = ${fmt(gross)}`;
  } else if (isTeaching) {
    // Elementary: use the divisor entered for this payroll computation.
    const base = Math.max(0, parseFloat(rateEl.value) || 0);
    const a = Math.max(0, parseFloat(attEl.value) || 0);
    gross = Math.max(0, parseFloat((base - (a/workDays)*base).toFixed(2)));
    meta = `${fmt(base)} − (${a} ÷ ${workDays} × ${fmt(base)}) = ${fmt(gross)}`;
  } else {
    const base = Math.max(0, parseFloat(rateEl.value) || 0);
    const a = Math.max(0, parseFloat(attEl.value) || 0);
    gross = Math.max(0, parseFloat((base - (a/workDays)*base).toFixed(2)));
    meta = `${fmt(base)} − (${a} ÷ ${workDays} × ${fmt(base)}) = ${fmt(gross)}`;
  }
  const noteEl = document.getElementById('calcPayNote');
  const payNote = noteEl ? noteEl.value.trim() : '';

  // Active bonus types (excl. the statutory 13th month, id=1) are added to gross.
  // De minimis benefits (BIR RR 11-2018) are tax-exempt & excluded from the ₱90k pool and contributions.
  const bonuses = activeBonusTypes(emp, gross, periodEndDate(period));
  const { deMinimisSum, taxableSum } = splitBonuses(bonuses);
  const grossTaxable = gross + taxableSum;

  // 13th Month Pay (RA 8515) — automatic for the December payroll run, opt-out via checkbox
  const chk = document.getElementById('calc13th');
  const use13th = isDec && chk && chk.checked && isThirteenthActive();
  const el13 = thirteenthEligibility(emp, year);
  // Uses the salary/gross actually entered in the calculator, not the stored profile salary
  const thirteenth = use13th && el13.eligible ? computeThirteenth(emp, year, gross) : 0;
  // Real-world (RA 10963 / CREATE): 13th month pay is exempt only up to ₱90,000/yr.
  // The excess is added as one-time taxable income in the BIR annualization.
  // Only TAXABLE bonuses join the 13th month in the ₱90,000 exempt pool (de minimis is separate).
  const thirteenSplit = splitBonusTaxable(thirteenth, taxableSum);
  const cash = Math.max(0, parseFloat(cashEl.value) || 0);
  // Taxable 13th month excess is a one-time annual amount added to the BIR annualization
  const d = computeDeductions(grossTaxable, cash, 0, collectCustomOverrides());
  const tTax = thirteenthTaxSplit(d, grossTaxable, thirteenSplit.taxable13);
  // Annual BIR tax caused by the taxable 13th month excess (₱0 when fully exempt ≤₱90,000)
  const thirteenTaxAmt = tTax.annualTax;
  let note13 = '';
  if (isDec && use13th && !el13.eligible) {
    note13 = '<div style="font-size:12px;color:#C62828;margin-top:8px;background:#FFEBEE;border:1px solid #F5C6C6;border-radius:8px;padding:8px 10px">⚠️ '+emp.first+' <strong>rendered no service</strong> in '+year+', so no basic salary was earned — no 13th Month Pay under RA 8515 / DOLE.</div>';
  } else if (!isDec) {
    note13 = '<div style="font-size:12px;color:var(--text-muted);margin-top:8px;background:#F5F0EA;border:1px solid var(--border);border-radius:8px;padding:8px 10px">💡 13th Month Pay applies only to the <strong>December</strong> payroll run per RA 8515 / DOLE. Select December as the pay period to include it.</div>';
  } else if (thirteenSplit.taxable13 > 0) {
    note13 = '<div style="font-size:12px;color:#C62828;margin-top:8px;background:#FFEBEE;border:1px solid #F5C6C6;border-radius:8px;padding:8px 10px">⚠️ 13th Month Pay + taxable bonuses exceed the <strong>'+fmt(BONUS_EXEMPTION_LIMIT)+' annual exemption</strong> (RA 10963 / CREATE Act). Exempt: <strong>'+fmt(thirteenSplit.exempt13)+'</strong> · Taxable excess: <strong>'+fmt(thirteenSplit.taxable13)+'</strong><br>🧾 <strong>13th Month Excess Tax: '+fmt(thirteenTaxAmt)+'</strong> — this is withheld in full from your December 13th Month Pay.</div>';
  }

  const grossTotal = grossTaxable + deMinimisSum + thirteenth;
  const net = parseFloat((d.net + deMinimisSum + thirteenth - tTax.annualTax).toFixed(2));
  lastCalc = {
    empId: emp.id, name:`${emp.first} ${emp.last}`, month:MONTHS.indexOf(monthName)+1, monthName, year, period,
    gross: grossTaxable, deMinimisSum, thirteenth, thirteenTaxable: thirteenSplit.taxable13, thirteenExempt: thirteenSplit.exempt13, thirteenTax: tTax.annualTax, net, sss:d.sss, phil:d.phil, pag:d.pag, bir:d.bir, cash, bonuses,
    salaryBase: Math.max(0, parseFloat(rateEl.value) || 0),
    absenceWorkDays: workDays,
    absenceDays: isExplTab ? null : Math.max(0, parseFloat(attEl.value) || 0),
    customDeds: d.custom, customTotal: d.customTotal,
    subjectBreakdown, payNote,
    teachingSemester: isExplTab ? document.getElementById('calcSemester').value : null,
    teachingSchoolYear: isExplTab ? document.getElementById('calcSchoolYear').value : null
  };
  renderLeaveBreakdown(emp.id);

  let earningsHtml = '';
  if (isExplTab && subjectBreakdown && subjectBreakdown.length) {
    subjectBreakdown.forEach(b => {
      const isIncr = b.type === 'increment';
      const lvlTag = (!isIncr && b.level) ? ' <span style="display:inline-block;padding:1px 7px;border-radius:10px;background:var(--gold-pale);color:var(--maroon-dark);font-size:11px;font-weight:700;border:1px solid var(--gold)">' + esc(b.level) + '</span>' : '';
      const label = (isIncr ? '📈 Increment - S.Y' : '📚 ' + esc(b.subject || '')) + lvlTag;
      const qtyLabel = (group === 'High School' && !isIncr)
        ? b.qty + ' workload(s)' + (b.days ? ' · ' + esc(b.days) : '')
        : b.qty + ' hrs' + (b.days && !isIncr ? ' · ' + esc(b.days) : '');
      earningsHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">' + label + ' — ' + qtyLabel + ' × ' + fmt(b.rate) + '</span><span style="font-weight:600">+' + fmt(b.amount) + '</span></div>';
    });
    earningsHtml += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">Gross from Subjects</span><span style="font-weight:600">' + fmt(gross) + '</span></div>';
  } else {
    const isElem = group === 'Elementary';
    const label1 = isElem ? 'Monthly Salary − Absences' : (emp.classification==='Teaching' ? 'Hours Worked × Rate' : 'Monthly Base Salary');
    const label2 = isElem ? 'Monthly Earnings' : (emp.classification==='Teaching' ? 'Hourly Earnings' : 'Base Salary');
    earningsHtml =
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">' + label1 + '</span><span style="font-weight:600">' + meta + '</span></div>' +
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">' + label2 + '</span><span style="font-weight:600">' + fmt(gross) + '</span></div>';
  }

  document.getElementById('calcEarnings').innerHTML = `
    ${earningsHtml}
    ${bonuses.map(b=>'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">🎁 '+esc(b.name)+' <span style="font-size:11px;color:'+(b.deMinimis?'#2E7D32':'var(--text-muted)')+'">— '+(b.deMinimis?'de minimis (tax-exempt)':'taxable bonus')+'</span></span><span style="font-weight:600">+'+fmt(b.amount)+'</span></div>').join('')}
    ${thirteenth>0 ? '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">🎁 13th Month Pay (RA 8515) <span style="font-size:11px;color:#2E7D32">— exempt up to '+fmt(BONUS_EXEMPTION_LIMIT)+'/yr</span></span><span style="font-weight:700;color:var(--maroon-dark)">+'+fmt(thirteenSplit.exempt13)+'</span></div>' : ''}
    ${thirteenth>0 && thirteenSplit.taxable13>0 ? '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">⚠️ 13th Month excess <span style="font-size:11px;color:#C62828">— taxable (over '+fmt(BONUS_EXEMPTION_LIMIT)+')</span></span><span style="font-weight:600;color:#C62828">+'+fmt(thirteenSplit.taxable13)+'</span></div>' : ''}
    ${note13}`;
  document.getElementById('rBasic').textContent = fmt(grossTotal);
  document.getElementById('rSSS').textContent = fmt(d.sss);
  document.getElementById('rPhil').textContent = fmt(d.phil);
  document.getElementById('rPag').textContent = fmt(d.pag);
  document.getElementById('rBIR').textContent = fmt(d.bir);
  const r13Row = document.getElementById('r13TaxRow');
  if (r13Row) {
    r13Row.style.display = tTax.annualTax > 0 ? 'flex' : 'none';
    document.getElementById('r13Tax').textContent = fmt(tTax.annualTax);
  }
  document.getElementById('rCash').textContent = fmt(d.cash);
  const rCustom = document.getElementById('rCustomRows');
  if (rCustom) {
    const visibleDeductions = d.custom.slice();
    if (!visibleDeductions.some(x => String(x.name).trim().toUpperCase() === 'PERAA')) {
      visibleDeductions.unshift({ name: 'PERAA', amount: 0 });
    }
    rCustom.innerHTML = visibleDeductions.map(x =>
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F5F0EA;font-size:13.5px"><span style="color:var(--text-muted)">📌 ' + esc(x.name) + '</span><span style="font-weight:600;color:#C62828">' + fmt(x.amount) + '</span></div>'
    ).join('');
  }
  document.getElementById('rTotDed').textContent = fmt(d.sss + d.phil + d.pag + d.bir + d.cash + d.customTotal + tTax.annualTax);
  document.getElementById('rNetPay').textContent = fmt(net);
}

function confirmPayroll() {
  if (!lastCalc || !users.find(u=>u.id===lastCalc.empId)) { showToast('⚠️','Select an employee and compute the payroll first.'); return; }
  const rec = Object.assign({}, lastCalc, {
    date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
  });
  const existing = payrollRecords.find(r=>r.empId===rec.empId && r.month===rec.month && r.year===rec.year);
  if (existing) {
    document.getElementById('confirmIcon').textContent = '⚠️';
    document.getElementById('confirmMsg').innerHTML =
      `<strong>${esc(rec.name)}</strong> already has a released payroll for <strong>${rec.period}</strong> (Net ${fmt(existing.net)} · Released ${existing.date}).<br><br>` +
      `Confirming will <strong style="color:#C62828">overwrite</strong> this record and its payslip with the new computation (Net ${fmt(rec.net)}). Continue?`;
    document.getElementById('confirmActionBtn').onclick = () => { closeModal('confirmModal'); doSavePayroll(rec, existing); };
    document.getElementById('confirmModal').classList.add('show');
    return;
  }
  doSavePayroll(rec, null);
}

async function doSavePayroll(rec, existing) {
  if (existing) Object.assign(existing, rec);
  else payrollRecords.push(rec);
  // Elementary: the calculator's Monthly Salary input is authoritative —
  // sync it to the profile so TL prefill / summary / bonuses all agree.
  const syncEmp = users.find(u => u.id === rec.empId);
  if (syncEmp && syncEmp.classification === 'Teaching' && syncEmp.schoolLevel === 'Elementary' &&
      (parseFloat(rec.salaryBase) || 0) > 0) {
    syncEmp.salary = parseFloat(rec.salaryBase);
  }
  // One-time deduction semantics: the cash advance is consumed by this
  // payroll run — clear it so it is not deducted again in the next period.
  if ((parseFloat(rec.cash) || 0) > 0) cashAdvances[rec.empId] = 0;
  if (!await saveDemo()) return;
  renderPayrollSummary();
  updateCalcStatusBadge();
  const thirteenthMsg = rec.thirteenth > 0 ? ' — includes 13th Month Pay (RA 8515)' : '';
  showToast('✅',`${rec.name} payroll computed and payslip generated — ${rec.period} · Net Pay ${fmt(rec.net)}${thirteenthMsg}`);
}

function renderPayrollSummary() {
  const tbody = document.getElementById('payrollSummaryBody');
  if (!tbody) return;
  const period = document.getElementById('payPeriod').value || 'December 2026';
  const [monthName, yearStr] = period.split(' ');
  const year = parseInt(yearStr) || 2026;
  const monthNum = MONTHS.indexOf(monthName) + 1;
  const isDec = /^december/i.test(monthName);
  const titleEl = document.getElementById('payrollSummaryTitle');
  if (titleEl) titleEl.textContent = `📋 Payroll Summary — ${period}`;
  const emps = users.filter(u=>u.status==='Active' && (u.role==='Employee'||u.role==='Finance Officer'||u.role==='System Admin'));
  const summaryTable = tbody.closest('table');
  const loadTh = summaryTable ? summaryTable.querySelector('thead th:nth-child(3)') : null;
  if (loadTh) loadTh.textContent = 'Load / Salary';
  tbody.innerHTML = emps.map(emp => {
    const base = empGrossPay(emp);
    // Per-level load column: Workloads (HS), Hours (College/Grad), Monthly (Elementary), Salary (NT)
    let loadValue;
    if (emp.classification !== 'Teaching') loadValue = fmt(base);
    else if (emp.schoolLevel === 'Elementary') loadValue = fmt(base) + '/mo';
    else if (emp.schoolLevel === 'High School') loadValue = ((emp.hoursWorked || 0) / HOURS_PER_WORKLOAD) + ' wl';
    else loadValue = (emp.hoursWorked || 0) + ' hrs';
    const typeLabel = emp.classification === 'Teaching' ? (emp.schoolLevel || 'Teaching') : 'Non-Teaching';
    const bonuses = activeBonusTypes(emp, base, periodEndDate(period));
    const { deMinimisSum, taxableSum } = splitBonuses(bonuses);
    const gross = base + taxableSum;
    const thirteenth = isDec && isThirteenthActive() && thirteenthEligibility(emp, year).eligible ? computeThirteenth(emp, year) : 0;
    const taxable13 = splitBonusTaxable(thirteenth, taxableSum).taxable13;
    const d = computeDeductions(gross, getEmpCashAdvance(emp.id), 0);
    const tTax = thirteenthTaxSplit(d, gross, taxable13);
    const rec = payrollRecords.find(r=>r.empId===emp.id && r.month===monthNum && r.year===year);
    const status = rec
      ? `<span class="badge b-green">✓ Released ${rec.date}</span>`
      : '<span class="badge b-yellow">Pending</span>';
    const grossTotal = gross + deMinimisSum + thirteenth;
    const net = d.net + deMinimisSum + thirteenth - tTax.annualTax;
    const thirteenCell = tTax.annualTax > 0
      ? `<span style="color:#C62828;font-weight:600" title="13th Month Excess Tax — withheld from the 13th Month Pay">${fmt(tTax.annualTax)}</span>`
      : '<span style="color:#BBB">—</span>';
    const bonusCell = bonuses.length
      ? '<span style="color:#2E7D32;font-weight:600" title="'+esc(bonuses.map(b=>b.name+': +'+fmt(b.amount)+(b.deMinimis?' (de minimis)':'')).join('\n'))+'">+'+fmt(taxableSum+deMinimisSum)+'</span>'
      : '<span style="color:#BBB">—</span>';
    return `<tr>
      <td><strong>${esc(displayName(emp))}</strong></td>
      <td><span class="badge ${EMP_CLASS[emp.classification].badge}">${typeLabel}</span></td>
      <td>${loadValue}</td>
      <td>${fmt(grossTotal)}${thirteenth>0?' <span class="badge b-gold" style="font-size:9px">🎁 13th</span>':''}${taxableSum>0?` <span class="badge b-gold" style="font-size:9px">+bonus</span>`:''}${deMinimisSum>0?` <span class="badge b-green" style="font-size:9px">+de minimis</span>`:''}</td>
      <td>${bonusCell}</td>
      <td>${fmt(d.sss)}</td>
      <td>${fmt(d.phil)}</td>
      <td>${fmt(d.pag)}</td>
      <td>${fmt(d.bir)}</td>
      <td>${thirteenCell}</td>
      <td>${d.cash>0 ? '<span style="color:#C62828;font-weight:600">'+fmt(d.cash)+'</span>' : '—'}</td>
      <td>${d.customTotal>0 ? '<span style="color:#C62828;font-weight:600" title="'+esc(d.custom.map(x=>x.name+': '+fmt(x.amount)).join('  ·  '))+'">'+fmt(d.customTotal)+'</span>' : '—'}</td>
      <td><strong style="color:var(--maroon-dark)">${fmt(net)}</strong></td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Finance dashboard: recent payroll activity rendered live from active employees
// and the confirmed payroll records for the current pay period.
function renderFinRecentActivity() {
  const tbody = document.getElementById('finRecentActivityBody');
  if (!tbody) return;
  const period = document.getElementById('payPeriod')?.value || 'December 2026';
  const [monthName, yearStr] = period.split(' ');
  const year = parseInt(yearStr) || 2026;
  const monthNum = MONTHS.indexOf(monthName) + 1;
  const isDec = /^december/i.test(monthName);
  const emps = users.filter(u=>u.status==='Active' && (u.role==='Employee'||u.role==='Finance Officer'||u.role==='System Admin'));
  const pending = emps.filter(emp=>!payrollRecords.find(r=>r.empId===emp.id && r.month===monthNum && r.year===year)).length;
  const pe = document.getElementById('finPending'); if (pe) pe.textContent = pending;
  if (!emps.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">No active employees yet.</td></tr>';
    return;
  }
  tbody.innerHTML = emps.map(emp => {
    const base = empGrossPay(emp);
    const bonuses = activeBonusTypes(emp, base, periodEndDate(period));
    const { deMinimisSum, taxableSum } = splitBonuses(bonuses);
    const gross = base + taxableSum;
    const thirteenth = isDec && isThirteenthActive() && thirteenthEligibility(emp, year).eligible ? computeThirteenth(emp, year) : 0;
    const taxable13 = splitBonusTaxable(thirteenth, taxableSum).taxable13;
    const d = computeDeductions(gross, getEmpCashAdvance(emp.id), 0);
    const tTax = thirteenthTaxSplit(d, gross, taxable13);
    const rec = payrollRecords.find(r=>r.empId===emp.id && r.month===monthNum && r.year===year);
    const net = d.net + deMinimisSum + thirteenth - tTax.annualTax;
    return `<tr>
      <td><strong>${esc(displayName(emp))}</strong></td>
      <td>${rec ? rec.period : period}</td>
      <td><strong style="color:var(--maroon-dark)">${fmt(net)}</strong></td>
      <td>${rec ? '<span class="badge b-green">✅ Released</span>' : '<span class="badge b-yellow">⏳ Pending</span>'}</td>
    </tr>`;
  }).join('');
}

// Payroll records for a given period — only CONFIRMED/released runs are reported,
// using the exact values stored at the time of release (not recomputed).
function getPayrollRecords(monthNum, yearNum) {
  return payrollRecords
    .filter(r => r.month === monthNum && r.year === yearNum)
    .map(rec => ({
      empId:  rec.empId,
      name:   rec.name,
      month:  rec.month,
      year:   rec.year,
      gross:  parseFloat(rec.gross) + (parseFloat(rec.deMinimisSum) || 0) + (parseFloat(rec.thirteenth) || 0),
      bonuses: Array.isArray(rec.bonuses) ? rec.bonuses : [],
      sss:    rec.sss,
      phil:   rec.phil,
      pag:    rec.pag,
      bir:    rec.bir,
      thirteenTax: parseFloat(rec.thirteenTax) || 0,
      net:    rec.net,
      status: 'Released'
    }));
}

// Months that have confirmed payroll records for a given year.
function reportMonthsFor(year) {
  return [...new Set(
    payrollRecords.filter(r => r.year === year).map(r => r.month)
  )].sort((a, b) => a - b);
}

// Confirmed payroll records for a given user + year, shaped for the payslip view.
// Uses the exact values stored at the time of release (not recomputed).
function payslipRecordsFor(userId, year) {
  return payrollRecords
    .filter(r => r.empId === userId && r.year === year)
    .sort((a, b) => a.month - b.month)
    .map(rec => ({
      monthNum:   rec.month,
      month:      MONTHS[rec.month - 1] || '',
      year:       rec.year,
      period:     `${MONTHS[rec.month - 1]} ${rec.year}`,
      gross:      parseFloat(rec.gross) + (parseFloat(rec.deMinimisSum) || 0) + (parseFloat(rec.thirteenth) || 0),
      deMinimis:  parseFloat(rec.deMinimisSum) || 0,
      bonuses:    Array.isArray(rec.bonuses) ? rec.bonuses : [],
      thirteenth: parseFloat(rec.thirteenth) || 0,
      exempt13:   parseFloat(rec.thirteenExempt) || 0,
      taxable13:  parseFloat(rec.thirteenTaxable) || 0,
      thirteenTax:parseFloat(rec.thirteenTax) || 0,
      sss:  rec.sss,
      phil: rec.phil,
      pag:  rec.pag,
      bir:  rec.bir,
      cash: parseFloat(rec.cash) || 0,
      customDeds: Array.isArray(rec.customDeds) ? rec.customDeds : [],
      customTotal: (Array.isArray(rec.customDeds) ? rec.customDeds : []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0),
      net:  rec.net,
      status: 'Released'
    }));
}

// Years that have confirmed payroll records for a given user.
function payslipYearsFor(userId) {
  return [...new Set(
    payrollRecords.filter(r => r.empId === userId).map(r => r.year)
  )].sort((a, b) => a - b);
}

function showMonthReport(monthNum, year, monthName) {
  const out = document.getElementById('reportOutput');
  out.style.display = 'block';
  out.scrollIntoView({behavior:'smooth'});
  document.getElementById('reportTitle').textContent = `Payroll Summary Report — ${monthName} ${year}`;
  document.getElementById('rptHead').innerHTML = `<tr>
    <th>EMPLOYEE</th><th>TYPE</th><th>GROSS PAY</th><th>BONUS</th><th>SSS</th>
    <th>PHILHEALTH</th><th>PAG-IBIG</th><th>BIR</th><th>NET PAY</th><th>STATUS</th>
  </tr>`;

  const employees = users.filter(u => u.salary > 0 && u.status === 'Active');
  if (!employees.length) {
    document.getElementById('rptBody').innerHTML = '';
    document.getElementById('rptEmpty').style.display = 'block';
    document.getElementById('rptTotals').innerHTML = '';
    return;
  }
  document.getElementById('rptEmpty').style.display = 'none';

  const records = getPayrollRecords(monthNum, year);
  const rows = records.filter(r => employees.some(u => u.id === r.empId));
  if (!rows.length) {
    document.getElementById('rptBody').innerHTML = '';
    document.getElementById('rptEmpty').style.display = 'block';
    document.getElementById('rptTotals').innerHTML = '';
    return;
  }
  document.getElementById('rptEmpty').style.display = 'none';
  let tGross=0, tBonus=0, tSSS=0, tPhil=0, tPag=0, tBIR=0, tNet=0;
  document.getElementById('rptBody').innerHTML = rows.map(r => {
    const emp = employees.find(u => u.id === r.empId);
    const birTotal = r.bir + (r.thirteenTax || 0);
    const recBonuses = Array.isArray(r.bonuses) ? r.bonuses : [];
    const bTotal = recBonuses.reduce((s,b)=>s+(parseFloat(b.amount)||0),0);
    const bonusCell = bTotal > 0
      ? '<span style="color:#2E7D32;font-weight:600" title="'+esc(recBonuses.map(b=>b.name+': +'+fmt(b.amount)).join('\n'))+'">+'+fmt(bTotal)+'</span>'
      : '<span style="color:#BBB">—</span>';
    tGross+=r.gross; tBonus+=bTotal; tSSS+=r.sss; tPhil+=r.phil;
    tPag+=r.pag; tBIR+=birTotal; tNet+=r.net;
    return `<tr>
      <td><strong>${emp ? esc(displayName(emp)) : esc(r.name)}</strong></td>
      <td><span class="badge ${EMP_CLASS[emp?.classification]?.badge||'b-gray'}">${emp?.classification||'Non-Teaching'}</span></td>
      <td>${fmt(r.gross)}</td>
      <td>${bonusCell}</td>
      <td>${fmt(r.sss)}</td>
      <td>${fmt(r.phil)}</td>
      <td>${fmt(r.pag)}</td>
      <td>${fmt(birTotal)}</td>
      <td><strong style="color:var(--maroon-dark)">${fmt(r.net)}</strong></td>
      <td><span class="badge b-green">Released</span></td>
    </tr>`;
  }).join('');

  document.getElementById('rptTotals').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:13px">
      <span><strong>Total Gross:</strong> ${fmt(tGross)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total Bonus:</strong> ${fmt(tBonus)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total SSS:</strong> ${fmt(tSSS)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total PhilHealth:</strong> ${fmt(tPhil)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total Pag-IBIG:</strong> ${fmt(tPag)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total BIR:</strong> ${fmt(tBIR)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total Deductions:</strong> ${fmt(tSSS+tPhil+tPag+tBIR)}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Total Net Pay: <span style="color:var(--maroon-dark)">${fmt(tNet)}</span></strong></span>
    </div>`;
}

function showYearReport(year) {
  const out = document.getElementById('reportOutput');
  out.style.display = 'block';
  out.scrollIntoView({behavior:'smooth'});

  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTHS_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const dataMonths = reportMonthsFor(year);

  document.getElementById('reportTitle').textContent = `Payroll Summary Report — Full Year ${year}`;
  document.getElementById('rptHead').innerHTML = `<tr>
    <th>EMPLOYEE</th>
    ${MONTHS_SHORT.map((m, i) => {
      const hasMonth = dataMonths.includes(i + 1);
      return `<th style="color:${hasMonth ? 'inherit' : '#BBB'}">${m}</th>`;
    }).join('')}
    <th>TOTAL NET PAY</th>
  </tr>`;

  const employees = users.filter(u => u.salary > 0 && u.status === 'Active');

  if (!employees.length || !dataMonths.length) {
    document.getElementById('rptBody').innerHTML = '';
    document.getElementById('rptEmpty').style.display = 'block';
    document.getElementById('rptTotals').innerHTML = '';
    return;
  }
  document.getElementById('rptEmpty').style.display = 'none';

  const recordsByMonth = {};
  dataMonths.forEach(monthNum => {
    recordsByMonth[monthNum] = getPayrollRecords(monthNum, year);
  });

  let grandYTD = 0;
  document.getElementById('rptBody').innerHTML = employees.map(emp => {
    let empYTD = 0;
    const monthlyCells = MONTHS_SHORT.map((m, i) => {
      const monthNum = i + 1;
      const rec = (recordsByMonth[monthNum] || []).find(r => r.empId === emp.id);
      if (rec) {
        empYTD += rec.net;
        return `<td style="font-size:12px">${fmt(rec.net)}</td>`;
      }
      return `<td style="font-size:12px;color:#CCC">—</td>`;
    }).join('');
    grandYTD += empYTD;
    return `<tr>
      <td>
        <strong>${emp.first} ${emp.last}</strong><br/>
        <span style="font-size:11px;color:#999">${emp.role}</span>
      </td>
      ${monthlyCells}
      <td><strong style="color:var(--maroon-dark)">${fmt(empYTD)}</strong></td>
    </tr>`;
  }).join('');

  const processedCount = dataMonths.length;
  const monthNames = dataMonths.map(n => MONTHS_FULL[n - 1]);
  const isComplete = processedCount === 12;
  const netLabel = isComplete
    ? 'Annual Net Pay'
    : `Total Net Pay (${monthNames.join(', ')} ${year})`;
  document.getElementById('rptTotals').innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:13px;align-items:center">
      <span><strong>Year:</strong> ${year}</span>
      <span style="color:#CCC">|</span>
      <span><strong>Months Processed:</strong>
        <span style="color:var(--maroon-dark)">${processedCount}</span>
        <span style="color:#AAA"> / 12</span>
      </span>
      <span style="color:#CCC">|</span>
      <span><strong>Total Employees:</strong> ${employees.length}</span>
      <span style="color:#CCC">|</span>
      <span><strong>${netLabel}:
        <span style="color:var(--maroon-dark)">${fmt(grandYTD)}</span>
      </strong></span>
      ${!isComplete ? `
        <span style="color:#CCC">|</span>
        <span style="color:#888;font-style:italic">${12 - processedCount} months remaining</span>
      ` : ''}
    </div>`;
}
