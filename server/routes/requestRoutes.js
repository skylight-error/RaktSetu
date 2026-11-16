const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { matchDonorsForRequest } = require('../ai/donorMatching');

/**
 * List all blood requests for hospital
 */
router.get('/hospital/:hospitalId', (req, res) => {
  const hospitalId = Number(req.params.hospitalId) || 1;
  const requests = db.prepare(`
    SELECT r.*, h.name as hospital_name
    FROM blood_requests r
    JOIN hospitals h ON r.hospital_id = h.id
    WHERE r.hospital_id = ?
    ORDER BY r.created_at DESC
  `).all(hospitalId);

  res.json({ requests });
});

/**
 * Create new blood request (Workflow DEMO 6 Step 1)
 */
router.post('/create', (req, res) => {
  const { hospitalId, bloodGroup, component, quantityNeeded, urgency, requiredBy, notes } = req.body;

  if (!hospitalId || !bloodGroup || !component || !quantityNeeded) {
    return res.status(400).json({ error: 'Hospital, blood group, component, and quantity are required.' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO blood_requests (hospital_id, blood_group, component, quantity_needed, urgency, required_by, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'NEW', ?)
    `);

    const result = insert.run(
      hospitalId,
      bloodGroup,
      component,
      Number(quantityNeeded),
      urgency || 'ROUTINE',
      requiredBy || 'As soon as possible',
      notes || ''
    );

    const newRequest = db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      success: true,
      request: newRequest,
      message: 'Urgent blood request created. Initiating smart donor matching.'
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to create blood request: ' + err.message });
  }
});

/**
 * Run AI Smart Donor Matching for a blood request (Workflow 11 & DEMO 6)
 */
router.get('/:requestId/match', (req, res) => {
  const requestId = Number(req.params.requestId);
  const radiusKm = Number(req.query.radiusKm) || 25;

  const request = db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(requestId);
  if (!request) {
    return res.status(404).json({ error: 'Blood request not found.' });
  }

  // Update status to MATCHING IN PROGRESS if still NEW
  if (request.status === 'NEW') {
    db.prepare("UPDATE blood_requests SET status = 'MATCHING IN PROGRESS' WHERE id = ?").run(requestId);
  }

  try {
    const matchResults = matchDonorsForRequest({
      hospitalId: request.hospital_id,
      bloodGroup: request.blood_group,
      component: request.component,
      radiusKm,
      urgency: request.urgency
    });

    res.json({
      success: true,
      request,
      matchResults
    });
  } catch (err) {
    res.status(400).json({ error: 'Matching failed: ' + err.message });
  }
});

/**
 * Simulate contacting a prioritized donor (Workflow DEMO 6 Step 6)
 */
router.post('/:requestId/contact-donor', (req, res) => {
  const requestId = Number(req.params.requestId);
  const { donorId, hospitalId, contactMethod, notes } = req.body;

  if (!donorId || !hospitalId) {
    return res.status(400).json({ error: 'Donor ID and Hospital ID are required.' });
  }

  const donor = db.prepare('SELECT * FROM donors WHERE id = ?').get(donorId);
  const request = db.prepare('SELECT * FROM blood_requests WHERE id = ?').get(requestId);
  if (!donor || !request) {
    return res.status(404).json({ error: 'Donor or Blood Request not found.' });
  }

  // 1. Record contact action in SQLite
  db.prepare(`
    INSERT INTO donor_contact_records (request_id, donor_id, hospital_id, contacted_at, contact_method, response_status, notes)
    VALUES (?, ?, ?, datetime('now'), ?, 'CONTACTED', ?)
  `).run(
    requestId,
    donorId,
    hospitalId,
    contactMethod || 'IN_APP_SIMULATION',
    notes || `Direct urgent outreach: ${request.blood_group} ${request.component}`
  );

  // 2. Update request status to DONORS CONTACTED
  db.prepare("UPDATE blood_requests SET status = 'DONORS CONTACTED' WHERE id = ?").run(requestId);

  // 3. Send urgent mobilisation notification to donor
  db.prepare(`
    INSERT INTO notifications (donor_id, title, message, type)
    VALUES (?, 'Urgent Blood Requirement Alert 🚨', ?, 'URGENT_MOBILISATION')
  `).run(
    donorId,
    `URGENT: A hospital near you has an urgent clinical requirement for ${request.blood_group} ${request.component}. Please check your donor portal or contact the blood bank.`
  );

  res.json({
    success: true,
    message: `Contact initiated with ${donor.full_name} (${donor.mobile}). Request updated to DONORS CONTACTED.`
  });
});

/**
 * Update request status (e.g. FULFILLED, CANCELLED)
 */
router.patch('/:requestId/status', (req, res) => {
  const requestId = Number(req.params.requestId);
  const { status } = req.body;

  const validStatuses = ['NEW', 'MATCHING IN PROGRESS', 'DONORS CONTACTED', 'RESPONSE RECEIVED', 'FULFILLED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  db.prepare('UPDATE blood_requests SET status = ? WHERE id = ?').run(status, requestId);
  res.json({ success: true, status });
});

module.exports = router;
