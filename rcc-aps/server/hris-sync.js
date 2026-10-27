'use strict';
const { isSchoolEmail } = require('./school-identity');
// HRIS credentials are consumed only on the server, never sent to the browser.
function hrisSubmission(current, data, actor) {
  const submitted = { stateRevision:current.stateRevision, users:structuredClone(current.users), auth:{}, leaveTypes:structuredClone(current.leaveTypes), leaveRecords:structuredClone(current.leaveRecords), attendance:structuredClone(current.attendance) };
  const counts = { added:0, updated:0, skipped:0, attendance:0, leaves:0 };
  let nextUser = current.nextUserId, nextLeave = current.nextLeaveRecordId, nextType = current.nextLeaveTypeId;
  for (const entry of data.employees || []) {
    const email = String(entry.email || '').toLowerCase();
    if (!isSchoolEmail(email)) { counts.skipped++; continue; }
    let user = submitted.users.find(user => user.email.toLowerCase() === email);
    if (actor.role === 'admin') {
      if (!user) {
        if (!entry.password || entry.password.length < 6) { counts.skipped++; continue; }
        user = { id:nextUser++ }; submitted.users.push(user);
        submitted.auth[user.id] = {id:user.id,pass:entry.password}; counts.added++;
      } else counts.updated++;
      for (const key of ['first','last','email','role','status','department','classification','hireDate','schoolLevel']) if (entry[key] !== undefined) user[key] = entry[key];
      if (!user.date) user.date = new Date().toISOString().slice(0,10);
    } else if (user) {
      for (const key of ['salary','hourlyRate','hoursWorked','absenceDays']) if (entry[key] !== undefined) user[key] = entry[key];
      counts.updated++;
    } else counts.skipped++;
  }
  if (actor.role === 'finance') {
    for (const entry of data.leaveRecords || []) {
      const user = current.users.find(user => user.email.toLowerCase() === String(entry.employee_email || '').toLowerCase());
      if (!user) continue;
      const name = entry.leave_type || 'Other Leave';
      let type = submitted.leaveTypes.find(type => type.name.toLowerCase() === name.toLowerCase());
      if (!type) { type={id:nextType++,name,isPaid:false};submitted.leaveTypes.push(type); }
      if (!submitted.leaveRecords.some(row => row.empId===user.id && row.typeId===type.id && row.startDate===entry.start_date && row.endDate===entry.end_date)) {
        submitted.leaveRecords.push({id:nextLeave++,empId:user.id,typeId:type.id,startDate:entry.start_date,endDate:entry.end_date,days:entry.days || 1});counts.leaves++;
      }
    }
    for (const entry of data.attendance || []) {
      const user = current.users.find(user => user.email.toLowerCase() === String(entry.employeeEmail || '').toLowerCase());
      if (!user || !entry.date) continue;
      const clock = value => {
        if (!value) return NaN;
        const time = String(value).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        return time ? Number(time[1])+Number(time[2])/60 : Date.parse(value)/3600000;
      };
      let hours = clock(entry.clockOutAt)-clock(entry.clockInAt);
      if (hours < 0) hours+=24;
      if (!Number.isFinite(hours)) hours=0;
      const row = {empId:user.id,employeeId:entry.employeeId || '',employeeEmail:user.email,date:entry.date,clockInAt:entry.clockInAt || '',clockOutAt:entry.clockOutAt || '',hours:Number(hours.toFixed(2))};
      const existing = submitted.attendance.find(old => old.empId===user.id && old.date===entry.date);
      if (existing) Object.assign(existing,row); else submitted.attendance.push(row);
      counts.attendance++;
    }
  }
  return { submitted, counts };
}
module.exports = { hrisSubmission };
