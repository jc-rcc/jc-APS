'use strict';
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { SCHOOL_DOMAIN, isSchoolEmail } = require('./school-identity');
const client = new OAuth2Client();
const challenges = new Map();
const COOKIE = 'rcc_google_nonce';
const lifetime = 5 * 60 * 1000;
function clientId() {
  const value = process.env.GOOGLE_CLIENT_ID || require('./sso-config.json').googleClientId || '';
  return /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value) ? value : '';
}
function challenge(req, res) {
  for (const [key, expiry] of challenges) if (expiry <= Date.now()) challenges.delete(key);
  if (challenges.size >= 10000) throw Object.assign(new Error('Please try signing in again shortly.'), {status:503});
  const nonce = crypto.randomBytes(32).toString('hex');
  challenges.set(nonce, Date.now() + lifetime);
  res.cookie(COOKIE, nonce, {httpOnly:true, sameSite:'strict', secure:req.secure, path:'/api/auth', maxAge:lifetime});
  return nonce;
}
async function verify(req, res) {
  const audience = clientId();
  if (!audience) throw Object.assign(new Error('Google sign-in is not available yet.'), {status:503});
  const cookie = String(req.headers.cookie || '').split(';').map(part=>part.trim()).find(part=>part.startsWith(COOKIE+'='));
  const nonce = cookie && cookie.slice(COOKIE.length+1);
  const expiry = challenges.get(nonce);
  challenges.delete(nonce);
  res.clearCookie(COOKIE, {httpOnly:true, sameSite:'strict', secure:req.secure, path:'/api/auth'});
  if (!nonce || !expiry || expiry <= Date.now() || req.headers['x-requested-with'] !== 'RCC-APS') {
    throw Object.assign(new Error('Sign-in expired. Please try Google sign-in again.'), {status:401});
  }
  const credential = req.body.credential;
  if (typeof credential !== 'string' || credential.length > 12000) throw Object.assign(new Error('Invalid Google sign-in.'), {status:401});
  let claims;
  try {
    const ticket = await client.verifyIdToken({idToken:credential, audience});
    claims = ticket.getPayload();
  } catch (_) { throw Object.assign(new Error('Google could not verify this sign-in. Please try again.'), {status:401}); }
  if (!claims || claims.nonce !== nonce || !claims.sub || claims.email_verified !== true || claims.hd !== SCHOOL_DOMAIN || !isSchoolEmail(claims.email)) {
    throw Object.assign(new Error('Use your verified @rcc.edu.ph school Google account.'), {status:403});
  }
  return claims;
}
module.exports = { clientId, challenge, verify, SCHOOL_DOMAIN };
