const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { requireHospital } = require('../middleware/auth');

const COMPONENT_SHELF_LIFE_DAYS = {
  'Platelets': 5,
  'Whole Blood': 35,
  'Packed Red Blood Cells (PRBC)': 42,
  'Plasma': 365
};

/**
 * Get inventory items for hospital with computed expiry status
 * Protected: requires authenticated hospital
 */
router.get('/:hospitalId', requireHospital, (req, res) => {
  const hospitalId = req.hospital.id;
  const { bloodGroup, component, status } = req.query;

  let sql = 'SELECT * FROM inventory WHERE hospital_id = ?';
  const params = [hospitalId];

  if (bloodGroup && bloodGroup !== 'ALL') {
    sql += ' AND blood_group = ?';
    params.push(bloodGroup);
  }

  if (component && component !== 'ALL') {
    sql += ' AND component = ?';
    params.push(component);
  }

  sql += ' ORDER BY expiry_date ASC';

  const rawItems = db.prepare(sql).all(...params);
  const today = new Date();

  // Evaluate dynamic status based on expiry
  const items = rawItems.map(item => {
    const expDate = new Date(item.expiry_date);
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));

    let computedStatus = item.status;
    if (diffDays < 0) {
      computedStatus = 'EXPIRED';
    } else if (diffDays <= 3 && computedStatus !== 'EXPIRED') {
      computedStatus = 'NEAR_EXPIRY';
    } else if (computedStatus !== 'ISSUED') {
      computedStatus = 'USABLE';
    }

    return {
      ...item,
      computedStatus,
      daysUntilExpiry: diffDays,
      shelfLifeDays: COMPONENT_SHELF_LIFE_DAYS[item.component] || 35
    };
  });

  // Filter by computed status if requested
  const filtered = status && status !== 'ALL'
    ? items.filter(i => i.computedStatus === status)
    : items;

  // Aggregate stats
  const totalUsable = items.filter(i => i.computedStatus === 'USABLE').reduce((a, b) => a + b.quantity_units, 0);
  const totalNearExpiry = items.filter(i => i.computedStatus === 'NEAR_EXPIRY').reduce((a, b) => a + b.quantity_units, 0);
  const totalExpired = items.filter(i => i.computedStatus === 'EXPIRED').reduce((a, b) => a + b.quantity_units, 0);

  res.json({
    hospitalId,
    totalUsable,
    totalNearExpiry,
    totalExpired,
    items: filtered
  });
});

/**
 * Add stock to inventory (Workflow 9 & DEMO 7)
 */
router.post('/add', requireHospital, (req, res) => {
  const targetHospitalId = Number(req.body.hospitalId) || req.hospital.id;
  if (targetHospitalId !== req.hospital.id) {
    return res.status(403).json({ error: "Forbidden: You cannot add inventory to another hospital's stock." });
  }
  const hospitalId = req.hospital.id;
  const { bloodGroup, component, quantityUnits, collectionDate, storageLocation } = req.body;

  if (!bloodGroup || !component || !quantityUnits) {
    return res.status(400).json({ error: 'Blood group, component, and quantity are required.' });
  }

  const colDate = collectionDate ? new Date(collectionDate) : new Date();
  const shelfLife = COMPONENT_SHELF_LIFE_DAYS[component] || 35;
  const expDate = new Date(colDate);
  expDate.setDate(colDate.getDate() + shelfLife);

  const colDateStr = colDate.toISOString().split('T')[0];
  const expDateStr = expDate.toISOString().split('T')[0];
  const unitCode = `${component.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  try {
    const insert = db.prepare(`
      INSERT INTO inventory (hospital_id, blood_group, component, unit_code, quantity_units, collection_date, expiry_date, storage_location, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USABLE')
    `);

    const result = insert.run(
      hospitalId,
      bloodGroup,
      component,
      unitCode,
      Number(quantityUnits),
      colDateStr,
      expDateStr,
      storageLocation || 'Central Refrigerator Compartment'
    );

    // Record transaction
    db.prepare(`
      INSERT INTO inventory_transactions (hospital_id, inventory_id, blood_group, component, transaction_type, quantity, reason)
      VALUES (?, ?, ?, ?, 'ADD', ?, 'New donation intake processed')
    `).run(hospitalId, result.lastInsertRowid, bloodGroup, component, Number(quantityUnits));

    res.json({
      success: true,
      message: `Added ${quantityUnits} unit(s) of ${bloodGroup} ${component} to inventory. Expiry: ${expDateStr} (${shelfLife} days shelf life).`
    });
  } catch (err) {
    res.status(400).json({ error: 'Failed to add inventory: ' + err.message });
  }
});

/**
 * Issue blood units from stock (Workflow DEMO 7)
 */
router.post('/issue', requireHospital, (req, res) => {
  const { inventoryId, quantity, reason } = req.body;

  if (!inventoryId || !quantity) {
    return res.status(400).json({ error: 'Inventory ID and quantity are required.' });
  }

  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(inventoryId);
  if (!item) {
    return res.status(404).json({ error: 'Inventory item not found.' });
  }

  if (item.hospital_id !== req.hospital.id) {
    return res.status(403).json({ error: 'Forbidden: You cannot issue blood units belonging to another hospital facility.' });
  }

  if (item.status === 'EXPIRED') {
    return res.status(400).json({ error: 'Cannot issue expired blood units!' });
  }

  const issueQty = Number(quantity);
  if (issueQty > item.quantity_units) {
    return res.status(400).json({ error: `Requested ${issueQty} units but only ${item.quantity_units} available in this batch.` });
  }

  const remaining = item.quantity_units - issueQty;
  if (remaining === 0) {
    db.prepare("UPDATE inventory SET quantity_units = 0, status = 'ISSUED' WHERE id = ?").run(inventoryId);
  } else {
    db.prepare('UPDATE inventory SET quantity_units = ? WHERE id = ?').run(remaining, inventoryId);
  }

  // Record transaction
  db.prepare(`
    INSERT INTO inventory_transactions (hospital_id, inventory_id, blood_group, component, transaction_type, quantity, reason)
    VALUES (?, ?, ?, ?, 'ISSUE', ?, ?)
  `).run(item.hospital_id, inventoryId, item.blood_group, item.component, issueQty, reason || 'Transfusion issue for patient');

  res.json({
    success: true,
    message: `Issued ${issueQty} unit(s) of ${item.blood_group} ${item.component}. Remaining in batch: ${remaining}.`
  });
});

/**
 * Get inventory transaction history
 */
router.get('/:hospitalId/transactions', requireHospital, (req, res) => {
  const hospitalId = req.hospital.id;
  const transactions = db.prepare(`
    SELECT * FROM inventory_transactions
    WHERE hospital_id = ?
    ORDER BY timestamp DESC
    LIMIT 20
  `).all(hospitalId);

  res.json({ transactions });
});

module.exports = router;
