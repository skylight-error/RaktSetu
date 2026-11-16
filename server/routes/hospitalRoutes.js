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

const upload = multer({ storage: multer.memoryStorage() });

/**
 * Hospital Dashboard Summary
 */
router.get('/:hospitalId/dashboard-summary', (req, res) => {
  const hospitalId = Number(req.params.hospitalId) || 1;

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

  // 4. Donor counts
  const totalDonors = db.prepare('SELECT COUNT(*) as count FROM donors').get().count;
  const approvedDonors = db.prepare("SELECT COUNT(*) as count FROM donors WHERE screening_status = 'APPROVED'").get().count;
  const pendingScreenings = db.prepare("SELECT COUNT(*) as count FROM donors WHERE screening_status IN ('PENDING SCREENING', 'PENDING VERIFICATION')").get().count;
  const availableThisWeek = db.prepare("SELECT COUNT(*) as count FROM donors WHERE weekly_availability = 'AVAILABLE'").get().count;

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
 * Hospital Donor Registry (Search & Filters)
 */
router.get('/donors', (req, res) => {
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
    sql += ' AND screening_status = ?';
    params.push(screeningStatus);
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
 */
router.get('/donors/:id', (req, res) => {
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
 */
router.post('/donors', (req, res) => {
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
    weeklyAvailability,
    notes
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
        screening_status, last_donation_date, next_eligible_date, weekly_availability,
        latitude, longitude, consent_contact, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 19.0760, 72.8777, 1, 'MANUAL_HOSPITAL_ENTRY')
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
 * Schedule screening appointment (Workflow 5 Stage 2)
 */
router.post('/schedule-screening', (req, res) => {
  const { donorId, hospitalId, appointmentDate, appointmentTime, instructions } = req.body;
  if (!donorId || !hospitalId || !appointmentDate || !appointmentTime) {
    return res.status(400).json({ error: 'Donor ID, hospital ID, date, and time are required.' });
  }

  // 1. Insert appointment
  const insertAppt = db.prepare(`
    INSERT INTO appointments (donor_id, hospital_id, appointment_date, appointment_time, status, instructions)
    VALUES (?, ?, ?, ?, 'SCHEDULED', ?)
  `);
  insertAppt.run(donorId, hospitalId, appointmentDate, appointmentTime, instructions || 'Standard blood donor medical screening.');

  // 2. Update donor status to APPOINTMENT SCHEDULED
  db.prepare(`
    UPDATE donors
    SET screening_status = 'APPOINTMENT SCHEDULED'
    WHERE id = ?
  `).run(donorId);

  // 3. Notify donor
  const hospital = db.prepare('SELECT name FROM hospitals WHERE id = ?').get(hospitalId);
  db.prepare(`
    INSERT INTO notifications (donor_id, title, message, type)
    VALUES (?, 'Screening Appointment Scheduled 🗓️', ?, 'SCREENING_UPDATE')
  `).run(
    donorId,
    `Your medical donor screening is scheduled at ${hospital ? hospital.name : 'Blood Centre'} on ${appointmentDate} at ${appointmentTime}. ${instructions || ''}`
  );

  const updatedDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donorId);

  res.json({
    success: true,
    donor: updatedDonor,
    message: 'Screening appointment confirmed and reflected on donor portal.'
  });
});

/**
 * Medical screening and approval/deferral decision (Workflow 5 Stage 3 & 4)
 */
router.post('/record-screening-decision', (req, res) => {
  const { donorId, hospitalId, staffName, status, staffNotes, deferralReason, nextEligibleDate } = req.body;
  if (!donorId || !hospitalId || !status) {
    return res.status(400).json({ error: 'Donor ID, hospital ID, and status decision are required.' });
  }

  // Calculate screening valid until (standard 1 year from approval)
  let validUntil = null;
  if (status === 'APPROVED') {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    validUntil = d.toISOString().split('T')[0];
  }

  // 1. Insert screening record
  const insertRecord = db.prepare(`
    INSERT INTO screening_records (donor_id, hospital_id, staff_name, screening_date, status, deferral_reason, staff_notes, next_eligible_date)
    VALUES (?, ?, ?, date('now'), ?, ?, ?, ?)
  `);
  insertRecord.run(donorId, hospitalId, staffName || 'Authorised Medical Officer', status, deferralReason || null, staffNotes || '', nextEligibleDate || null);

  // 2. Update appointments to COMPLETED
  db.prepare(`
    UPDATE appointments
    SET status = 'COMPLETED'
    WHERE donor_id = ? AND hospital_id = ? AND status = 'SCHEDULED'
  `).run(donorId, hospitalId);

  // 3. Update donor profile
  db.prepare(`
    UPDATE donors
    SET screening_status = ?,
        screening_valid_until = ?,
        next_eligible_date = COALESCE(?, next_eligible_date)
    WHERE id = ?
  `).run(status, validUntil, nextEligibleDate || null, donorId);

  // 4. Send notification to donor
  let notifMsg = '';
  if (status === 'APPROVED') {
    notifMsg = 'Congratulations! Your medical screening has been APPROVED by the blood bank. You are now part of the verified active donor network.';
  } else if (status === 'TEMPORARILY DEFERRED') {
    notifMsg = `Your donation is temporarily deferred for clinical safety. Reason: ${deferralReason || staffNotes}. Next eligible review: ${nextEligibleDate || 'As advised'}.`;
  } else {
    notifMsg = 'Your screening assessment has been completed. Currently you are marked as not approved for blood donation based on clinical criteria.';
  }

  db.prepare(`
    INSERT INTO notifications (donor_id, title, message, type)
    VALUES (?, 'Screening Outcome Update', ?, 'SCREENING_UPDATE')
  `).run(donorId, notifMsg);

  const updatedDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donorId);

  res.json({
    success: true,
    donor: updatedDonor,
    message: `Donor screening marked as ${status}. Records synchronized.`
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
 */
router.post('/excel/preview', upload.single('file'), (req, res) => {
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
 */
router.post('/excel/confirm-import', (req, res) => {
  const { validRows, hospitalId } = req.body;
  if (!validRows || !Array.isArray(validRows) || validRows.length === 0) {
    return res.status(400).json({ error: 'No valid rows provided for import.' });
  }

  const result = commitImportedDonors(validRows, hospitalId || 1);
  res.json({
    success: true,
    message: `Successfully imported ${result.insertedCount} donor records with status PENDING VERIFICATION.`,
    insertedCount: result.insertedCount
  });
});

/**
 * Generate error report file for invalid rows
 */
router.post('/excel/error-report', (req, res) => {
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
