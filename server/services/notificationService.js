const { db } = require('../db/database');

function getISOWeekString(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `Week ${weekNo} - ${d.getUTCFullYear()}`;
}

/**
 * Trigger weekly reminder blast across all registered donors
 */
function triggerWeeklyReminders() {
  const currentWeek = getISOWeekString();
  const donors = db.prepare('SELECT id, full_name FROM donors WHERE consent_contact = 1').all();

  const insertNotif = db.prepare(`
    INSERT INTO notifications (donor_id, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, 'WEEKLY_REMINDER', 0, datetime('now'))
  `);

  let count = 0;
  for (const donor of donors) {
    insertNotif.run(
      donor.id,
      'A little check-in! ❤️',
      'Will you be available to help save a life next week? Tap to update your availability. 🩸'
    );
    count++;
  }

  return {
    success: true,
    week: currentWeek,
    remindersSent: count,
    message: `Weekly check-in reminder dispatched to ${count} registered donors.`
  };
}

/**
 * Record a donor's weekly availability response
 */
function recordAvailabilityResponse(donorId, status) {
  const validStatuses = ['AVAILABLE', 'MAYBE', 'UNAVAILABLE'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid availability status. Must be AVAILABLE, MAYBE, or UNAVAILABLE.');
  }

  const currentWeek = getISOWeekString();

  // 1. Update donor record
  db.prepare(`
    UPDATE donors
    SET weekly_availability = ?,
        weekly_availability_updated_at = datetime('now')
    WHERE id = ?
  `).run(status, donorId);

  // 2. Insert into response history
  db.prepare(`
    INSERT INTO availability_responses (donor_id, week_number, status, response_timestamp)
    VALUES (?, ?, ?, datetime('now'))
  `).run(donorId, currentWeek, status);

  // 3. Mark the weekly reminder notification as read
  db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE donor_id = ? AND type = 'WEEKLY_REMINDER'
  `).run(donorId);

  const updatedDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donorId);

  return {
    success: true,
    week: currentWeek,
    updatedAvailability: status,
    donor: updatedDonor
  };
}

module.exports = {
  triggerWeeklyReminders,
  recordAvailabilityResponse,
  getISOWeekString
};
