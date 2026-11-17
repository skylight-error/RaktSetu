const { db } = require('../db/database');

/**
 * Helper to parse cookies from request header without extra dependencies
 */
function parseCookies(req) {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return list;

  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      list[key] = decodeURIComponent(val);
    }
  });

  return list;
}

/**
 * Extract token from Authorization Bearer header or session_token cookie
 */
function getSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req);
  if (cookies.session_token) {
    return cookies.session_token;
  }
  return null;
}

/**
 * Authentication Middleware: Validates session token
 */
function requireAuth(req, res, next) {
  const token = getSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in to continue.' });
  }

  const session = db.prepare(`
    SELECT * FROM sessions
    WHERE token = ? AND expires_at > datetime('now')
  `).get(token);

  if (!session) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  req.session = session;
  next();
}

/**
 * Donor-only Authorization Middleware
 * Enforces:
 * 1. user_type must be 'DONOR'
 * 2. If :id parameter is present in route, strictly validates that the donor can only access their own ID
 */
function requireDonor(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.user_type !== 'DONOR') {
      return res.status(403).json({ error: 'Access denied: Donor authentication required.' });
    }

    const donor = db.prepare('SELECT * FROM donors WHERE id = ?').get(req.session.user_id);
    if (!donor) {
      return res.status(404).json({ error: 'Donor profile not found for this account.' });
    }

    const account = db.prepare('SELECT * FROM donor_accounts WHERE donor_id = ?').get(donor.id);
    if (account && account.account_status === 'DISABLED') {
      return res.status(403).json({ error: 'Your donor account has been disabled. Please contact the hospital.' });
    }

    // Strict ownership validation: prevents donors from accessing/tampering with another donor's records
    if (req.params.id && Number(req.params.id) !== donor.id) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to view or modify another donor\'s personal records.' });
    }

    req.donor = donor;
    req.donorAccount = account;
    next();
  });
}

/**
 * Hospital Staff Authorization Middleware
 * Enforces:
 * 1. user_type must be 'HOSPITAL'
 * 2. Hospital registration must be APPROVED and account must be ACTIVE
 * 3. Strict hospital ownership: Hospital A cannot access Hospital B's records
 */
function requireHospital(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.user_type !== 'HOSPITAL') {
      return res.status(403).json({ error: 'Access denied: Hospital staff authentication required.' });
    }

    const hospitalId = req.session.hospital_id || req.session.user_id;
    const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: 'Hospital account not found.' });
    }

    if (hospital.registration_status !== 'APPROVED') {
      return res.status(403).json({ error: `Access denied: Hospital registration status is ${hospital.registration_status}.` });
    }

    if (hospital.account_status !== 'ACTIVE') {
      return res.status(403).json({ error: `Access denied: Hospital account is ${hospital.account_status}. Please complete activation.` });
    }

    // Strict ownership validation: prevents Hospital A from accessing/modifying Hospital B's data
    const targetHospId = req.params.hospitalId || (req.query && req.query.hospitalId) || (req.body && req.body.hospitalId);
    if (targetHospId && Number(targetHospId) !== hospital.id) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view or modify another hospital's private records." });
    }

    req.hospital = hospital;
    next();
  });
}

/**
 * Platform Administrator Authorization Middleware
 * Enforces:
 * 1. user_type must be 'ADMIN'
 * 2. Only platform administrators can review hospital applications
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.session.user_type !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied: RaktSetu administrator authentication required.' });
    }

    const admin = db.prepare('SELECT id, username, email, full_name, role FROM administrators WHERE id = ?').get(req.session.user_id);
    if (!admin) {
      return res.status(404).json({ error: 'Administrator account not found.' });
    }

    req.admin = admin;
    next();
  });
}

// In-memory rate limiter for login attempts
const loginAttempts = new Map();

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (now > record.resetAt) {
      loginAttempts.delete(ip);
    } else if (record.count >= 20) {
      return res.status(429).json({ error: 'Too many failed login attempts. Please try again after 5 minutes.' });
    }
  }
  next();
}

function recordFailedLogin(req) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
  } else {
    record.count++;
  }
}

function resetLoginAttempts(req) {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  loginAttempts.delete(ip);
}

module.exports = {
  parseCookies,
  getSessionToken,
  requireAuth,
  requireDonor,
  requireHospital,
  requireAdmin,
  loginRateLimiter,
  recordFailedLogin,
  resetLoginAttempts
};
