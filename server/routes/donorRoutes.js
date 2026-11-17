const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const {
  recordAvailabilityResponse,
  triggerWeeklyReminders,
  getISOWeekString
} = require('../services/notificationService');
const { requireDonor } = require('../middleware/auth');

/**
 * Get donor profile and full dashboard information (Requirement 8, 10, 11)
 * Protected: Only authenticated donor can access their own record.
 */
router.get('/:id', requireDonor, (req, res) => {
  const donorId = Number(req.params.id);
  const donor = db.prepare(`
    SELECT d.*, a.application_id as app_code, a.status as app_status,
           da.account_status as acc_status, da.activated_at as acc_activated_at
    FROM donors d
    LEFT JOIN donor_applications a ON d.application_id = a.id
    LEFT JOIN donor_accounts da ON d.id = da.donor_id
    WHERE d.id = ?
  `).get(donorId);

  if (!donor) {
    return res.status(404).json({ error: 'Donor profile not found' });
  }

  const appointments = db.prepare(`
    SELECT a.*, h.name as hospital_name, h.phone as hospital_phone, h.address as hospital_address
    FROM appointments a
    JOIN hospitals h ON a.hospital_id = h.id
    WHERE a.donor_id = ?
    ORDER BY a.appointment_date DESC
  `).all(donorId);

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE donor_id = ? OR (application_id = ? AND application_id IS NOT NULL)
    ORDER BY created_at DESC
  `).all(donorId, donor.application_id || 0);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE (donor_id = ? OR application_id = ?) AND is_read = 0
  `).get(donorId, donor.application_id || 0).count;

  const currentWeek = getISOWeekString();

  res.json({
    donor: {
      ...donor,
      registrationStatus: donor.registration_status || donor.app_status || 'APPROVED',
      accountStatus: donor.account_status || donor.acc_status || 'ACTIVE',
      medicalScreeningStatus: donor.medical_screening_status || donor.screening_status || 'PENDING_SCREENING'
    },
    currentWeek,
    appointments,
    notifications,
    unreadCount
  });
});

/**
 * Update Weekly Availability (Workflow DEMO 4 & Requirement 11)
 * Protected: Donors can only update their own weekly availability.
 */
router.post('/:id/availability', requireDonor, (req, res) => {
  const donorId = Number(req.params.id);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Availability status is required (AVAILABLE, MAYBE, or UNAVAILABLE)' });
  }

  try {
    const result = recordAvailabilityResponse(donorId, status);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Mark notification as read
 */
router.post('/:id/notifications/:notifId/read', requireDonor, (req, res) => {
  const donorId = Number(req.params.id);
  const notifId = Number(req.params.notifId);

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND (donor_id = ? OR application_id IN (SELECT application_id FROM donors WHERE id = ?))').run(notifId, donorId, donorId);
  res.json({ success: true });
});

/**
 * Update permitted profile fields (Requirement 11)
 * Donors cannot change registration approval or medical screening status themselves!
 */
router.patch('/:id/profile', requireDonor, (req, res) => {
  const donorId = Number(req.params.id);
  const { address, city, pincode, email } = req.body;

  db.prepare(`
    UPDATE donors
    SET address = COALESCE(?, address),
        city = COALESCE(?, city),
        pincode = COALESCE(?, pincode),
        email = COALESCE(?, email)
    WHERE id = ?
  `).run(address || null, city || null, pincode || null, email || null, donorId);

  const updated = db.prepare('SELECT * FROM donors WHERE id = ?').get(donorId);
  res.json({ success: true, donor: updated });
});

/**
 * Trigger weekly reminder simulation
 */
router.post('/test/trigger-weekly-reminders', (req, res) => {
  const result = triggerWeeklyReminders();
  res.json(result);
});

module.exports = router;
