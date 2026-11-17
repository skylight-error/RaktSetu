const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { generateActivationOtp } = require('../utils/crypto');

/**
 * List all hospital applications for administrative review (Requirement 3)
 */
router.get('/hospital-applications', requireAdmin, (req, res) => {
  const { status, query } = req.query;

  let sql = `
    SELECT h.id, h.name, h.email, h.phone, h.address, h.city, h.pincode,
           h.application_id, h.registration_status, h.account_status,
           h.reviewed_by_admin_id, h.reviewed_at, h.rejection_reason,
           h.activation_otp, h.created_at,
           a.full_name as reviewed_by_admin_name
    FROM hospitals h
    LEFT JOIN administrators a ON h.reviewed_by_admin_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'ALL') {
    sql += ' AND h.registration_status = ?';
    params.push(status);
  }

  if (query) {
    sql += ' AND (h.name LIKE ? OR h.email LIKE ? OR h.application_id LIKE ? OR h.city LIKE ?)';
    params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
  }

  sql += ' ORDER BY h.id DESC';

  const applications = db.prepare(sql).all(...params);

  res.json({
    totalCount: applications.length,
    applications
  });
});

/**
 * Approve Hospital Application (Requirement 3 & 4)
 * Only authorised RaktSetu administrator can approve hospital applications.
 */
router.post('/hospital-applications/:id/approve', requireAdmin, (req, res) => {
  const hospitalId = Number(req.params.id);
  const { notes } = req.body;

  const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospitalId);
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital application not found.' });
  }

  if (hospital.registration_status === 'APPROVED') {
    return res.status(400).json({ error: 'This hospital application has already been approved.' });
  }

  const otp = hospital.activation_otp || generateActivationOtp();

  db.prepare(`
    UPDATE hospitals
    SET registration_status = 'APPROVED',
        reviewed_by_admin_id = ?,
        reviewed_at = datetime('now'),
        rejection_reason = NULL,
        activation_otp = ?,
        activation_otp_expires_at = datetime('now', '+7 days')
    WHERE id = ?
  `).run(req.admin.id, otp, hospitalId);

  res.json({
    success: true,
    message: `Hospital "${hospital.name}" (${hospital.application_id || '#' + hospital.id}) has been APPROVED by Administrator ${req.admin.fullName}. The hospital facility is now eligible for first-time account activation.`,
    demoActivationOtp: otp
  });
});

/**
 * Reject Hospital Application (Requirement 3)
 * Requires specific administrative rejection reason.
 */
router.post('/hospital-applications/:id/reject', requireAdmin, (req, res) => {
  const hospitalId = Number(req.params.id);
  const { rejectionReason } = req.body;

  if (!rejectionReason || !rejectionReason.trim()) {
    return res.status(400).json({ error: 'A specific administrative reason for rejection is required.' });
  }

  const hospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(hospitalId);
  if (!hospital) {
    return res.status(404).json({ error: 'Hospital application not found.' });
  }

  db.prepare(`
    UPDATE hospitals
    SET registration_status = 'REJECTED',
        account_status = 'DISABLED',
        reviewed_by_admin_id = ?,
        reviewed_at = datetime('now'),
        rejection_reason = ?,
        activation_otp = NULL
    WHERE id = ?
  `).run(req.admin.id, rejectionReason.trim(), hospitalId);

  res.json({
    success: true,
    message: `Hospital "${hospital.name}" (${hospital.application_id || '#' + hospital.id}) marked as REJECTED. Decision timestamp and reason recorded.`
  });
});

module.exports = router;
