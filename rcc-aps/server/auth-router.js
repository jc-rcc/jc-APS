'use strict';
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('./db');
const { requireAuth, JWT_SECRET } = require('./middleware/jwt');
const googleSso = require('./google-sso');
const { isSchoolEmail } = require('./school-identity');

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const TOKEN_TTL     = '8h'; // session lasts 8 hours

router.get('/google/config', (req,res) => {
  res.set('Cache-Control','no-store');
  const clientId = googleSso.clientId();
  if (!clientId) return res.json({enabled:false});
  try { return res.json({enabled:true,clientId,domain:googleSso.SCHOOL_DOMAIN,nonce:googleSso.challenge(req,res)}); }
  catch (error) { return res.status(error.status || 503).json({ok:false,error:error.message}); }
});

router.post('/google', async (req,res) => {
  try {
    const claims = await googleSso.verify(req,res);
    const user = await db.googleSignIn(claims);
    const token = jwt.sign(user,JWT_SECRET,{expiresIn:TOKEN_TTL});
    res.set('Cache-Control','no-store');
    return res.json({ok:true,token,user});
  } catch (error) {
    if (!error.status) console.error('[Auth] Google sign-in failed.');
    return res.status(error.status || 500).json({ok:false,error:error.status ? error.message : 'Unable to sign in with Google. Please try again.'});
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
// Body: { email, password }
// Returns: { ok, token, user: { id, email, role, label, page, status } }
router.post('/login', async (req, res) => {
  const email    = String(req.body.email || '').toLowerCase().trim();
  const password = (req.body.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required.' });
  }
  if (!isSchoolEmail(email)) return res.status(403).json({ok:false,error:'Only @rcc.edu.ph school accounts can sign in.'});

  try {
    const state = await db.assembleState();
    // Find auth entry by email
    const authEntry = Object.values(state.auth || {}).find(
      a => (a.email || '').toLowerCase() === email
    );

    if (!authEntry) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    if (authEntry.status === 'Inactive') {
      return res.status(403).json({ ok: false, error: 'This account is deactivated. Please contact the System Admin.' });
    }

    // Support both bcrypt hashes and legacy plain-text (for migration period)
    let passwordMatch = false;
    const storedPass  = authEntry.pass || '';

    if (storedPass.startsWith('$2b$') || storedPass.startsWith('$2a$')) {
      // bcrypt hash — secure comparison
      passwordMatch = await bcrypt.compare(password, storedPass);
    } else {
      // Legacy plain-text — compare directly, then upgrade to hash
      passwordMatch = (password === storedPass);
      if (passwordMatch) {
        // Silently upgrade to bcrypt hash on successful plain-text login
        const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await db.updatePassword(authEntry.id, hashed);
        console.log(`[Auth] Upgraded password for ${email} to bcrypt hash.`);
      }
    }

    if (!passwordMatch) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }

    // Build JWT payload
    const payload = {
      id:     authEntry.id,
      email:  authEntry.email,
      role:   authEntry.role,   // 'admin' | 'finance' | 'employee'
      label:  authEntry.label,  // 'System Admin' | 'Finance Officer' | 'Employee'
      page:   authEntry.page,   // 'adminPage' | 'financePage' | 'empPage'
      status: authEntry.status
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });

    return res.json({ ok: true, token, user: payload });
  } catch (e) {
    console.error('[Auth] Login error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error during login.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
// Returns current user info from JWT (no DB hit needed).
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── POST /api/auth/change-password ───────────────────────────
// Body: { currentPassword, newPassword }
// Requires: valid JWT token
router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = (req.body.currentPassword || '').trim();
  const newPassword     = (req.body.newPassword || '').trim();

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ ok: false, error: 'New password must be at least 6 characters.' });
  }

  try {
    const state     = await db.assembleState();
    const authEntry = Object.values(state.auth || {}).find(a => a.id === req.user.id);

    if (!authEntry) {
      return res.status(404).json({ ok: false, error: 'User not found.' });
    }

    const storedPass = authEntry.pass || '';
    let currentMatch = false;

    if (storedPass.startsWith('$2b$') || storedPass.startsWith('$2a$')) {
      currentMatch = await bcrypt.compare(currentPassword, storedPass);
    } else {
      currentMatch = (currentPassword === storedPass);
    }

    if (!currentMatch) {
      return res.status(401).json({ ok: false, error: 'Current password is incorrect.' });
    }

    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await db.updatePassword(authEntry.id, hashed);

    return res.json({ ok: true, message: 'Password changed successfully.' });
  } catch (e) {
    console.error('[Auth] Change-password error:', e.message);
    return res.status(500).json({ ok: false, error: 'Server error while changing password.' });
  }
});

module.exports = router;
