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
 * 2. Only hospital accounts can access hospital management endpoints
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

    req.hospital = hospital;
    next();
  });
}

module.exports = {
  parseCookies,
  getSessionToken,
  requireAuth,
  requireDonor,
  requireHospital
};
