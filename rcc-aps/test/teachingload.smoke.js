// Smoke test: tlCompute (5 levels), tlParseTimeRange, tlDefaultSY
const fs = require('fs'), vm = require('vm');

global._savedDemo = {};
global.WORK_DAYS = 22;
global.HOURS_PER_WORKLOAD = 3;
global.fmt = n => 'P' + Number(n).toFixed(2);
global.teacherRate = emp => emp.__rate;
global.rateUnit = lvl => 'per Hour';

vm.runInThisContext(
  fs.readFileSync(__dirname + '/../public/js/teachingload.js', 'utf8'),
  { filename: 'teachingload.js' }
);

let pass = 0, fail = 0;
const eq = (name, got, want, tol) => {
  const ok = (tol != null) ? Math.abs(got - want) <= tol : got === want;
  ok ? pass++ : fail++;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  got=' + got + (ok ? '' : '  want=' + want));
};

const NT   = { classification: 'Non-Teaching', salary: 18000 };
const ELEM = { classification: 'Teaching', schoolLevel: 'Elementary', __rate: 14000 };
const HS   = { classification: 'Teaching', schoolLevel: 'High School', __rate: 500 };
const COL  = { classification: 'Teaching', schoolLevel: 'College',     __rate: 190 };
const GRAD = { classification: 'Teaching', schoolLevel: 'Graduate School', __rate: 230 };

// 1) Non-Teaching: 18000 - (3/22)*18000 = 15545.45
let c = tlCompute(NT, 0, 3);
eq('NT pay', c.pay, 15545.45, 0.01);
eq('NT workloadType', c.workloadType, 'absences');
eq('NT absences kept', c.absences, 3);

// 2) Elementary: 14000 - (2/22)*14000 = 12727.27
c = tlCompute(ELEM, 0, 2);
eq('ELEM pay', c.pay, 12727.27, 0.01);
eq('ELEM workloadType', c.workloadType, 'absences');

// 3) High School: 10h/wk * 4.4wk = 44h ÷ 3 = 14.6667wl * 500 = 7333.33
c = tlCompute(HS, 10, 0);
eq('HS pay', c.pay, 7333.33, 0.01);
eq('HS workloadType', c.workloadType, 'hours');
eq('HS workloadValue', c.workloadValue, 10);

// 4) College: 44h * 190 = 8360
c = tlCompute(COL, 10, 0);
eq('COL pay', c.pay, 8360, 0.01);

// 5) Grad: 44h * 230 = 10120
c = tlCompute(GRAD, 10, 0);
eq('GRAD pay', c.pay, 10120, 0.01);

// 6) Negative/zero guards
eq('NT floor at 0', tlCompute(NT, 0, 999).pay, 0);
eq('empty emp -> NT-like', tlCompute(null, 0, 0).workloadType, 'absences');

// 7) Configurable HPW: 1 workload = 4 hrs
global.HOURS_PER_WORKLOAD = 4;
c = tlCompute(HS, 10, 0);
eq('HS pay with HPW=4', c.pay, 44 / 4 * 500, 0.01);
global.HOURS_PER_WORKLOAD = 3;

// 8) Configurable workDays
global.WORK_DAYS = 20;
eq('NT pay WD=20', tlCompute(NT, 0, 4).pay, 18000 - (4 / 20) * 18000, 0.01);
eq('weeks uses WD/5', tlCompute(COL, 10, 0).formulaText.includes('4.0 weeks'), true);
global.WORK_DAYS = 22;

// 9) Time parser
eq('parse 2:30p-4:00p', tlParseTimeRange('2:30p-4:00p').hours, 1.5);
eq('parse 2:30PM-4:00PM', tlParseTimeRange('2:30PM-4:00PM').hours, 1.5);
eq('parse 14:00-16:00', tlParseTimeRange('14:00-16:00').hours, 2);
eq('parse 8:00a-12:00p', tlParseTimeRange('8:00a-12:00p').hours, 4);
eq('parse overnight 10:00p-2:00a', tlParseTimeRange('10:00p-2:00a').hours, 4);
eq('parse garbage -> null', tlParseTimeRange('abc'), null);

// 10) Default SY: today Oct 2026 (month>=6) -> 2026-2027
eq('tlDefaultSY', tlDefaultSY(), '2026-2027');

// 11) Level helpers
eq('tlLevelOf NT', tlLevelOf(NT), 'Non-Teaching');
eq('tlLevelOf unset -> College', tlLevelOf({ classification: 'Teaching' }), 'College');
eq('tlUnitOf NT -> per Month', tlUnitOf(NT), 'per Month');
eq('tlUnitOf Teaching -> per Hour', tlUnitOf(HS), 'per Hour');
eq('tlRateOf NT salary', tlRateOf(NT), 18000);

// 12) Non-Teaching exclusion (sidebar/list filter logic)
eq('tlIsNT Teaching -> false', tlIsNT({ classification: 'Teaching' }), false);
eq('tlIsNT Non-Teaching -> true', tlIsNT({ classification: 'Non-Teaching' }), true);
eq('tlIsNT null -> true', tlIsNT(null), true);
eq('tlIsNT missing classification -> true', tlIsNT({}), true);
const mixed = [{ classification: 'Teaching' }, { classification: 'Non-Teaching' }, { classification: 'Teaching' }];
eq('filter keeps Teaching only', mixed.filter(u => !tlIsNT(u)).length, 2);

// 13) latestTeachingLoads — extracted from payroll.js (calculator prefill)
const payrollSrc = fs.readFileSync(__dirname + '/../public/js/payroll.js', 'utf8');
const fnMatch = payrollSrc.match(/function latestTeachingLoads[\s\S]*?\n}/);
eq('latestTeachingLoads exists in payroll.js', !!fnMatch, true);
eq('payroll.js no longer calls deleted sheetsFor', /sheetsFor|loadsForSheet/.test(payrollSrc), false);
if (fnMatch) {
  // Assign into the shared global lexical scope (where teachingload.js
  // declared these via `let`) — plain global.X would be shadowed.
  vm.runInThisContext(
    'teachingLoadRecords = [' +
    '{ id: 1, empId: 3, semester: "1st", schoolYear: "2025-2026" },' +
    '{ id: 2, empId: 3, semester: "2nd", schoolYear: "2026-2027" },' +
    '{ id: 3, empId: 4, semester: "Summer", schoolYear: "2026-2027" }' +
    '];' +
    'teachingLoadClasses = [' +
    '{ id: 1, recordId: 1, subject: "Old Subject", days: "M", hoursPerWeek: 10 },' +
    '{ id: 2, recordId: 2, subject: "Web Systems", deptCode: "CCS", level: "College", days: "MWF", hoursPerWeek: 3 },' +
    '{ id: 3, recordId: 2, subject: "Capstone", level: "Graduate School", days: "F", hoursPerWeek: 1.5 },' +
    '{ id: 4, recordId: 99, subject: "Ghost", days: "", hoursPerWeek: 5 },' +
    '{ id: 5, recordId: 3, subject: "Summer Class", days: "M", hoursPerWeek: 2 }' +
    '];'
  );
  eval(fnMatch[0]);
  const rows = latestTeachingLoads(3);
  eq('TL prefill row count', rows.length, 2);
  eq('TL prefill latest subject', rows[0] && rows[0].subject, 'Web Systems');
  eq('TL prefill days kept', rows[0] && rows[0].days, 'MWF');
  eq('TL prefill subject department kept', rows[0] && rows[0].deptCode, 'CCS');
  eq('TL prefill qty 3h/wk×4.4wk', rows[0] && rows[0].qty, 13.2);
  eq('TL prefill qty 1.5h/wk×4.4wk', rows[1] && rows[1].qty, 6.6);
  eq('TL prefill wlQty 13.2h÷3', rows[0] && rows[0].wlQty, 4.4);
  eq('TL prefill wlQty 6.6h÷3', rows[1] && rows[1].wlQty, 2.2);
  eq('College imported amount matches Teaching Load', Number((rows[0].qty * COL.__rate).toFixed(2)), tlCompute(COL, 3, 0).pay);
  eq('HS imported amount matches Teaching Load', Number((rows[0].wlQty * HS.__rate).toFixed(2)), tlCompute(HS, 3, 0).pay);
  global.WORK_DAYS = 21.5;
  global.HOURS_PER_WORKLOAD = 7;
  const fractional = latestTeachingLoads(3);
  eq('fractional monthly hours kept', fractional[1].qty, 6.45);
  eq('fractional HS workload kept', fractional[1].wlQty, 6.45 / 7, 1e-12);
  eq('fractional College pay matches Teaching Load', Number((fractional[1].qty * COL.__rate).toFixed(2)), tlCompute(COL, 1.5, 0).pay);
  eq('fractional HS pay matches Teaching Load', Number((fractional[1].wlQty * HS.__rate).toFixed(2)), tlCompute(HS, 1.5, 0).pay);
  global.WORK_DAYS = 22;
  global.HOURS_PER_WORKLOAD = 3;
  eq('TL prefill carries level (College)', rows[0] && rows[0].level, 'College');
  eq('TL prefill carries level (Grad)', rows[1] && rows[1].level, 'Graduate School');
  eq('TL prefill no record -> []', latestTeachingLoads(999).length, 0);
  eq('selected 2nd semester loads subjects', latestTeachingLoads(3, '2nd', '2026-2027')[0].subject, 'Web Systems');
  eq('selected old school year loads its schedule', latestTeachingLoads(3, '1st', '2025-2026')[0].subject, 'Old Subject');
  eq('missing semester never falls back', latestTeachingLoads(3, 'Summer', '2026-2027').length, 0);
  eq('missing school year never falls back', latestTeachingLoads(3, '2nd', '2027-2028').length, 0);
  eq('Summer loads matching schedule', latestTeachingLoads(4, 'Summer', '2026-2027')[0].subject, 'Summer Class');
  eq('employee schedules stay separate', latestTeachingLoads(3, 'Summer', '2026-2027').length, 0);
}

// 14) tlDaysParse / tlDaysFormat — days popover parser
eq('days "MWF" -> 3 codes', tlDaysParse('MWF').join(','), 'M,W,F');
eq('days "M, W" -> 2 codes', tlDaysParse('M, W').join(','), 'M,W');
eq('days "TTH" -> T,Th', tlDaysParse('TTH').join(','), 'T,Th');
eq('days "Thursday" -> Th', tlDaysParse('Thursday').join(','), 'Th');
eq('days canonical order "F,M"', tlDaysParse('F,M').join(','), 'M,F');
eq('days empty -> 0', tlDaysParse('').length, 0);
eq('days null -> 0', tlDaysParse(null).length, 0);
eq('days format "M, W"', tlDaysFormat(['W', 'M']), 'M, W');

console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed  ' + (fail ? '❌' : '✅'));
process.exit(fail ? 1 : 0);
