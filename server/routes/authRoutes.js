const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateActivationOtp
} = require('../utils/crypto');
const { getSessionToken, requireAuth } = require('../middleware/auth');

/**
 * Hospital Login (Requirement 9)
 */
router.post('/hospital/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Hospital email and password are required.' });
  }

  const hospital = db.prepare('SELECT * FROM hospitals WHERE lower(email) = ?').get(email.trim().toLowerCase());
  if (!hospital) {
    return res.status(401).json({ error: 'Invalid hospital email or password.' });
  }

  // Verify password: support secure hash with salt, or legacy seed password
  let isValid = false;
  if (hospital.password_salt && hospital.password_hash) {
    isValid = verifyPassword(password, hospital.password_hash, hospital.password_salt);
  } else if (hospital.password_hash === password) {
    isValid = true;
    // Upgrade to secure hash automatically
    const { hash, salt } = hashPassword(password);
    db.prepare('UPDATE hospitals SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, hospital.id);
  }

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid hospital email or password.' });
  }

  // Create secure session token
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, user_type, role, hospital_id, expires_at)
    VALUES (?, ?, 'HOSPITAL', 'HOSPITAL_STAFF', ?, ?)
  `).run(token, hospital.id, hospital.id, expiresAt);

  // Set secure HTTP-only cookie
  res.setHeader(
    'Set-Cookie',
    `session_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  res.json({
    success: true,
    userType: 'HOSPITAL',
    token,
    hospital: {
      id: hospital.id,
      name: hospital.name,
      email: hospital.email,
      phone: hospital.phone,
      address: hospital.address,
      city: hospital.city,
      pincode: hospital.pincode
    }
  });
});

/**
 * Request Account Activation Verification Code / OTP (Requirement 6)
 */
router.post('/donor/request-activation-code', (req, res) => {
  const { applicationId, mobile } = req.body;

  if (!applicationId || !mobile) {
    return res.status(400).json({ error: 'Application ID and registered mobile number are required.' });
  }

  const cleanMobile = mobile.toString().replace(/\D/g, '');
  const cleanAppId = applicationId.toString().trim().toUpperCase();

  const app = db.prepare(`
    SELECT a.*, h.name as hospital_name
    FROM donor_applications a
    LEFT JOIN hospitals h ON a.preferred_hospital_id = h.id
    WHERE upper(a.application_id) = ?
      AND replace(replace(replace(a.mobile, ' ', ''), '+', ''), '-', '') LIKE ?
  `).get(cleanAppId, `%${cleanMobile}%`);

  if (!app) {
    return res.status(404).json({ error: 'No application found with matching Application ID and mobile number.' });
  }

  if (app.status === 'PENDING_APPROVAL') {
    return res.status(403).json({
      error: 'Your application is still PENDING APPROVAL by the hospital. Account activation is only permitted after hospital approval.'
    });
  }

  if (app.status === 'REJECTED') {
    return res.status(403).json({
      error: `Your registration application was REJECTED and not approved. Reason: ${app.rejection_reason || 'Administrative review requirement not met.'}`,
      status: 'REJECTED'
    });
  }

  // Check if account is already activated
  const existingAccount = db.prepare('SELECT id, account_status FROM donor_accounts WHERE application_id = ?').get(app.id);
  if (existingAccount && existingAccount.account_status === 'ACTIVE') {
    return res.status(400).json({
      error: 'An active donor account already exists for this approved application. Please proceed directly to Donor Login.'
    });
  }

  // Generate fresh 6-digit OTP
  const otp = generateActivationOtp();
  db.prepare(`
    UPDATE donor_applications
    SET activation_otp = ?, activation_otp_expires_at = datetime('now', '+1 hour')
    WHERE id = ?
  `).run(otp, app.id);

  res.json({
    success: true,
    applicationId: app.application_id,
    applicantName: app.full_name,
    maskedMobile: `+91 ******${cleanMobile.slice(-4)}`,
    // In demo environment, clearly supply demo verification OTP for presentation convenience
    demoOtpNotice: 'DEMO SIMULATION: Real SMS/email gateway is not configured for external delivery.',
    demoActivationOtp: otp,
    activationCode: otp,
    message: `Verification code generated for ${app.full_name}. Please enter the 6-digit code to complete account activation.`
  });
});

/**
 * Complete First-Time Donor Account Activation (Requirement 6)
 */
router.post('/donor/activate', (req, res) => {
  const { applicationId, mobile, password, confirmPassword } = req.body;
  const activationCode = req.body.activationCode || req.body.otp || req.body.code;

  if (!applicationId || !mobile || !activationCode || !password) {
    return res.status(400).json({ error: 'Application ID, mobile number, verification code, and password are required.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters in length.' });
  }

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match. Please re-enter.' });
  }

  const cleanMobile = mobile.toString().replace(/\D/g, '');
  const cleanAppId = applicationId.toString().trim().toUpperCase();

  const app = db.prepare(`
    SELECT * FROM donor_applications
    WHERE upper(application_id) = ?
      AND replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE ?
  `).get(cleanAppId, `%${cleanMobile}%`);

  if (!app) {
    return res.status(404).json({ error: 'Application not found with provided ID and mobile.' });
  }

  if (app.status !== 'APPROVED') {
    return res.status(403).json({
      error: `Cannot activate account. Application status is currently ${app.status}. Account activation is only allowed for APPROVED registrations.`
    });
  }

  // Verify OTP
  if (!app.activation_otp || app.activation_otp.toString().trim() !== activationCode.toString().trim()) {
    return res.status(400).json({ error: 'Invalid or expired activation code. Please check the code or request a new one.' });
  }

  // Prevent multiple accounts for the same application
  const existingAcc = db.prepare('SELECT id, account_status FROM donor_accounts WHERE application_id = ?').get(app.id);
  if (existingAcc && existingAcc.account_status === 'ACTIVE') {
    return res.status(400).json({ error: 'An active account already exists for this application. Please log in.' });
  }

  // Securely hash password
  const { hash, salt } = hashPassword(password);

  try {
    // 1. Find or create the donor profile record
    let donorId = app.donor_id;
    if (donorId) {
      db.prepare("UPDATE donors SET account_status = 'ACTIVE' WHERE id = ?").run(donorId);
    } else {
      const existingDonor = db.prepare(`
        SELECT id FROM donors
        WHERE replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE ?
      `).get(`%${cleanMobile}%`);

      if (existingDonor) {
        donorId = existingDonor.id;
        db.prepare(`
          UPDATE donors
          SET application_id = ?,
              registration_status = 'APPROVED',
              account_status = 'ACTIVE',
              medical_screening_status = 'PENDING_SCREENING'
          WHERE id = ?
        `).run(app.id, donorId);
      } else {
        const insertDonor = db.prepare(`
          INSERT INTO donors (
            application_id, full_name, dob, age, gender, mobile, email, blood_group,
            address, city, pincode, preferred_hospital_id, registration_status,
            account_status, medical_screening_status, screening_status, weekly_availability,
            latitude, longitude, consent_contact, source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'ACTIVE', 'PENDING_SCREENING', 'PENDING SCREENING', 'UNCONFIRMED', 19.0760, 72.8777, 1, 'ONLINE_APPLICATION')
        `);

        const resInsert = insertDonor.run(
          app.id,
          app.full_name,
          app.dob,
          app.age,
          app.gender,
          app.mobile,
          app.email,
          app.blood_group,
          app.address,
          app.city,
          app.pincode,
          app.preferred_hospital_id
        );
        donorId = resInsert.lastInsertRowid;
      }
    }

    // 2. Create donor account
    db.prepare(`
      INSERT INTO donor_accounts (application_id, donor_id, email, mobile, password_hash, password_salt, account_status, activated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', datetime('now'))
    `).run(app.id, donorId, app.email, app.mobile, hash, salt);

    // 3. Clear activation OTP to prevent reuse
    db.prepare('UPDATE donor_applications SET activation_otp = NULL WHERE id = ?').run(app.id);

    // 4. Create in-app notification
    db.prepare(`
      INSERT INTO notifications (donor_id, application_id, title, message, type)
      VALUES (?, ?, 'Account Activated 🚀', 'Your donor account is active! You can now log in to manage your availability and track screening appointments.', 'ACCOUNT_STATUS')
    `).run(donorId, app.id);

    res.json({
      success: true,
      message: 'Account activated successfully! You can now log in using your registered mobile number and password.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to activate account: ' + err.message });
  }
});

/**
 * Donor Login (Requirement 7)
 */
router.post('/donor/login', (req, res) => {
  const { identifier, mobile, email, password } = req.body;
  const loginId = identifier || mobile || email;

  if (!loginId || !password) {
    return res.status(400).json({ error: 'Mobile number/email and password are required.' });
  }

  const cleanMobile = loginId.toString().replace(/\D/g, '');
  const cleanEmail = loginId.toString().trim().toLowerCase();

  // Find account by mobile or email
  let account = null;
  if (cleanMobile.length >= 10) {
    account = db.prepare(`
      SELECT da.*, d.full_name, d.blood_group, d.registration_status, d.account_status as donor_acc_status,
             d.medical_screening_status, d.screening_status, a.status as app_status, a.rejection_reason, a.application_id as app_code
      FROM donor_accounts da
      JOIN donors d ON da.donor_id = d.id
      LEFT JOIN donor_applications a ON da.application_id = a.id
      WHERE replace(replace(replace(da.mobile, ' ', ''), '+', ''), '-', '') LIKE ?
    `).get(`%${cleanMobile}%`);
  }

  if (!account && cleanEmail.includes('@')) {
    account = db.prepare(`
      SELECT da.*, d.full_name, d.blood_group, d.registration_status, d.account_status as donor_acc_status,
             d.medical_screening_status, d.screening_status, a.status as app_status, a.rejection_reason, a.application_id as app_code
      FROM donor_accounts da
      JOIN donors d ON da.donor_id = d.id
      LEFT JOIN donor_applications a ON da.application_id = a.id
      WHERE lower(da.email) = ?
    `).get(cleanEmail);
  }

  // If no account found, check donor_applications to give helpful guidance
  if (!account) {
    const pendingApp = db.prepare(`
      SELECT * FROM donor_applications
      WHERE (replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE ?)
         OR (email IS NOT NULL AND lower(email) = ?)
    `).get(`%${cleanMobile}%`, cleanEmail);

    if (pendingApp) {
      if (pendingApp.status === 'PENDING_APPROVAL') {
        return res.status(403).json({
          error: `Your application (${pendingApp.application_id}) is currently PENDING hospital approval. You cannot log in until verified by hospital staff.`,
          registrationStatus: 'PENDING_APPROVAL'
        });
      } else if (pendingApp.status === 'REJECTED') {
        return res.status(403).json({
          error: `Your registration application (${pendingApp.application_id}) was not approved. Reason: ${pendingApp.rejection_reason || 'Hospital review requirement not met.'}`,
          registrationStatus: 'REJECTED'
        });
      } else if (pendingApp.status === 'APPROVED') {
        return res.status(403).json({
          error: `Your registration has been APPROVED by the hospital! However, your account has not been activated yet. Please click 'First-Time Activation' to set your password.`,
          registrationStatus: 'APPROVED',
          accountStatus: 'NOT_ACTIVATED'
        });
      }
    }

    return res.status(401).json({ error: 'Invalid mobile/email or password.' });
  }

  // Check account status
  if (account.account_status === 'DISABLED' || account.donor_acc_status === 'DISABLED') {
    return res.status(403).json({ error: 'Your donor account has been disabled. Please contact the hospital.' });
  }

  if (account.app_status === 'REJECTED') {
    return res.status(403).json({ error: `Your registration was rejected. Reason: ${account.rejection_reason || 'Not approved'}` });
  }

  // Verify password
  const isValid = verifyPassword(password, account.password_hash, account.password_salt);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid mobile/email or password.' });
  }

  // Update last login timestamp
  db.prepare("UPDATE donor_accounts SET last_login_at = datetime('now') WHERE id = ?").run(account.id);

  // Issue session token
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, user_type, role, expires_at)
    VALUES (?, ?, 'DONOR', 'DONOR', ?)
  `).run(token, account.donor_id, expiresAt);

  // Set secure HTTP-only cookie
  res.setHeader(
    'Set-Cookie',
    `session_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  res.json({
    success: true,
    token,
    userType: 'DONOR',
    donor: {
      id: account.donor_id,
      fullName: account.full_name,
      bloodGroup: account.blood_group,
      mobile: account.mobile,
      email: account.email,
      registrationStatus: account.registration_status || 'APPROVED',
      accountStatus: account.account_status || 'ACTIVE',
      medicalScreeningStatus: account.medical_screening_status || account.screening_status || 'PENDING_SCREENING'
    }
  });
});

/**
 * Get Current Authenticated Session (`/api/auth/me`)
 */
router.get('/me', (req, res) => {
  const token = getSessionToken(req);
  if (!token) {
    return res.json({ authenticated: false });
  }

  const session = db.prepare(`
    SELECT * FROM sessions
    WHERE token = ? AND expires_at > datetime('now')
  `).get(token);

  if (!session) {
    return res.json({ authenticated: false });
  }

  if (session.user_type === 'DONOR') {
    const donor = db.prepare('SELECT * FROM donors WHERE id = ?').get(session.user_id);
    if (!donor) return res.json({ authenticated: false });
    return res.json({
      authenticated: true,
      userType: 'DONOR',
      token,
      user: {
        id: donor.id,
        fullName: donor.full_name,
        bloodGroup: donor.blood_group,
        mobile: donor.mobile,
        email: donor.email,
        registrationStatus: donor.registration_status || 'APPROVED',
        accountStatus: donor.account_status || 'ACTIVE',
        medicalScreeningStatus: donor.medical_screening_status || donor.screening_status || 'PENDING_SCREENING'
      }
    });
  } else if (session.user_type === 'HOSPITAL') {
    const hospital = db.prepare('SELECT id, name, email, phone, city FROM hospitals WHERE id = ?').get(session.hospital_id || session.user_id);
    if (!hospital) return res.json({ authenticated: false });
    return res.json({
      authenticated: true,
      userType: 'HOSPITAL',
      token,
      user: hospital
    });
  }

  res.json({ authenticated: false });
});

/**
 * Logout & Session Invalidation (Requirement 8)
 */
router.post('/logout', (req, res) => {
  const token = getSessionToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  res.setHeader(
    'Set-Cookie',
    'session_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax'
  );

  res.json({ success: true, message: 'Logged out successfully.' });
});

/**
 * Demo accounts list (for login guidance)
 */
router.get('/demo-accounts', (req, res) => {
  const hospitals = db.prepare('SELECT id, name, email, city FROM hospitals').all();
  const donors = db.prepare(`
    SELECT d.id, d.full_name, d.blood_group, d.mobile, d.email,
           d.registration_status, d.account_status, d.medical_screening_status,
           da.account_status as is_activated
    FROM donors d
    LEFT JOIN donor_accounts da ON d.id = da.donor_id
    ORDER BY d.id ASC
    LIMIT 6
  `).all();

  const demoApplications = db.prepare(`
    SELECT application_id, full_name, blood_group, mobile, status, rejection_reason
    FROM donor_applications
    ORDER BY id DESC
    LIMIT 4
  `).all();

  res.json({
    hospitals,
    donors,
    demoApplications
  });
});

module.exports = router;
