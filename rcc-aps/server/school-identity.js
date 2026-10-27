'use strict';
const SCHOOL_DOMAIN = 'rcc.edu.ph';
function isSchoolEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@rcc\.edu\.ph$/i.test(email.trim());
}
module.exports = { SCHOOL_DOMAIN, isSchoolEmail };
