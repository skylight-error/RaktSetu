const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const {
  recordAvailabilityResponse,
  triggerWeeklyReminders,
  getISOWeekString
} = require('../services/notificationService');

/**
 * Get donor profile and full dashboard information
 */
router.get('/:id', (req, res) => {
  const donorId = Number(req.params.id);
  const donor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donorId);
  if (!donor) {
    return res.status(404).json({ error: 'Donor profile not found' });
  }

  // Hide internal location lat/lng for clean donor view
  const appointments = db.prepare(`
    SELECT a.*, h.name as hospital_name, h.phone as hospital_phone, h.address as hospital_address
    FROM appointments a
    JOIN hospitals h ON a.hospital_id = h.id
    WHERE a.donor_id = ?
    ORDER BY a.appointment_date DESC
  `).all(donorId);

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE donor_id = ?
    ORDER BY created_at DESC
  `).all(donorId);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM notifications
    WHERE donor_id = ? AND is_read = 0
  `).get(donorId).count;

  const currentWeek = getISOWeekString();

  res.json({
    donor,
    currentWeek,
    appointments,
    notifications,
    unreadCount
  });
});

/**
 * Update Weekly Availability (Workflow DEMO 4)
 */
router.post('/:id/availability', (req, res) => {
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
router.post('/:id/notifications/:notifId/read', (req, res) => {
  const donorId = Number(req.params.id);
  const notifId = Number(req.params.notifId);

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND donor_id = ?').run(notifId, donorId);
  res.json({ success: true });
});

/**
 * Manual trigger for testing/demoing weekly push notification reminder
 */
router.post('/test/trigger-weekly-reminders', (req, res) => {
  const result = triggerWeeklyReminders();
  res.json(result);
});

module.exports = router;
