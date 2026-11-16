const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

/**
 * Hospital Login
 */
router.post('/hospital/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const hospital = db.prepare('SELECT * FROM hospitals WHERE email = ?').get(email);
  if (!hospital) {
    return res.status(401).json({ error: 'Hospital account not found with this email' });
  }

  // Demo prototype password check
  if (password && hospital.password_hash !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({
    success: true,
    userType: 'HOSPITAL',
    hospital: {
      id: hospital.id,
      name: hospital.name,
      email: hospital.email,
      phone: hospital.phone,
      address: hospital.address,
      city: hospital.city,
      pincode: hospital.pincode,
      latitude: hospital.latitude,
      longitude: hospital.longitude
    }
  });
});

/**
 * Hospital Registration (Demo)
 */
router.post('/hospital/register', (req, res) => {
  const { name, email, phone, address, city, pincode, password } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email and phone are required' });
  }

  try {
    const insert = db.prepare(`
      INSERT INTO hospitals (name, email, phone, address, city, pincode, latitude, longitude, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, 19.0760, 72.8777, ?)
    `);
    const result = insert.run(name, email, phone, address || 'Mumbai', city || 'Mumbai', pincode || '400001', password || 'demo123');
    
    const newHospital = db.prepare('SELECT * FROM hospitals WHERE id = ?').get(result.lastInsertRowid);
    res.json({
      success: true,
      hospital: newHospital,
      message: 'Demo hospital registered successfully.'
    });
  } catch (err) {
    res.status(400).json({ error: 'Hospital registration failed: ' + err.message });
  }
});

/**
 * Donor Login
 */
router.post('/donor/login', (req, res) => {
  const { mobile, email } = req.body;
  if (!mobile && !email) {
    return res.status(400).json({ error: 'Mobile or Email is required for donor login' });
  }

  let donor;
  if (mobile) {
    const clean = mobile.replace(/\D/g, '');
    donor = db.prepare(`
      SELECT * FROM donors WHERE replace(replace(replace(mobile, ' ', ''), '+', ''), '-', '') LIKE ?
    `).get(`%${clean}%`);
  } else {
    donor = db.prepare('SELECT * FROM donors WHERE email = ?').get(email);
  }

  if (!donor) {
    return res.status(404).json({ error: 'Donor profile not found. Please register as a new donor.' });
  }

  res.json({
    success: true,
    userType: 'DONOR',
    donor
  });
});

/**
 * Donor Self-Registration (Workflow DEMO 1)
 */
router.post('/donor/register', (req, res) => {
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

  if (!fullName || !dob || !mobile || !bloodGroup || !pincode) {
    return res.status(400).json({ error: 'Full name, DOB, mobile, blood group, and PIN code are required.' });
  }

  // Calculate age from DOB
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

  // Fictional coordinate jitter around Mumbai for matching demo
  const lat = 19.0500 + (Math.random() - 0.5) * 0.15;
  const lng = 72.8500 + (Math.random() - 0.5) * 0.12;

  try {
    const insert = db.prepare(`
      INSERT INTO donors (
        full_name, dob, age, gender, mobile, email, blood_group, address, city, pincode,
        preferred_hospital_id, screening_status, weekly_availability, latitude, longitude,
        consent_contact, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING SCREENING', 'UNCONFIRMED', ?, ?, ?, 'SELF_REGISTERED')
    `);

    const result = insert.run(
      fullName,
      dob,
      age,
      gender || 'Unspecified',
      mobile,
      email || null,
      bloodGroup,
      address || 'Mumbai',
      city || 'Mumbai',
      pincode,
      preferredHospitalId || 1,
      lat,
      lng,
      consentContact ? 1 : 0
    );

    const newDonor = db.prepare('SELECT * FROM donors WHERE id = ?').get(result.lastInsertRowid);

    // Create a welcome notification
    db.prepare(`
      INSERT INTO notifications (donor_id, title, message, type)
      VALUES (?, 'Registration Received', 'Your donor profile is registered. Status: PENDING SCREENING. The blood bank will contact you to schedule an initial health checkup.', 'SCREENING_UPDATE')
    `).run(newDonor.id);

    res.json({
      success: true,
      donor: newDonor,
      message: 'Thank you for your willingness to help save lives! Your profile has been created with status PENDING SCREENING.'
    });
  } catch (err) {
    res.status(400).json({ error: 'Registration failed: ' + err.message });
  }
});

/**
 * List demo accounts for quick switcher UI
 */
router.get('/demo-accounts', (req, res) => {
  const hospitals = db.prepare('SELECT id, name, email, city FROM hospitals').all();
  const donors = db.prepare(`
    SELECT id, full_name, blood_group, screening_status, weekly_availability, mobile, email
    FROM donors
    ORDER BY id ASC
    LIMIT 6
  `).all();

  res.json({
    hospitals,
    donors
  });
});

module.exports = router;
