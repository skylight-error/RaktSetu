const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { generateApplicationId, generateActivationOtp } = require('../utils/crypto');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * Public Donor Registration Application (Requirement 3)
 */
router.post('/register', (req, res) => {
  const {
    fullName,
    dob,
    gender,
    mobile,
    email,
    bloodGroup,
    address,
    city,
    pincode,
    preferredHospitalId,
    consentContact
  } = req.body;

  // Validation
  if (!fullName || !dob || !mobile || !bloodGroup || !pincode) {
    return res.status(400).json({ error: 'Full name, date of birth, mobile number, blood group, and PIN code are required.' });
  }

  const cleanMobile = mobile.toString().replace(/\D/g, '');
  if (cleanMobile.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile phone number.' });
  }

  const formattedMobile = cleanMobile.length === 10
    ? `+91 ${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5)}`
    : mobile;

  const bg = bloodGroup.toUpperCase().trim();
  if (!VALID_BLOOD_GROUPS.includes(bg)) {
    return res.status(400).json({ error: `Invalid blood group. Must be one of: ${VALID_BLOOD_GROUPS.join(', ')}` });
  }

  // Calculate age
  let age = 25;
  try {
    const birthDate = new Date(dob);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  } catch (e) {
    age = 25;
  }

  if (age < 18) {
    return res.status(400).json({ error: 'Blood donor applicants must be at least 18 years of age.' });
  }

  // Check duplicate active donor
  const existingDonor = db.prepare(`
    SELECT id, full_name FROM donors
    WHERE replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE ?
  `).get(`%${cleanMobile}%`);

  if (existingDonor) {
    return res.status(400).json({
      error: `A registered donor profile already exists for this mobile number (${existingDonor.full_name}). Please go to Donor Login or use First-Time Account Activation.`
    });
  }

  // Check duplicate pending application
  const existingPending = db.prepare(`
    SELECT application_id, status FROM donor_applications
    WHERE replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE ? AND status = 'PENDING_APPROVAL'
  `).get(`%${cleanMobile}%`);

  if (existingPending) {
    return res.status(400).json({
      error: `An application with this mobile number is already pending hospital review (Application ID: ${existingPending.application_id}). You can check your status on the Track Application page.`
    });
  }

  const applicationId = generateApplicationId();
  const activationOtp = generateActivationOtp();

  try {
    const insert = db.prepare(`
      INSERT INTO donor_applications (
        application_id, full_name, dob, age, gender, mobile, email, blood_group,
        address, city, pincode, preferred_hospital_id, consent_contact, status,
        activation_otp, activation_otp_expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL', ?, datetime('now', '+7 days'))
    `);

    const result = insert.run(
      applicationId,
      fullName.trim(),
      dob,
      age,
      gender || 'Unspecified',
      formattedMobile,
      email ? email.trim().toLowerCase() : null,
      bg,
      address || 'Mumbai',
      city || 'Mumbai',
      pincode,
      preferredHospitalId ? Number(preferredHospitalId) : 1,
      consentContact ? 1 : 0,
      activationOtp
    );

    // Create an in-app notification record
    db.prepare(`
      INSERT INTO notifications (application_id, title, message, type)
      VALUES (?, 'Application Submitted', ?, 'REGISTRATION_STATUS')
    `).run(
      result.lastInsertRowid,
      `Your donor registration application ${applicationId} has been received. Hospital verification is required before account activation.`
    );

    res.status(201).json({
      success: true,
      applicationId,
      status: 'PENDING_APPROVAL',
      message: `Registration application submitted successfully! Your Application ID is ${applicationId}. Authorised hospital staff will review your details before your account can be activated.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit application: ' + err.message });
  }
});

/**
 * Public Donor Application Status Tracking (Requirement 4)
 * Secure lookup requires Application ID + Mobile digits
 */
router.post('/status', (req, res) => {
  const { applicationId, mobile } = req.body;

  if (!applicationId || !mobile) {
    return res.status(400).json({ error: 'Application ID and registered mobile number are required to verify status.' });
  }

  const cleanMobile = mobile.toString().replace(/\D/g, '');
  const cleanAppId = applicationId.toString().trim().toUpperCase();

  const app = db.prepare(`
    SELECT a.*, h.name as hospital_name, h.phone as hospital_phone
    FROM donor_applications a
    LEFT JOIN hospitals h ON a.preferred_hospital_id = h.id
    WHERE upper(a.application_id) = ?
      AND replace(replace(replace(a.mobile, ' ', ''), '+', ''), '-', '') LIKE ?
  `).get(cleanAppId, `%${cleanMobile}%`);

  if (!app) {
    return res.status(404).json({ error: 'No registration application found matching this Application ID and mobile number.' });
  }

  // Check if already activated
  const linkedAccount = db.prepare('SELECT account_status FROM donor_accounts WHERE application_id = ?').get(app.id);

  // Mask mobile & email to prevent exposing private data
  const rawMobile = app.mobile.replace(/\D/g, '');
  const maskedMobile = rawMobile.length >= 10
    ? `+91 ******${rawMobile.slice(-4)}`
    : '******';

  const maskedEmail = app.email
    ? `${app.email[0]}***@${app.email.split('@')[1] || 'mail.com'}`
    : 'Not provided';

  let statusMessage = '';
  let statusBadgeClass = 'status-pending';

  if (app.status === 'PENDING_APPROVAL') {
    statusMessage = 'Your application has been received and is currently under review by authorized hospital staff. Account activation will become available once verified.';
    statusBadgeClass = 'status-pending';
  } else if (app.status === 'APPROVED') {
    statusBadgeClass = 'status-approved';
    if (linkedAccount && linkedAccount.account_status === 'ACTIVE') {
      statusMessage = 'Your application was approved and your donor account is ACTIVE. You can log in using your password.';
    } else {
      statusMessage = `Congratulations! Your registration was verified and approved by ${app.hospital_name || 'Hospital Staff'} on ${app.reviewed_at ? app.reviewed_at.slice(0, 10) : 'recently'}. Please proceed to First-Time Account Activation to set your password.`;
    }
  } else if (app.status === 'REJECTED') {
    statusBadgeClass = 'status-deferred';
    statusMessage = `Your registration application was reviewed and not approved. Reason: ${app.rejection_reason || 'Administrative or contact verification requirement not met.'}`;
  }

  res.json({
    success: true,
    applicationId: app.application_id,
    applicantName: app.full_name,
    maskedMobile,
    maskedEmail,
    bloodGroup: app.blood_group,
    preferredHospitalName: app.hospital_name || 'Assigned Blood Centre',
    submittedAt: app.created_at,
    status: app.status,
    statusBadgeClass,
    statusMessage,
    rejectionReason: app.status === 'REJECTED' ? app.rejection_reason : null,
    reviewedAt: app.reviewed_at,
    reviewedByStaffName: app.reviewed_by_staff_name,
    canActivate: app.status === 'APPROVED' && (!linkedAccount || linkedAccount.account_status !== 'ACTIVE'),
    isActivated: !!(linkedAccount && linkedAccount.account_status === 'ACTIVE')
  });
});

module.exports = router;
