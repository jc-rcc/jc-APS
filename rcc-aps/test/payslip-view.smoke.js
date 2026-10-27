const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync(__dirname + '/../public/js/auth.js', 'utf8');
const html = fs.readFileSync(__dirname + '/../public/index.html', 'utf8');
const fn = source.slice(source.indexOf('function viewPayslipDetail('), source.indexOf('\nfunction printPayslip('));
const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
for (const [role,docId,detailId] of [['Employee','psDoc','payslipDetailPage'],['Finance Officer','finPsDoc','finPayslipDetail'],['System Admin','admPsDoc','admPayslipDetail']]) {
  for (const [level,month,thirteenth] of [['College',10,0],['High School',12,15000],['Elementary',12,15000],['Non-Teaching',10,0]]) {
    const elements = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],{innerHTML:'',style:{}}]));
    const record = {empId:3,month,year:2026,gross:25000,net:23000,date:'Oct 20, 2026',thirteenth,deMinimisSum:500,subjectBreakdown:[{type:'subject',subject:'Data Structures',deptCode:'CCS',qty:39,rate:190,amount:7410},{type:'increment',qty:1,rate:100,amount:100}]};
    record.customDeds = [{name:'PERAA',amount:400},{name:'School Loan',amount:100}];
    const alerts = [];
    const context = vm.createContext({
      users:[{id:3,role,first:'Paolo',last:'Test',classification:level==='Non-Teaching'?'Non-Teaching':'Teaching',schoolLevel:level}],
      payrollRecords:[record],MONTHS:months,
      ROLE_PAGE:{Employee:'empPage','Finance Officer':'financePage','System Admin':'adminPage'},
      fmt:n=>'P'+Number(n).toFixed(2),esc:s=>String(s),displayName:u=>u.first+' '+u.last,
      document:{getElementById:id=>elements[id]||null},showToast:(...args)=>alerts.push(args)
    });
    vm.runInContext(fn,context);
    vm.runInContext(`viewPayslipDetail('${months[month-1]} 2026',3)`,context);
    assert.match(elements[docId].innerHTML,/Paolo Test/);
    assert.match(elements[docId].innerHTML,/Data Structures/);
    assert.match(elements[docId].innerHTML,/<th>Dept<\/th>/);
    assert.match(elements[docId].innerHTML,/>CCS<\/td>/);
    assert.match(elements[docId].innerHTML,/P400\.00/);
    assert.match(elements[docId].innerHTML,/School Loan/);
    assert.equal(elements[detailId].style.display,'block');
    const table = elements[docId].innerHTML.match(/<table class="ps-pay-table">([\s\S]*?)<\/table>/)[1];
    for (const section of ['tbody', 'tfoot']) {
      const body = table.match(new RegExp('<' + section + '>([\\s\\S]*?)<\\/' + section + '>'))[1];
      for (const row of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
        let columns = 0;
        for (const cell of row[1].matchAll(/<(?:td|th)\b([^>]*)>/g)) columns += Number((cell[1].match(/colspan="(\d+)"/) || [,'1'])[1]);
        assert.equal(columns,13,section + ' row must align to 13 columns');
      }
    }
    if(thirteenth) assert.match(elements[docId].innerHTML,/P15000\.00/);
    assert.equal(alerts.length,0);
    vm.runInContext("viewPayslipDetail('January 2020',3)",context);
    assert.equal(alerts.length,1);
  }
}
console.log('PASS: 12 payslip rendering cases across Employee/Finance/Admin and all payroll groups, with 13th month, increments, and missing records.');
