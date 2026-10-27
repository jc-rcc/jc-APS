const express = require('express');
const fs = require('fs');
const path = require('path');
const hrisMock = require('./hris-mock');
const { validateStateBody } = require('./state-validator');
const db = require('./db');
const { init } = require('./db/init');
const { requireAuth, requireRole } = require('./middleware/jwt');
const { actorFor, visibleState } = require('./state-access');

const app = express();
const PORT = parseInt(process.env.PORT) || 3000;
const HRIS_API_URL = process.env.HRIS_API_URL || '';      // e.g. https://hris.rcc.edu.ph/api
const HRIS_API_KEY = process.env.HRIS_API_KEY || '';      // bearer token for the HRIS API

app.use(express.json({ limit: '10mb' }));
app.use('/api/auth', require('./auth-router'));
// Serve static assets with no-store so browsers always revalidate (prevents
// stale JS/CSS after edits — users were seeing old cached teachingload.js).
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res) => { res.set('Cache-Control', 'no-store, must-revalidate'); }
}));

// Routes that must be handled by the browser (SPA fallback).

// ── HRIS DATA ────────────────────────────────────────────────
function mapHrisEmployee(h) {
  return {
    first: h.first_name || h.firstName || h.first || '',
    last: h.last_name || h.lastName || h.last || '',
    email: (h.email || '').toLowerCase(),
    password: h.password || '',
    role: h.role || 'Employee',
    status: (h.active === false || h.status === 'Inactive') ? 'Inactive' : (h.status || 'Active'),
    department: h.department || '',
    classification: (h.contractType === 'Part-Time') ? 'Teaching' : (h.classification || 'Non-Teaching'),
    salary: h.salary || h.monthly_salary || h.monthlySalary || 0,
    hourlyRate: h.hourly_rate || h.hourlyRate || 0,
    hireDate: h.hire_date || h.hireDate || '',
    hoursWorked: h.hours_worked || h.hoursWorked || 0,
    absenceDays: h.absence_days || h.absenceDays || 0,
    employeeId: h.employeeId || h.employee_id || ''
  };
}

// Normalize an attendance record from either the real API or mock into a shape
// the client can consume: kept as one-per-day clock-in/out with the employee
// email attached so the client can match it to a local user.
function mapHrisAttendance(a) {
  return {
    employeeId: a.employee_id || a.employeeId || '',
    employeeEmail: (a.employee_email || a.email || '').toLowerCase(),
    date: a.date || (a.attendanceDate || ''),
    clockInAt: a.clock_in_at || a.clockInAt || '',
    clockOutAt: a.clock_out_at || a.clockOutAt || ''
  };
}

// Fetch employees/attendance/leaves from the live HRIS. Falls back to the
// bundled mock dataset when no endpoint is configured or the API is offline.
async function fetchHrisData() {
  if (HRIS_API_URL) {
    try {
      const headers = { Accept: 'application/json' };
      if (HRIS_API_KEY) headers.Authorization = 'Bearer ' + HRIS_API_KEY;
      const [empRes, attRes, leaveRes] = await Promise.all([
        fetch(`${HRIS_API_URL}/employees`, { headers }),
        fetch(`${HRIS_API_URL}/attendance`, { headers }),
        fetch(`${HRIS_API_URL}/leave-requests`, { headers })
      ]);
      if (empRes.ok) {
        const employees = await empRes.json().catch(() => []);
        const attendance = attRes.ok ? await attRes.json().catch(() => []) : [];
        const leaves = leaveRes.ok ? await leaveRes.json().catch(() => []) : [];
        const empList = (Array.isArray(employees) ? employees : (employees.employees || employees.data || []));
        const attList = (Array.isArray(attendance) ? attendance : (attendance.attendance || attendance.data || []));
        const leaveList = (Array.isArray(leaves) ? leaves : (leaves.leaveRecords || leaves.data || []));
        return {
          source: 'HRIS API',
          employees: empList.map(mapHrisEmployee),
          attendance: attList.map(mapHrisAttendance),
          leaveRecords: leaveList
        };
      }
    } catch (e) {
      console.warn('[HRIS] API unreachable, using mock data.');
    }
  }
  return {
    source: 'mock data',
    employees: hrisMock.employees.map(mapHrisEmployee),
    attendance: (hrisMock.attendance || []).map(mapHrisAttendance),
    leaveRecords: hrisMock.leaveRecords || []
  };
}

// ── HEALTH & DB STATUS ───────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'RCC-APS Payroll System API', database: 'MySQL', hris: HRIS_API_URL ? 'connected' : 'mock' });
});

app.get('/api/db/status', requireAuth, requireRole('admin','finance'), async (req, res) => {
  const st = await db.status();
  res.json({
    engine: 'MySQL',
    connected: st.connected,
    host: st.host,
    database: st.database,
    serverTime: st.serverTime,
    counts: st.counts || null,
    error: st.error || null
  });
});

app.get('/api/hris/status', requireAuth, requireRole('admin','finance'), (req, res) => {
  res.json({
    configured: !!HRIS_API_URL,
    url: HRIS_API_URL || null,
    message: HRIS_API_URL
      ? `Connected to HRIS API at ${HRIS_API_URL}`
      : 'HRIS API not configured. Using mock HRIS data.'
  });
});

app.post('/api/hris/sync', requireAuth, requireRole('admin','finance'), async (req,res) => {
  try {
    const data = await fetchHrisData();
    const result = await db.syncHrisData(data, req.user, req.body.stateRevision);
    res.json({ok:true,...result});
  } catch(error) { res.status(error.status || 500).json({ok:false,error:error.status ? error.message : 'Unable to sync HRIS records.'}); }
});

// ── STATE (MySQL-backed, frontend-blob compatible) ───────────
app.get('/api/data', requireAuth, async (req, res) => {
  try {
    const state = await db.assembleState();
    res.json(visibleState(state, actorFor(state, req.user)));
  } catch (e) {
    console.error('[DB] read failed:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to read from MySQL.' });
  }
});

app.post('/api/data', requireAuth, async (req, res) => {
  const check = validateStateBody(req.body || {});
  if (!check.ok) {
    return res.status(400).json({ ok: false, error: check.error });
  }
  try {
    const state = await db.saveClientState(req.body, req.user);
    res.json({ ok: true, state });
  } catch (e) {
    console.error('[DB] write failed:', e.message);
    return res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Failed to save records. Check references and required fields.' });
  }
});

// ── EMPLOYEES ────────────────────────────────────────────────
app.get('/api/employees', requireAuth, async (req, res) => {
  try {
    const state = await db.assembleState();
    res.json(visibleState(state, actorFor(state, req.user)).users);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to read employees.' });
  }
});

// ── LEAVE ENDPOINTS ──────────────────────────────────────────
app.get('/api/leaves', requireAuth, async (req, res) => {
  try {
    const state = await db.assembleState();
    const scoped = visibleState(state, actorFor(state, req.user));
    res.json({
      leaveTypes: scoped.leaveTypes || [],
      nextLeaveTypeId: scoped.nextLeaveTypeId || 1,
      leaveRecords: scoped.leaveRecords || []
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to read leaves.' });
  }
});

for (const [route,key] of [['/api/leave-types','leaveTypes'],['/api/leave-records','leaveRecords']]) {
  app.post(route, requireAuth, requireRole('finance'), async (req,res) => {
    try {
      if (!Array.isArray(req.body[key])) return res.status(400).json({ok:false,error:'Invalid records.'});
      const state = await db.saveClientState({ [key]:req.body[key], stateRevision:req.body.stateRevision },req.user);
      res.json({ok:true,state});
    } catch(error) { res.status(error.status || 500).json({ok:false,error:error.status ? error.message : 'Unable to save records.'}); }
  });
}

async function start() {
  await init();
  const st = await db.status();
  if (!st.connected) throw new Error('MySQL database is unavailable: ' + st.error);
  return app.listen(PORT, () => console.log('RCC-APS Payroll System running at http://localhost:' + PORT));
}
if (require.main === module) start().catch(error => { console.error('[Startup] ' + error.message); process.exitCode = 1; });
module.exports = { app, start };
