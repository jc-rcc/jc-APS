'use strict';
const jwt = require('jsonwebtoken');

const fs = require('fs');
const path = require('path');
function signingSecret() {
  // 1. Always prefer the environment variable (production / Vercel)
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // 2. In a read-only filesystem (Vercel/AWS Lambda), we cannot create the
  //    fallback file. Throw a clear, actionable error instead of crashing
  //    with a vague EROFS stack trace.
  const isReadOnlyFs = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const file = path.resolve(__dirname, '../../.jwt-secret');
  if (isReadOnlyFs) {
    throw new Error(
      'JWT_SECRET environment variable is not set. Set it in Vercel Project Settings > Environment Variables.'
    );
  }

  // 3. Local dev only: lazily create a persistent random secret on disk
  if (!fs.existsSync(file)) {
    try { fs.writeFileSync(file, require('crypto').randomBytes(64).toString('hex'), { flag:'wx', mode:0o600 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  return fs.readFileSync(file,'utf8').trim();
}
const JWT_SECRET = signingSecret();

/**
 * Express middleware that verifies the JWT Bearer token on every request.
 * On success, attaches req.user = { id, email, role, label, page, status }.
 * On failure, responds 401 Unauthorized.
 */
async function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'No token provided. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const rows = await require('../db').q('SELECT id, email, role, status FROM auth WHERE id=?', [payload.id]);
    const account = rows[0];
    if (!account || account.status !== 'Active' || !require('../school-identity').isSchoolEmail(account.email)) return res.status(401).json({ok:false,error:'Account unavailable. Please log in again.'});
    req.user = { ...payload, role:account.role, status:account.status };
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ ok: false, error: 'Invalid token. Please log in again.' });
  }
}

/**
 * Optional auth middleware — the same verification as requireAuth, but if no
 * Bearer token is supplied the request continues as anonymous. Used so the
 * original (pre-JWT) frontend keeps working on /api/* while any request that
 * DOES carry a token is still strictly validated.
 * On success with a token, attaches req.user (same shape as requireAuth).
 * On a present-but-invalid token, responds 401.
 */
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;   // { id, email, role, label, page, status }
    next();
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      return res.status(401).json({ ok: false, error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ ok: false, error: 'Invalid token. Please log in again.' });
  }
}

/**
 * Role guard factory — use after requireAuth.
 * e.g. requireRole('admin') or requireRole('admin','finance')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: 'Access denied. Insufficient role.' });
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole, JWT_SECRET };
