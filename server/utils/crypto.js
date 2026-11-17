const crypto = require('node:crypto');

/**
 * Hash password using PBKDF2 with SHA-512 and unique salt
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Timing-safe password verification
 */
function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  try {
    const testHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const testBuf = Buffer.from(testHash, 'hex');
    if (hashBuf.length !== testBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, testBuf);
  } catch (err) {
    return false;
  }
}

/**
 * Generate cryptographically secure random session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate unique human-readable Application ID
 * Format: RS-APP-YYYYMMDD-XXXX (e.g. RS-APP-20261117-9482)
 */
function generateApplicationId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RS-APP-${dateStr}-${rand}`;
}

/**
 * Generate unique human-readable Hospital Application ID
 * Format: RS-HOSP-YYYYMMDD-XXXX (e.g. RS-HOSP-20261117-4821)
 */
function generateHospitalApplicationId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `RS-HOSP-${dateStr}-${rand}`;
}

/**
 * Generate 6-digit numeric activation OTP
 */
function generateActivationOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateApplicationId,
  generateHospitalApplicationId,
  generateActivationOtp
};
