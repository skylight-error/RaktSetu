const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  generateApplicationId,
  generateHospitalApplicationId,
  generateActivationOtp
} = require('../utils/crypto');
const {
  getSessionToken,
  requireAuth,
  loginRateLimiter,
  recordFailedLogin,
  resetLoginAttempts
} = require('../middleware/auth');

/**
 * Hospital Registration (Requirement 2)
 */
router.post('/hospital/register', (req, res) => {
  const { name, email, phone, address, city, pincode, password, confirmPassword } = req.body;

  if (!name || !email || !phone || !address || !city || !pincode || !password) {
    return res.status(400).json({ error: 'Hospital name, official email, contact number, address, city, PIN code, and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
    return res.status(400).json({ error: 'Please enter a valid official hospital email address.' });
  }

  const cleanPhone = phone.toString().replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit hospital contact number.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  if (confirmPassword && password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match. Please re-enter.' });
  }

  // Duplicate email check
  const existing = db.prepare('SELECT id, name, registration_status FROM hospitals WHERE lower(email) = ?').get(cleanEmail);
  if (existing) {
    return res.status(400).json({
      error: `A hospital registration with this official email already exists (${existing.name}). If your application is pending or approved, please track its status or proceed to login.`
    });
  }

  const { hash, salt } = hashPassword(password);
  const applicationId = generateHospitalApplicationId();
  const activationOtp = generateActivationOtp();

  try {
    const insert = db.prepare(`
      INSERT INTO hospitals (
        name, email, phone, address, city, pincode, latitude, longitude,
        password_hash, password_salt, application_id, registration_status,
        account_status, activation_otp, activation_otp_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 19.0760, 72.8777, ?, ?, ?, 'PENDING_APPROVAL', 'NOT_ACTIVATED', ?, datetime('now', '+7 days'))
    `);

    const result = insert.run(
      name.trim(),
      cleanEmail,
      phone.trim(),
      address.trim(),
      city.trim(),
      pincode.trim(),
      hash,
      salt,
      applicationId,
      activationOtp
    );

    res.status(201).json({
      success: true,
      hospitalId: result.lastInsertRowid,
      applicationId,
      registrationStatus: 'PENDING_APPROVAL',
      accountStatus: 'NOT_ACTIVATED',
      message: `Hospital registration application submitted successfully! Your Application ID is ${applicationId}. Authorised RaktSetu administrators will review and verify your facility credentials before account activation.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit hospital registration: ' + err.message });
  }
});

/**
 * Request Hospital Account Activation Verification Code / OTP (Requirement 4)
 */
router.post('/hospital/request-activation-code', (req, res) => {
  const { email, applicationId } = req.body;
  const lookup = (email || applicationId || '').toString().trim().toLowerCase();

  if (!lookup) {
    return res.status(400).json({ error: 'Official email or Application ID is required.' });
  }

  const hosp = db.prepare(`
    SELECT * FROM hospitals
    WHERE lower(email) = ? OR lower(application_id) = ?
  `).get(lookup, lookup);

  if (!hosp) {
    return res.status(404).json({ error: 'No hospital application found with matching email or application ID.' });
  }

  if (hosp.registration_status === 'PENDING_APPROVAL') {
    return res.status(403).json({
      error: `Your hospital application (${hosp.application_id || '#' + hosp.id}) is still PENDING APPROVAL by RaktSetu administration. Account activation is only permitted after administrator approval.`
    });
  }

  if (hosp.registration_status === 'REJECTED') {
    return res.status(403).json({
      error: `Your hospital application was REJECTED and not approved. Reason: ${hosp.rejection_reason || 'Licensing accreditation requirement not met.'}`
    });
  }

  if (hosp.account_status === 'ACTIVE') {
    return res.status(400).json({
      error: 'This hospital account is already active! Please proceed directly to Hospital Login.'
    });
  }

  const otp = hosp.activation_otp || generateActivationOtp();
  db.prepare(`
    UPDATE hospitals
    SET activation_otp = ?, activation_otp_expires_at = datetime('now', '+7 days')
    WHERE id = ?
  `).run(otp, hosp.id);

  res.json({
    success: true,
    hospitalId: hosp.id,
    hospitalName: hosp.name,
    applicationId: hosp.application_id,
    email: hosp.email,
    demoOtpNotice: 'DEMO SIMULATION: Real SMS/email gateway is simulated for academic presentation.',
    demoActivationOtp: otp,
    activationCode: otp,
    message: `Activation verification code generated for ${hosp.name}. Enter the 6-digit code to complete account activation.`
  });
});

/**
 * Complete First-Time Hospital Account Activation (Requirement 4)
 */
router.post('/hospital/activate', (req, res) => {
  const { email, applicationId, password, confirmPassword } = req.body;
  const activationCode = req.body.activationCode || req.body.otp || req.body.code;
  const lookup = (email || applicationId || '').toString().trim().toLowerCase();

  if (!lookup || !activationCode) {
    return res.status(400).json({ error: 'Hospital email/application ID and activation verification code are required.' });
  }

  const hosp = db.prepare(`
    SELECT * FROM hospitals
    WHERE lower(email) = ? OR lower(application_id) = ?
  `).get(lookup, lookup);

  if (!hosp) {
    return res.status(404).json({ error: 'Hospital not found.' });
  }

  if (hosp.registration_status !== 'APPROVED') {
    return res.status(403).json({
      error: `Cannot activate account. Hospital registration status is currently ${hosp.registration_status}. Activation is only allowed for APPROVED applications.`
    });
  }

  if (!hosp.activation_otp || hosp.activation_otp.toString().trim() !== activationCode.toString().trim()) {
    return res.status(400).json({ error: 'Invalid or expired activation code. Please check the code or request a new one.' });
  }

  // Update password if provided
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    const { hash, salt } = hashPassword(password);
    db.prepare('UPDATE hospitals SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, hosp.id);
  }

  // Activate hospital account
  db.prepare(`
    UPDATE hospitals
    SET account_status = 'ACTIVE',
        activation_otp = NULL
    WHERE id = ?
  `).run(hosp.id);

  res.json({
    success: true,
    message: `Hospital account for ${hosp.name} successfully activated! You can now log in using your official email and password.`
  });
});

/**
 * Hospital Login (Requirement 5)
 */
router.post('/hospital/login', loginRateLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Hospital official email and password are required.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const hospital = db.prepare('SELECT * FROM hospitals WHERE lower(email) = ?').get(cleanEmail);
  if (!hospital) {
    recordFailedLogin(req);
    return res.status(401).json({ error: 'Invalid hospital email or password.' });
  }

  // Check Registration Status
  if (hospital.registration_status === 'PENDING_APPROVAL') {
    return res.status(403).json({
      error: `Your hospital registration (${hospital.application_id || 'ID #' + hospital.id}) is currently PENDING approval by RaktSetu administration. You will be able to activate your account once approved.`,
      registrationStatus: 'PENDING_APPROVAL',
      accountStatus: hospital.account_status || 'NOT_ACTIVATED'
    });
  }

  if (hospital.registration_status === 'REJECTED') {
    return res.status(403).json({
      error: `Your hospital registration application was not approved by administration. Reason: ${hospital.rejection_reason || 'Licensing accreditation review requirement not met.'}`,
      registrationStatus: 'REJECTED'
    });
  }

  // Check Account Status
  if (hospital.account_status === 'NOT_ACTIVATED') {
    return res.status(403).json({
      error: `Your hospital registration has been APPROVED! However, your account has not been activated yet. Please complete First-Time Hospital Activation.`,
      registrationStatus: 'APPROVED',
      accountStatus: 'NOT_ACTIVATED'
    });
  }

  if (hospital.account_status === 'DISABLED') {
    return res.status(403).json({
      error: 'Your hospital account has been disabled. Please contact RaktSetu administration.',
      accountStatus: 'DISABLED'
    });
  }

  // Verify password: support secure hash with salt, or legacy seed password
  let isValid = false;
  if (hospital.password_salt && hospital.password_hash) {
    isValid = verifyPassword(password, hospital.password_hash, hospital.password_salt);
  } else if (hospital.password_hash === password) {
    isValid = true;
    const { hash, salt } = hashPassword(password);
    db.prepare('UPDATE hospitals SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, hospital.id);
  }

  if (!isValid) {
    recordFailedLogin(req);
    return res.status(401).json({ error: 'Invalid hospital email or password.' });
  }

  resetLoginAttempts(req);

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
      pincode: hospital.pincode,
      registrationStatus: hospital.registration_status,
      accountStatus: hospital.account_status
    }
  });
});

/**
 * Administrator Login (Requirement 3)
 */
router.post('/admin/login', loginRateLimiter, (req, res) => {
  const { username, email, password } = req.body;
  const loginId = (username || email || '').toString().trim().toLowerCase();

  if (!loginId || !password) {
    return res.status(400).json({ error: 'Administrator username/email and password are required.' });
  }

  const admin = db.prepare(`
    SELECT * FROM administrators
    WHERE lower(username) = ? OR lower(email) = ?
  `).get(loginId, loginId);

  if (!admin) {
    recordFailedLogin(req);
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  const isValid = verifyPassword(password, admin.password_hash, admin.password_salt);
  if (!isValid) {
    recordFailedLogin(req);
    return res.status(401).json({ error: 'Invalid administrator credentials.' });
  }

  resetLoginAttempts(req);

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (token, user_id, user_type, role, expires_at)
    VALUES (?, ?, 'ADMIN', ?, ?)
  `).run(token, admin.id, admin.role || 'SUPER_ADMIN', expiresAt);

  res.setHeader(
    'Set-Cookie',
    `session_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  res.json({
    success: true,
    userType: 'ADMIN',
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role
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
  } else if (session.user_type === 'ADMIN') {
    const admin = db.prepare('SELECT id, username, email, full_name, role FROM administrators WHERE id = ?').get(session.user_id);
    if (!admin) return res.json({ authenticated: false });
    return res.json({
      authenticated: true,
      userType: 'ADMIN',
      token,
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role
      }
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
