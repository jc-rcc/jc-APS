const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const source = fs.readFileSync(__dirname + '/../public/js/payroll.js', 'utf8');
const subjectRate = { value: '150' };
const incrementRate = { value: '25' };
const rows = [
  { dataset: { type: 'subject' }, querySelector: () => subjectRate },
  { dataset: { type: 'increment' }, querySelector: () => incrementRate }
];
const selected = { value: '3' }, salary = {};
const elements = { calcEmp: selected, calcSalary: salary, calcSubjectBody: { querySelectorAll: () => rows } };
const employee = { id: 3, classification: 'Teaching', rankRate: 310 };
const context = vm.createContext({
  users: [employee], currentCalcTab: 'College / Graduate',
  teacherRate: emp => emp.rankRate,
  document: { getElementById: id => elements[id] || null }
});
vm.runInContext(source.match(/function syncCalcRankRates[\s\S]*?\n}/)[0], context);
vm.runInContext('syncCalcRankRates()', context);
assert.equal(subjectRate.value, '310.00');
assert.equal(subjectRate.readOnly, true);
assert.equal(salary.value, 310);
assert.equal(incrementRate.value, '25');
employee.rankRate = 420;
vm.runInContext('syncCalcRankRates()', context);
assert.equal(subjectRate.value, '420.00');
context.currentCalcTab = 'High School';
employee.rankRate = 1200;
vm.runInContext('syncCalcRankRates()', context);
assert.equal(subjectRate.value, '1200.00');
selected.value = '';
vm.runInContext('syncCalcRankRates()', context);
assert.equal(subjectRate.value, '1200.00');
console.log('PASS: hourly/workload rates follow assigned rank, refresh on rank changes, and preserve increments.');
