// Validates the client-pushed demo state before it is persisted to PostgreSQL.
// The state must be an object containing the core arrays the app expects;
// anything else is rejected with HTTP 400 so a bad client (or an accidental
// empty POST) cannot wipe the database.
function validateStateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'State payload must be a JSON object.' };
  }
  if (!Array.isArray(body.users)) {
    return { ok: false, error: '"users" must be an array.' };
  }
  if (body.users.length === 0) {
    return { ok: false, error: 'Refusing to persist: "users" array is empty.' };
  }
  if (!Number.isInteger(body.stateRevision) || body.stateRevision < 0) {
    return { ok:false, error:'Reload the page before saving. A record revision is required.' };
  }
  const arrays = ['users','payrollRecords','bonusTypes','deductionCategories','sssTable','birData','leaveTypes','leaveRecords','attendance','teacherRanks','teachingLoadRecords','teachingLoadClasses'];
  for (const key of arrays) if (key in body && (!Array.isArray(body[key]) || body[key].some(row => !row || typeof row !== 'object' || Array.isArray(row)))) {
    return { ok:false, error:'Invalid records: ' + key };
  }
  return { ok: true };
}

module.exports = { validateStateBody };
