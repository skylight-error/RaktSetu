const express = require('express');
const router = express.Router();
const multer = require('multer');
const { db } = require('../db/database');
const {
  generateDonorTemplateBuffer,
  processExcelUpload,
  commitImportedDonors,
  generateErrorReportBuffer
} = require('../services/excelService');
const { generateActivationOtp } = require('../utils/crypto');
const { requireHospital } = require('../middleware/auth');
const { sendSMS, formatAppointmentSMS, getRecentSMSLogs } = require('../services/smsService');

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Hospital Dashboard Summary (Requirement 5 & 8)
 * Protected: requires hospital authentication
 */
router.get('/:hospitalId/dashboard-summary', requireHospital, (req, res) => {
  const hospitalId = Number(req.params.hospitalId) || req.hospital.id;

  // 1. Total usable blood units
  const totalBloodUnits = db.prepare(`
    SELECT COALESCE(SUM(quantity_units), 0) as count
    FROM inventory
    WHERE hospital_id = ? AND status = 'USABLE' AND expiry_date >= date('now')
  `).get(hospitalId).count;

  // 2. Near-expiry units (expiring within next 3 days)
  const nearExpiryUnits = db.prepare(`
    SELECT COALESCE(SUM(quantity_units), 0) as count
    FROM inventory
    WHERE hospital_id = ? AND (status = 'NEAR_EXPIRY' OR (expiry_date BETWEEN date('now') AND date('now', '+3 days') AND status != 'EXPIRED'))
  `).get(hospitalId).count;

  // 3. Expired units
  const expiredUnits = db.prepare(`
    SELECT COALESCE(SUM(quantity_units), 0) as count
    FROM inventory
    WHERE hospital_id = ? AND (status = 'EXPIRED' OR expiry_date < date('now'))
  `).get(hospitalId).count;

  // 4. Donor & Application counts
  const totalDonors = db.prepare('SELECT COUNT(*) as count FROM donors').get().count;
  const approvedDonors = db.prepare("SELECT COUNT(*) as count FROM donors WHERE registration_status = 'APPROVED' OR screening_status = 'APPROVED'").get().count;
  const pendingScreenings = db.prepare("SELECT COUNT(*) as count FROM donors WHERE screening_status IN ('PENDING SCREENING', 'PENDING VERIFICATION') OR medical_screening_status = 'PENDING_SCREENING'").get().count;
  const availableThisWeek = db.prepare("SELECT COUNT(*) as count FROM donors WHERE weekly_availability = 'AVAILABLE'").get().count;

  // Pending Registration Applications (Requirement 5)
  const pendingApplications = db.prepare("SELECT COUNT(*) as count FROM donor_applications WHERE status = 'PENDING_APPROVAL'").get().count;

  // 5. Urgent blood requests
  const urgentRequestsCount = db.prepare(`
    SELECT COUNT(*) as count FROM blood_requests
    WHERE hospital_id = ? AND status NOT IN ('FULFILLED', 'CANCELLED')
  `).get(hospitalId).count;

  // 6. Stock by Blood Group
  const stockByGroup = db.prepare(`
    SELECT blood_group, COALESCE(SUM(quantity_units), 0) as units
    FROM inventory
    WHERE hospital_id = ? AND status = 'USABLE' AND expiry_date >= date('now')
    GROUP BY blood_group
    ORDER BY blood_group ASC
  `).all(hospitalId);

  // 7. Stock by Component
  const stockByComponent = db.prepare(`
    SELECT component, COALESCE(SUM(quantity_units), 0) as units
    FROM inventory
    WHERE hospital_id = ? AND status = 'USABLE' AND expiry_date >= date('now')
    GROUP BY component
  `).all(hospitalId);

  // 8. Upcoming Appointments
  const upcomingAppointments = db.prepare(`
    SELECT a.*, d.full_name, d.blood_group, d.mobile
    FROM appointments a
    JOIN donors d ON a.donor_id = d.id
    WHERE a.hospital_id = ? AND a.status = 'SCHEDULED'
    ORDER BY a.appointment_date ASC, a.appointment_time ASC
    LIMIT 5
  `).all(hospitalId);

  // 9. Recent urgent blood requests
  const recentRequests = db.prepare(`
    SELECT * FROM blood_requests
    WHERE hospital_id = ?
    ORDER BY created_at DESC
    LIMIT 4
  `).all(hospitalId);

  res.json({
    hospitalId,
    metrics: {
      totalBloodUnits,
      nearExpiryUnits,
      expiredUnits,
      totalDonors,
      approvedDonors,
      pendingScreenings,
      pendingApplications,
      availableThisWeek,
      urgentRequestsCount
    },
    stockByGroup,
    stockByComponent,
    upcomingAppointments,
    recentRequests
  });
});

/**
 * List Donor Applications (Requirement 5)
 * Protected: requires hospital authentication
 */
router.get('/applications', requireHospital, (req, res) => {
  const { status, query, bloodGroup } = req.query;

  let sql = `
    SELECT a.*, h.name as preferred_hospital_name, da.account_status as is_activated
    FROM donor_applications a
    LEFT JOIN hospitals h ON a.preferred_hospital_id = h.id
    LEFT JOIN donor_accounts da ON a.id = da.application_id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'ALL') {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  if (bloodGroup && bloodGroup !== 'ALL') {
    sql += ' AND a.blood_group = ?';
    params.push(bloodGroup);
  }

  if (query) {
    sql += ' AND (a.full_name LIKE ? OR a.mobile LIKE ? OR a.application_id LIKE ? OR a.city LIKE ?)';
    params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }

  sql += ' ORDER BY a.id DESC';

  const applications = db.prepare(sql).all(...params);

  res.json({
    totalCount: applications.length,
    applications
  });
});

/**
 * Approve Donor Application (Requirement 5 & 10)
 * Only authorised hospital staff can approve registrations.
 * Distinction: Approval permits account activation; it does NOT clinically approve medical screening.
 */
router.post('/applications/:id/approve', requireHospital, (req, res) => {
  const appId = Number(req.params.id);
  const { staffName } = req.body;

  const app = db.prepare('SELECT * FROM donor_applications WHERE id = ?').get(appId);
  if (!app) {
    return res.status(404).json({ error: 'Donor application not found.' });
  }

  if (app.status === 'APPROVED') {
    return res.status(400).json({ error: 'This registration application has already been approved.' });
  }

  const otp = generateActivationOtp();
  const reviewer = staffName || req.hospital.name;

  let donorId = app.donor_id;
  if (!donorId) {
    const insertDonor = db.prepare(`
      INSERT INTO donors (
        application_id, full_name, dob, age, gender, mobile, email, blood_group,
        address, city, pincode, preferred_hospital_id, registration_status,
        account_status, medical_screening_status, screening_status, weekly_availability,
        latitude, longitude, consent_contact, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'NOT_ACTIVATED', 'PENDING_SCREENING', 'PENDING SCREENING', 'UNCONFIRMED', 19.0760, 72.8777, 1, 'ONLINE_APPLICATION')
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
      app.preferred_hospital_id || req.hospital.id
    );
    donorId = resInsert.lastInsertRowid;
  }

  db.prepare(`
    UPDATE donor_applications
    SET status = 'APPROVED',
        donor_id = ?,
        reviewed_by_hospital_id = ?,
        reviewed_by_staff_name = ?,
        reviewed_at = datetime('now'),
        activation_otp = ?,
        activation_otp_expires_at = datetime('now', '+7 days'),
        rejection_reason = NULL
    WHERE id = ?
  `).run(donorId, req.hospital.id, reviewer, otp, appId);

  // In-app notification
  db.prepare(`
    INSERT INTO notifications (application_id, title, message, type)
    VALUES (?, 'Registration Verified & Approved 🎉', ?, 'REGISTRATION_STATUS')
  `).run(
    app.id,
    `Your donor registration has been verified and approved by ${reviewer}. You may now complete First-Time Account Activation.`
  );

  res.json({
    success: true,
    message: `Application ${app.application_id} approved! The applicant is now eligible for first-time account activation. Pre-donation medical screening remains pending until in-person checkup.`
  });
});

/**
 * Reject Donor Application (Requirement 5)
 * Requires explanation reason; recorded with reviewer ID & timestamp.
 */
router.post('/applications/:id/reject', requireHospital, (req, res) => {
  const appId = Number(req.params.id);
  const { rejectionReason, staffName } = req.body;

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({ error: 'A specific reason for rejection is required.' });
  }

  const app = db.prepare('SELECT * FROM donor_applications WHERE id = ?').get(appId);
  if (!app) {
    return res.status(404).json({ error: 'Donor application not found.' });
  }

  const reviewer = staffName || req.hospital.name;

  db.prepare(`
    UPDATE donor_applications
    SET status = 'REJECTED',
        reviewed_by_hospital_id = ?,
        reviewed_by_staff_name = ?,
        reviewed_at = datetime('now'),
        rejection_reason = ?
    WHERE id = ?
  `).run(req.hospital.id, reviewer, rejectionReason.trim(), appId);

  // If a donor account was somehow linked, disable it
  db.prepare("UPDATE donor_accounts SET account_status = 'DISABLED' WHERE application_id = ?").run(appId);

  // In-app notification
  db.prepare(`
    INSERT INTO notifications (application_id, title, message, type)
    VALUES (?, 'Registration Application Not Approved', ?, 'REGISTRATION_STATUS')
  `).run(
    app.id,
    `Your registration application was reviewed and not approved. Reason: ${rejectionReason.trim()}`
  );

  res.json({
    success: true,
    message: `Application ${app.application_id} marked as REJECTED. Rejection reason recorded.`
  });
});

/**
 * Hospital Donor Registry (Search & Filters)
 * Protected: requires hospital authentication
 */
router.get('/donors', requireHospital, (req, res) => {
  const { query, bloodGroup, screeningStatus, availability, city } = req.query;

  let sql = 'SELECT * FROM donors WHERE 1=1';
  const params = [];

  if (query) {
    sql += ' AND (full_name LIKE ? OR mobile LIKE ? OR email LIKE ? OR pincode LIKE ?)';
    params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }

  if (bloodGroup && bloodGroup !== 'ALL') {
    sql += ' AND blood_group = ?';
    params.push(bloodGroup);
  }

  if (screeningStatus && screeningStatus !== 'ALL') {
    sql += ' AND (screening_status = ? OR medical_screening_status = ?)';
    params.push(screeningStatus, screeningStatus);
  }

  if (availability && availability !== 'ALL') {
    sql += ' AND weekly_availability = ?';
    params.push(availability);
  }

  if (city && city !== 'ALL') {
    sql += ' AND city LIKE ?';
    params.push(`%${city}%`);
  }

  sql += ' ORDER BY id DESC';

  const donors = db.prepare(sql).all(...params);
  res.json({
    totalCount: donors.length,
    donors
  });
});

/**
 * Get individual donor details with medical & appointment history
 * Protected: requires hospital authentication
 */
router.get('/donors/:id', requireHospital, (req, res) => {
  const donor = db.prepare('SELECT * FROM donors WHERE id = ?').get(req.params.id);
  if (!donor) {
    return res.status(404).json({ error: 'Donor not found' });
  }

  const appointments = db.prepare(`
    SELECT a.*, h.name as hospital_name
    FROM appointments a
    JOIN hospitals h ON a.hospital_id = h.id
    WHERE a.donor_id = ?
    ORDER BY a.appointment_date DESC
  `).all(donor.id);

  const screenings = db.prepare(`
    SELECT s.*, h.name as hospital_name
    FROM screening_records s
    JOIN hospitals h ON s.hospital_id = h.id
    WHERE s.donor_id = ?
    ORDER BY s.screening_date DESC
  `).all(donor.id);

  const contactLogs = db.prepare(`
    SELECT c.*, h.name as hospital_name, r.urgency, r.component
    FROM donor_contact_records c
    JOIN hospitals h ON c.hospital_id = h.id
    JOIN blood_requests r ON c.request_id = r.id
    WHERE c.donor_id = ?
    ORDER BY c.contacted_at DESC
  `).all(donor.id);

  res.json({
    donor,
    appointments,
    screenings,
    contactLogs
  });
});

/**
 * Add donor manually (Workflow 6.A)
 * Protected: requires hospital authentication
 */
router.post('/donors', requireHospital, (req, res) => {
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
    lastDonationDate,
    screeningStatus,
    nextEligibleDate,
    weeklyAvailability
  } = req.body;

  if (!fullName || !mobile || !bloodGroup) {
    return res.status(400).json({ error: 'Full name, mobile and blood group are required.' });
  }

  let age = 28;
  if (dob) {
    try {
      age = Math.max(18, 2026 - new Date(dob).getFullYear());
    } catch (e) {
      age = 28;
    }
  }

  try {
    const insert = db.prepare(`
      INSERT INTO donors (
        full_name, dob, age, gender, mobile, email, blood_group, address, city, pincode,
        registration_status, account_status, medical_screening_status, screening_status,
        last_donation_date, next_eligible_date, weekly_availability,
        latitude, longitude, consent_contact, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'ACTIVE', ?, ?, ?, ?, ?, 19.0760, 72.8777, 1, 'MANUAL_HOSPITAL_ENTRY')
    `);

    const result = insert.run(
      fullName,
      dob || '1996-01-01',
      age,
      gender || 'Unspecified',
      mobile,
      email || null,
      bloodGroup,
      address || 'Mumbai',
      city || 'Mumbai',
      pincode || '400001',
      screeningStatus || 'PENDING SCREENING',
      screeningStatus || 'PENDING SCREENING',
      lastDonationDate || null,
      nextEligibleDate || null,
      weeklyAvailability || 'UNCONFIRMED'
    );

    const newDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      success: true,
      donor: newDonor,
      message: 'Donor added successfully to hospital database.'
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add donor: ' + err.message });
  }
});

/**
 * Schedule screening appointment (Workflow 5 Stage 2 & Requirement 10)
 * Protected: requires hospital authentication
 * Dispatches live/simulated SMS via Fast2SMS/MSG91 to the donor/applicant mobile.
 */
router.post('/schedule-screening', requireHospital, async (req, res) => {
  const { donorId, applicationId, hospitalId, appointmentDate, appointmentTime, instructions } = req.body;

  let targetDonorId = donorId ? Number(donorId) : null;
  let targetApp = null;

  // Support scheduling by either donorId or applicationId
  if (!targetDonorId && applicationId) {
    targetApp = db.prepare('SELECT * FROM donor_applications WHERE id = ? OR application_id = ?').get(applicationId, applicationId);
    if (targetApp) {
      if (targetApp.donor_id) {
        targetDonorId = targetApp.donor_id;
      } else {
        const donorRow = db.prepare('SELECT id FROM donors WHERE application_id = ?').get(targetApp.id);
        if (donorRow) {
          targetDonorId = donorRow.id;
        } else {
          const insertD = db.prepare(`
            INSERT INTO donors (
              full_name, dob, age, gender, blood_group, mobile, email,
              address, city, pincode, preferred_hospital_id, registration_status,
              account_status, medical_screening_status, screening_status,
              weekly_availability, consent_contact, application_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'NOT_ACTIVATED', 'APPOINTMENT_SCHEDULED', 'APPOINTMENT SCHEDULED', 'AVAILABLE', 1, ?)
          `).run(
            targetApp.full_name, targetApp.dob, targetApp.age || 25, targetApp.gender || 'O',
            targetApp.blood_group, targetApp.mobile, targetApp.email, targetApp.address,
            targetApp.city, targetApp.pincode, targetApp.preferred_hospital_id || req.hospital.id,
            targetApp.id
          );
          targetDonorId = insertD.lastInsertRowid;
          db.prepare("UPDATE donor_applications SET status = 'APPROVED', donor_id = ? WHERE id = ?").run(targetDonorId, targetApp.id);
        }
      }
    }
  }

  if (!targetDonorId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Donor ID (or Application ID), appointment date, and time are required.' });
  }

  const hId = hospitalId || req.hospital.id;

  // 1. Insert appointment
  const insertAppt = db.prepare(`
    INSERT INTO appointments (donor_id, hospital_id, appointment_date, appointment_time, status, instructions)
    VALUES (?, ?, ?, ?, 'SCHEDULED', ?)
  `);
  insertAppt.run(targetDonorId, hId, appointmentDate, appointmentTime, instructions || 'Standard blood donor medical screening.');

  // 2. Update donor status to APPOINTMENT SCHEDULED
  db.prepare(`
    UPDATE donors
    SET screening_status = 'APPOINTMENT SCHEDULED',
        medical_screening_status = 'APPOINTMENT_SCHEDULED'
    WHERE id = ?
  `).run(targetDonorId);

  // 3. Hospital & Donor details
  const hospital = db.prepare('SELECT name, phone, address FROM hospitals WHERE id = ?').get(hId);
  const updatedDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(targetDonorId);

  // 4. In-App Notification
  db.prepare(`
    INSERT INTO notifications (donor_id, title, message, type)
    VALUES (?, 'Screening Appointment Scheduled 🗓️', ?, 'SCREENING_UPDATE')
  `).run(
    targetDonorId,
    `Your medical donor screening is scheduled at ${hospital ? hospital.name : 'Blood Centre'} on ${appointmentDate} at ${appointmentTime}. ${instructions || ''}`
  );

  // 5. Dispatch SMS Notification via Fast2SMS / MSG91
  let smsResult = null;
  if (updatedDonor && updatedDonor.mobile) {
    const smsMessage = formatAppointmentSMS({
      donorName: updatedDonor.full_name,
      hospitalName: hospital ? hospital.name : 'Blood Centre',
      date: appointmentDate,
      time: appointmentTime,
      instructions: instructions || 'Standard blood donor medical screening.',
      hospitalPhone: hospital ? hospital.phone : null,
      hospitalAddress: hospital ? hospital.address : null
    });

    smsResult = await sendSMS({
      to: updatedDonor.mobile,
      message: smsMessage,
      type: 'APPOINTMENT_SCHEDULED',
      donorId: updatedDonor.id,
      applicationId: updatedDonor.application_id || (targetApp ? targetApp.id : null)
    });
  }

  res.json({
    success: true,
    donor: updatedDonor,
    sms: smsResult,
    message: smsResult && smsResult.success
      ? `Appointment scheduled & SMS dispatched to ${updatedDonor.mobile}!`
      : 'Screening appointment confirmed and reflected on donor portal.'
  });
});

/**
 * Get recent SMS logs (Protected: hospital staff audit)
 */
router.get('/sms-logs', requireHospital, (req, res) => {
  res.json({ logs: getRecentSMSLogs(30) });
});

/**
 * Medical screening and approval/deferral decision (Requirement 10)
 * Protected: requires hospital authentication
 * Only medical staff can determine clinical fitness!
 */
router.post('/record-screening-decision', requireHospital, (req, res) => {
  const { donorId, hospitalId, staffName, status, staffNotes, deferralReason, nextEligibleDate } = req.body;
  if (!donorId || !status) {
    return res.status(400).json({ error: 'Donor ID and clinical status decision are required.' });
  }

  const hId = hospitalId || req.hospital.id;

  // Calculate screening valid until (standard 1 year from approval)
  let validUntil = null;
  if (status === 'APPROVED' || status === 'MEDICALLY_APPROVED') {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    validUntil = d.toISOString().split('T')[0];
  }

  // Normalize medical screening status
  const medStatus = (status === 'APPROVED' || status === 'MEDICALLY_APPROVED')
    ? 'MEDICALLY_APPROVED'
    : (status === 'TEMPORARILY DEFERRED' || status === 'TEMPORARILY_DEFERRED')
      ? 'TEMPORARILY_DEFERRED'
      : 'NOT_APPROVED';

  const legacyStatus = (medStatus === 'MEDICALLY_APPROVED')
    ? 'APPROVED'
    : (medStatus === 'TEMPORARILY_DEFERRED')
      ? 'TEMPORARILY DEFERRED'
      : 'NOT APPROVED';

  // 1. Insert screening record
  const insertRecord = db.prepare(`
    INSERT INTO screening_records (donor_id, hospital_id, staff_name, screening_date, status, deferral_reason, staff_notes, next_eligible_date)
    VALUES (?, ?, ?, date('now'), ?, ?, ?, ?)
  `);
  insertRecord.run(donorId, hId, staffName || req.hospital.name, legacyStatus, deferralReason || null, staffNotes || '', nextEligibleDate || null);

  // 2. Update appointments to COMPLETED
  db.prepare(`
    UPDATE appointments
    SET status = 'COMPLETED'
    WHERE donor_id = ? AND hospital_id = ? AND status = 'SCHEDULED'
  `).run(donorId, hId);

  // 3. Update donor profile with both medical_screening_status and legacy screening_status
  db.prepare(`
    UPDATE donors
    SET medical_screening_status = ?,
        screening_status = ?,
        screening_valid_until = ?,
        next_eligible_date = COALESCE(?, next_eligible_date)
    WHERE id = ?
  `).run(medStatus, legacyStatus, validUntil, nextEligibleDate || null, donorId);

  // 4. Send notification to donor
  let notifMsg = '';
  if (medStatus === 'MEDICALLY_APPROVED') {
    notifMsg = 'Congratulations! Your physical medical screening has been APPROVED by the blood bank. You are now clinically cleared for blood donation.';
  } else if (medStatus === 'TEMPORARILY_DEFERRED') {
    notifMsg = `Your donation is temporarily deferred for clinical safety. Reason: ${deferralReason || staffNotes}. Next review date: ${nextEligibleDate || 'As advised'}.`;
  } else {
    notifMsg = 'Your screening assessment has been completed. Currently you are not approved for blood donation based on clinical criteria.';
  }

  db.prepare(`
    INSERT INTO notifications (donor_id, title, message, type)
    VALUES (?, 'Medical Screening Outcome', ?, 'SCREENING_UPDATE')
  `).run(donorId, notifMsg);

  const updatedDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donorId);

  res.json({
    success: true,
    donor: updatedDonor,
    message: `Medical screening recorded as ${legacyStatus}. Records synchronized.`
  });
});

/**
 * Download standard Excel template
 */
router.get('/excel/template', (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'xlsx';
  const buffer = generateDonorTemplateBuffer(format);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="RaktSetu_Donor_Template.csv"');
  } else {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="RaktSetu_Donor_Template.xlsx"');
  }
  res.send(buffer);
});

/**
 * Upload and preview Excel/CSV (Workflow 6.B Step 1-8)
 * Protected: requires hospital authentication
 */
router.post('/excel/preview', requireHospital, upload.single('file'), (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'Please upload an Excel (.xlsx, .xls) or CSV file.' });
  }

  try {
    const analysis = processExcelUpload(req.file.buffer);
    res.json({
      success: true,
      analysis
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to process file: ' + err.message });
  }
});

/**
 * Confirm and save validated Excel records into DB (Workflow 6.B Step 10-12)
 * Protected: requires hospital authentication
 */
router.post('/excel/confirm-import', requireHospital, (req, res) => {
  const { validRows, hospitalId } = req.body;
  if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
    return res.status(400).json({ error: 'No valid rows provided for import.' });
  }

  const result = commitImportedDonors(validRows, hospitalId || req.hospital.id);
  res.json({
    success: true,
    message: `Successfully imported ${result.insertedCount} donor records with status PENDING VERIFICATION.`,
    insertedCount: result.insertedCount
  });
});

/**
 * Generate error report file for invalid rows
 */
router.post('/excel/error-report', requireHospital, (req, res) => {
  const { invalidRows } = req.body;
  if (!invalidRows || !Array.isArray(invalidRows) || invalidRows.length === 0) {
    return res.status(400).json({ error: 'No invalid rows provided.' });
  }

  const buffer = generateErrorReportBuffer(invalidRows);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="RaktSetu_Import_Errors.xlsx"');
  res.send(buffer);
});

module.exports = router;
