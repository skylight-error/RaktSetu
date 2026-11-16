const { db, initSchema } = require('./database');

function seedDatabase() {
  initSchema();

  // Check if already seeded
  const hospitalCount = db.prepare('SELECT COUNT(*) as count FROM hospitals').get().count;
  if (hospitalCount > 0) {
    console.log('Database already initialized with seed data.');
    return;
  }

  console.log('Seeding RaktSetu database with realistic demonstration data...');

  // 1. Seed Hospitals
  const insertHospital = db.prepare(`
    INSERT INTO hospitals (id, name, email, phone, address, city, pincode, latitude, longitude, password_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertHospital.run(
    1,
    'Metro General Hospital & Trauma Centre',
    'metro.bloodbank@raktsetu.org',
    '+91 98201 11223',
    'Sector 14, Dr. Ambedkar Road, Parel',
    'Mumbai',
    '400012',
    18.9986,
    72.8385,
    'hospital123'
  );

  insertHospital.run(
    2,
    'City Life Charitable Blood Bank & Research Institute',
    'citylife.bank@raktsetu.org',
    '+91 98202 33445',
    'Plot 42, S.V. Road, Near Station, Andheri West',
    'Mumbai',
    '400058',
    19.1197,
    72.8468,
    'hospital123'
  );

  // 2. Seed Donors (26 realistic donors with diverse blood groups, screening, locations)
  const donors = [
    {
      name: 'Rahul Sharma', dob: '1996-04-12', age: 30, gender: 'Male', mobile: '+91 98765 43210',
      email: 'rahul.sharma@example.com', blood_group: 'O+', address: 'Flat 402, Sunshine Heights, Dadar',
      city: 'Mumbai', pincode: '400014', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-04-15', last_donation_date: '2026-06-10', next_eligible_date: '2026-09-10',
      weekly_availability: 'AVAILABLE', lat: 19.0178, lng: 72.8478
    },
    {
      name: 'Priya Patel', dob: '1999-08-23', age: 27, gender: 'Female', mobile: '+91 98765 43211',
      email: 'priya.patel@example.com', blood_group: 'O-', address: 'B-12, Green Park Society, Wadala',
      city: 'Mumbai', pincode: '400031', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-03-20', last_donation_date: '2026-07-02', next_eligible_date: '2026-10-02',
      weekly_availability: 'AVAILABLE', lat: 19.0195, lng: 72.8580
    },
    {
      name: 'Amitabh Verma', dob: '1992-11-05', age: 34, gender: 'Male', mobile: '+91 98765 43212',
      email: 'amitabh.v@example.com', blood_group: 'A+', address: 'A/304, Shanti Nagar, Worli',
      city: 'Mumbai', pincode: '400018', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-02-10', last_donation_date: '2026-05-18', next_eligible_date: '2026-08-18',
      weekly_availability: 'MAYBE', lat: 19.0110, lng: 72.8180
    },
    {
      name: 'Sneha Deshmukh', dob: '2001-02-14', age: 25, gender: 'Female', mobile: '+91 98765 43213',
      email: 'sneha.d@example.com', blood_group: 'B+', address: 'Building 7, Tata Mills Compound, Parel',
      city: 'Mumbai', pincode: '400012', preferred_hospital_id: 1, screening_status: 'PENDING SCREENING',
      screening_valid_until: null, last_donation_date: null, next_eligible_date: null,
      weekly_availability: 'UNCONFIRMED', lat: 18.9950, lng: 72.8390
    },
    {
      name: 'Rohan Kulkarni', dob: '1997-09-30', age: 29, gender: 'Male', mobile: '+91 98765 43214',
      email: 'rohan.k@example.com', blood_group: 'AB+', address: '14, Silver Oak Apts, Byculla',
      city: 'Mumbai', pincode: '400027', preferred_hospital_id: 1, screening_status: 'APPOINTMENT SCHEDULED',
      screening_valid_until: null, last_donation_date: '2026-02-12', next_eligible_date: '2026-05-12',
      weekly_availability: 'AVAILABLE', lat: 18.9780, lng: 72.8330
    },
    {
      name: 'Dr. Ananya Sen', dob: '1988-06-19', age: 38, gender: 'Female', mobile: '+91 98765 43215',
      email: 'ananya.sen@example.com', blood_group: 'A-', address: 'Row House 4, Hindu Colony, Dadar East',
      city: 'Mumbai', pincode: '400014', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-05-01', last_donation_date: '2026-04-10', next_eligible_date: '2026-07-10',
      weekly_availability: 'AVAILABLE', lat: 19.0185, lng: 72.8465
    },
    {
      name: 'Vikram Singh', dob: '1994-01-28', age: 32, gender: 'Male', mobile: '+91 98765 43216',
      email: 'vikram.singh@example.com', blood_group: 'B-', address: 'Flat 101, Sea View Residency, Prabhadevi',
      city: 'Mumbai', pincode: '400025', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-01-18', last_donation_date: '2026-06-25', next_eligible_date: '2026-09-25',
      weekly_availability: 'MAYBE', lat: 19.0140, lng: 72.8250
    },
    {
      name: 'Kavita Nair', dob: '1995-12-03', age: 31, gender: 'Female', mobile: '+91 98765 43217',
      email: 'kavita.nair@example.com', blood_group: 'AB-', address: '402, Lotus Residency, Mahim West',
      city: 'Mumbai', pincode: '400016', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-06-12', last_donation_date: '2026-05-01', next_eligible_date: '2026-08-01',
      weekly_availability: 'AVAILABLE', lat: 19.0380, lng: 72.8400
    },
    {
      name: 'Mohammed Arshad', dob: '1993-03-15', age: 33, gender: 'Male', mobile: '+91 98765 43218',
      email: 'm.arshad@example.com', blood_group: 'O+', address: 'G/12, Noor Manzil, Nagpada',
      city: 'Mumbai', pincode: '400008', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-03-10', last_donation_date: '2026-03-15', next_eligible_date: '2026-06-15',
      weekly_availability: 'AVAILABLE', lat: 18.9660, lng: 72.8280
    },
    {
      name: 'Deepak Joshi', dob: '1998-07-22', age: 28, gender: 'Male', mobile: '+91 98765 43219',
      email: 'deepak.j@example.com', blood_group: 'O+', address: 'Room 15, Chawl 4, Lalbaug',
      city: 'Mumbai', pincode: '400012', preferred_hospital_id: 1, screening_status: 'TEMPORARILY DEFERRED',
      screening_valid_until: null, last_donation_date: '2026-01-20', next_eligible_date: '2026-12-01',
      weekly_availability: 'UNAVAILABLE', lat: 18.9910, lng: 72.8360
    },
    {
      name: 'Tanvi Shinde', dob: '2000-10-18', age: 26, gender: 'Female', mobile: '+91 98765 43220',
      email: 'tanvi.shinde@example.com', blood_group: 'B+', address: '204, Omkar Tower, Sewri',
      city: 'Mumbai', pincode: '400015', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-05-20', last_donation_date: '2026-06-05', next_eligible_date: '2026-09-05',
      weekly_availability: 'AVAILABLE', lat: 19.0020, lng: 72.8550
    },
    {
      name: 'Suresh Menon', dob: '1987-05-11', age: 39, gender: 'Male', mobile: '+91 98765 43221',
      email: 'suresh.menon@example.com', blood_group: 'A+', address: 'A-5, Sagar Sadan, Matunga East',
      city: 'Mumbai', pincode: '400019', preferred_hospital_id: 1, screening_status: 'PENDING SCREENING',
      screening_valid_until: null, last_donation_date: null, next_eligible_date: null,
      weekly_availability: 'UNCONFIRMED', lat: 19.0270, lng: 72.8550
    },
    {
      name: 'Manish Agarwal', dob: '1991-09-08', age: 35, gender: 'Male', mobile: '+91 98765 43222',
      email: 'manish.a@example.com', blood_group: 'O-', address: 'Flat 701, Raheja Heights, Lower Parel',
      city: 'Mumbai', pincode: '400013', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-04-01', last_donation_date: '2026-07-15', next_eligible_date: '2026-10-15',
      weekly_availability: 'AVAILABLE', lat: 18.9950, lng: 72.8290
    },
    {
      name: 'Pooja Hegde', dob: '1997-04-05', age: 29, gender: 'Female', mobile: '+91 98765 43223',
      email: 'pooja.h@example.com', blood_group: 'O+', address: '7B, Crystal Tower, Andheri East',
      city: 'Mumbai', pincode: '400069', preferred_hospital_id: 2, screening_status: 'APPROVED',
      screening_valid_until: '2027-03-15', last_donation_date: '2026-06-18', next_eligible_date: '2026-09-18',
      weekly_availability: 'AVAILABLE', lat: 19.1150, lng: 72.8690
    },
    {
      name: 'Karan Malhotra', dob: '1995-10-12', age: 31, gender: 'Male', mobile: '+91 98765 43224',
      email: 'karan.m@example.com', blood_group: 'B+', address: '403, Beverly Hills, Lokhandwala, Andheri W',
      city: 'Mumbai', pincode: '400053', preferred_hospital_id: 2, screening_status: 'APPROVED',
      screening_valid_until: '2027-02-28', last_donation_date: '2026-05-20', next_eligible_date: '2026-08-20',
      weekly_availability: 'AVAILABLE', lat: 19.1410, lng: 72.8250
    },
    {
      name: 'Farhan Akhtar', dob: '1990-01-15', age: 36, gender: 'Male', mobile: '+91 98765 43225',
      email: 'farhan.akhtar@example.com', blood_group: 'A+', address: 'Flat 502, Versova Bayview, Andheri W',
      city: 'Mumbai', pincode: '400061', preferred_hospital_id: 2, screening_status: 'APPROVED',
      screening_valid_until: '2027-05-10', last_donation_date: '2026-07-01', next_eligible_date: '2026-10-01',
      weekly_availability: 'MAYBE', lat: 19.1350, lng: 72.8150
    },
    {
      name: 'Ritu Rawat', dob: '1998-03-29', age: 28, gender: 'Female', mobile: '+91 98765 43226',
      email: 'ritu.rawat@example.com', blood_group: 'O-', address: '201, Green Woods, Goregaon East',
      city: 'Mumbai', pincode: '400063', preferred_hospital_id: 2, screening_status: 'APPROVED',
      screening_valid_until: '2027-03-05', last_donation_date: '2026-06-28', next_eligible_date: '2026-09-28',
      weekly_availability: 'AVAILABLE', lat: 19.1650, lng: 72.8650
    },
    {
      name: 'Nikhil Saxena', dob: '1993-12-11', age: 33, gender: 'Male', mobile: '+91 98765 43227',
      email: 'nikhil.saxena@example.com', blood_group: 'AB-', address: 'A-14, Model Town, Juhu',
      city: 'Mumbai', pincode: '400049', preferred_hospital_id: 2, screening_status: 'APPROVED',
      screening_valid_until: '2027-04-18', last_donation_date: '2026-04-15', next_eligible_date: '2026-07-15',
      weekly_availability: 'AVAILABLE', lat: 19.1020, lng: 72.8270
    },
    {
      name: 'Simran Kaur', dob: '2001-08-07', age: 25, gender: 'Female', mobile: '+91 98765 43228',
      email: 'simran.k@example.com', blood_group: 'B-', address: 'House 33, Four Bungalows, Andheri W',
      city: 'Mumbai', pincode: '400053', preferred_hospital_id: 2, screening_status: 'APPOINTMENT SCHEDULED',
      screening_valid_until: null, last_donation_date: null, next_eligible_date: null,
      weekly_availability: 'AVAILABLE', lat: 19.1280, lng: 72.8280
    },
    {
      name: 'Gaurav Dubey', dob: '1994-06-30', age: 32, gender: 'Male', mobile: '+91 98765 43229',
      email: 'gaurav.dubey@example.com', blood_group: 'O+', address: 'B-604, Royal Palms, Aarey, Goregaon',
      city: 'Mumbai', pincode: '400065', preferred_hospital_id: 2, screening_status: 'NOT APPROVED',
      screening_valid_until: null, last_donation_date: '2025-08-10', next_eligible_date: null,
      weekly_availability: 'UNAVAILABLE', lat: 19.1550, lng: 72.8850
    },
    {
      name: 'Alisha Merchant', dob: '1996-02-18', age: 30, gender: 'Female', mobile: '+91 98765 43230',
      email: 'alisha.m@example.com', blood_group: 'A-', address: '12, Bandra Sea Breeze, Carter Road',
      city: 'Mumbai', pincode: '400050', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-01-25', last_donation_date: '2026-05-12', next_eligible_date: '2026-08-12',
      weekly_availability: 'AVAILABLE', lat: 19.0650, lng: 72.8250
    },
    {
      name: 'Chetan Bhagat', dob: '1989-10-04', age: 37, gender: 'Male', mobile: '+91 98765 43231',
      email: 'chetan.b@example.com', blood_group: 'B+', address: 'C-201, Raheja Complex, Malad West',
      city: 'Mumbai', pincode: '400064', preferred_hospital_id: 2, screening_status: 'PENDING VERIFICATION',
      screening_valid_until: null, last_donation_date: '2026-03-22', next_eligible_date: '2026-06-22',
      weekly_availability: 'UNCONFIRMED', lat: 19.1850, lng: 72.8420
    },
    {
      name: 'Zoya Khan', dob: '1999-11-20', age: 27, gender: 'Female', mobile: '+91 98765 43232',
      email: 'zoya.khan@example.com', blood_group: 'O+', address: 'Flat 303, Hill View, Santacruz East',
      city: 'Mumbai', pincode: '400055', preferred_hospital_id: 2, screening_status: 'APPROVED',
      screening_valid_until: '2027-06-01', last_donation_date: '2026-07-10', next_eligible_date: '2026-10-10',
      weekly_availability: 'AVAILABLE', lat: 19.0820, lng: 72.8550
    },
    {
      name: 'Aditya Roy', dob: '1995-05-15', age: 31, gender: 'Male', mobile: '+91 98765 43233',
      email: 'aditya.roy@example.com', blood_group: 'AB+', address: 'D-12, Palm Beach, Vile Parle West',
      city: 'Mumbai', pincode: '400056', preferred_hospital_id: 2, screening_status: 'APPROVED',
      screening_valid_until: '2027-02-14', last_donation_date: '2026-04-18', next_eligible_date: '2026-07-18',
      weekly_availability: 'AVAILABLE', lat: 19.1000, lng: 72.8350
    },
    {
      name: 'Meera Iyer', dob: '1997-01-09', age: 29, gender: 'Female', mobile: '+91 98765 43234',
      email: 'meera.iyer@example.com', blood_group: 'A+', address: 'Building 14, Sion East Colony',
      city: 'Mumbai', pincode: '400022', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-03-30', last_donation_date: '2026-06-15', next_eligible_date: '2026-09-15',
      weekly_availability: 'AVAILABLE', lat: 19.0400, lng: 72.8620
    },
    {
      name: 'Rajesh Nair', dob: '1992-04-18', age: 34, gender: 'Male', mobile: '+91 98765 43235',
      email: 'rajesh.nair@example.com', blood_group: 'O-', address: 'Block 3, Navy Nagar, Colaba',
      city: 'Mumbai', pincode: '400005', preferred_hospital_id: 1, screening_status: 'APPROVED',
      screening_valid_until: '2027-04-10', last_donation_date: '2026-06-01', next_eligible_date: '2026-09-01',
      weekly_availability: 'AVAILABLE', lat: 18.9050, lng: 72.8150
    }
  ];

  const insertDonor = db.prepare(`
    INSERT INTO donors (
      full_name, dob, age, gender, mobile, email, blood_group, address, city, pincode,
      preferred_hospital_id, screening_status, screening_valid_until, last_donation_date,
      next_eligible_date, weekly_availability, weekly_availability_updated_at,
      latitude, longitude, consent_contact, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), ?, ?, 1, 'SEED_DEMO')
  `);

  donors.forEach(d => {
    insertDonor.run(
      d.name, d.dob, d.age, d.gender, d.mobile, d.email, d.blood_group, d.address, d.city, d.pincode,
      d.preferred_hospital_id, d.screening_status, d.screening_valid_until, d.last_donation_date,
      d.next_eligible_date, d.weekly_availability, d.lat, d.lng
    );
  });

  // 3. Seed Appointments for screening
  const insertAppointment = db.prepare(`
    INSERT INTO appointments (donor_id, hospital_id, appointment_date, appointment_time, status, instructions)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  // Sneha Deshmukh scheduled appointment
  insertAppointment.run(4, 1, '2026-11-20', '10:30 AM', 'SCHEDULED', 'Please carry photo ID and fast for 2 hours prior to hemoglobin test.');
  // Rohan Kulkarni
  insertAppointment.run(5, 1, '2026-11-22', '02:00 PM', 'SCHEDULED', 'Medical history questionnaire and blood pressure check.');
  // Simran Kaur
  insertAppointment.run(19, 2, '2026-11-21', '11:00 AM', 'SCHEDULED', 'Routine pre-donation donor screening appointment.');

  // 4. Seed Screening Records for approved donors
  const insertScreening = db.prepare(`
    INSERT INTO screening_records (donor_id, hospital_id, staff_name, screening_date, status, staff_notes, next_eligible_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertScreening.run(1, 1, 'Dr. Rajiv Mehta (Chief Pathologist)', '2026-04-15', 'APPROVED', 'Donor clinically fit. Hb: 14.2 g/dL, BP: 120/80 mmHg. Good vein access.', '2026-09-10');
  insertScreening.run(2, 1, 'Dr. Rajiv Mehta (Chief Pathologist)', '2026-03-20', 'APPROVED', 'Fit for whole blood / apheresis. Hb: 13.5 g/dL. No deferral factors.', '2026-10-02');
  insertScreening.run(10, 1, 'Dr. Shweta Rao (Transfusion Medicine)', '2026-06-01', 'TEMPORARILY DEFERRED', 'Recent dental extraction and antibiotic treatment. Deferred for 6 months.', '2026-12-01');
  insertScreening.run(20, 2, 'Dr. Anand Kulkarni', '2026-02-10', 'NOT APPROVED', 'Chronic severe hypertension unmanaged. Donor advised clinical treatment.', null);

  // 5. Seed Blood Inventory (Hospital 1 & Hospital 2)
  // Components: Whole Blood (35 days expiry), PRBC (42 days), Platelets (5 days), Plasma (365 days)
  const insertInventory = db.prepare(`
    INSERT INTO inventory (hospital_id, blood_group, component, unit_code, quantity_units, collection_date, expiry_date, storage_location, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const inventoryItems = [
    // Usable fresh units
    { hId: 1, bg: 'O+', comp: 'Packed Red Blood Cells (PRBC)', code: 'PRBC-2026-1042', qty: 6, col: '2026-11-05', exp: '2026-12-17', loc: 'Refrigerator B1 (Shelf 2)', status: 'USABLE' },
    { hId: 1, bg: 'O-', comp: 'Packed Red Blood Cells (PRBC)', code: 'PRBC-2026-1043', qty: 2, col: '2026-11-08', exp: '2026-12-20', loc: 'Refrigerator B1 (Shelf 1 - Emergency)', status: 'USABLE' },
    { hId: 1, bg: 'A+', comp: 'Packed Red Blood Cells (PRBC)', code: 'PRBC-2026-1044', qty: 8, col: '2026-11-02', exp: '2026-12-14', loc: 'Refrigerator B2 (Shelf 1)', status: 'USABLE' },
    { hId: 1, bg: 'B+', comp: 'Packed Red Blood Cells (PRBC)', code: 'PRBC-2026-1045', qty: 7, col: '2026-11-04', exp: '2026-12-16', loc: 'Refrigerator B2 (Shelf 3)', status: 'USABLE' },
    { hId: 1, bg: 'AB+', comp: 'Packed Red Blood Cells (PRBC)', code: 'PRBC-2026-1046', qty: 4, col: '2026-11-06', exp: '2026-12-18', loc: 'Refrigerator B3 (Shelf 1)', status: 'USABLE' },

    // Platelets (critical 5-day shelf life!)
    { hId: 1, bg: 'O+', comp: 'Platelets', code: 'PLT-2026-8801', qty: 3, col: '2026-11-14', exp: '2026-11-19', loc: 'Agitator Unit 1 (Temp 22°C)', status: 'USABLE' },
    { hId: 1, bg: 'A+', comp: 'Platelets', code: 'PLT-2026-8802', qty: 2, col: '2026-11-15', exp: '2026-11-20', loc: 'Agitator Unit 1 (Temp 22°C)', status: 'USABLE' },
    // Near-expiry Platelets!
    { hId: 1, bg: 'B+', comp: 'Platelets', code: 'PLT-2026-8799', qty: 1, col: '2026-11-12', exp: '2026-11-17', loc: 'Agitator Unit 2 (Near Expiry Rack)', status: 'NEAR_EXPIRY' },
    // Expired Platelet unit (should NOT be counted in usable inventory!)
    { hId: 1, bg: 'O-', comp: 'Platelets', code: 'PLT-2026-8790', qty: 1, col: '2026-11-10', exp: '2026-11-15', loc: 'Quarantine Box Q-1 (Disposal)', status: 'EXPIRED' },

    // Whole Blood
    { hId: 1, bg: 'O+', comp: 'Whole Blood', code: 'WB-2026-3021', qty: 5, col: '2026-10-30', exp: '2026-12-04', loc: 'Refrigerator A1 (Shelf 1)', status: 'USABLE' },
    { hId: 1, bg: 'A-', comp: 'Whole Blood', code: 'WB-2026-3022', qty: 2, col: '2026-11-01', exp: '2026-12-06', loc: 'Refrigerator A1 (Shelf 2)', status: 'USABLE' },
    { hId: 1, bg: 'B-', comp: 'Whole Blood', code: 'WB-2026-3023', qty: 1, col: '2026-10-25', exp: '2026-11-29', loc: 'Refrigerator A2 (Shelf 1)', status: 'USABLE' },
    // Near-expiry Whole Blood
    { hId: 1, bg: 'AB-', comp: 'Whole Blood', code: 'WB-2026-2990', qty: 1, col: '2026-10-14', exp: '2026-11-18', loc: 'Refrigerator A2 (Shelf 3 - Urgent Issue)', status: 'NEAR_EXPIRY' },

    // Fresh Frozen Plasma (FFP - 365 days shelf life)
    { hId: 1, bg: 'AB+', comp: 'Plasma', code: 'FFP-2026-5511', qty: 10, col: '2026-08-10', exp: '2027-08-10', loc: 'Deep Freezer F1 (-30°C)', status: 'USABLE' },
    { hId: 1, bg: 'O+', comp: 'Plasma', code: 'FFP-2026-5512', qty: 12, col: '2026-09-01', exp: '2027-09-01', loc: 'Deep Freezer F1 (-30°C)', status: 'USABLE' },
    { hId: 1, bg: 'A+', comp: 'Plasma', code: 'FFP-2026-5513', qty: 9, col: '2026-07-20', exp: '2027-07-20', loc: 'Deep Freezer F2 (-30°C)', status: 'USABLE' },

    // Hospital 2 stock
    { hId: 2, bg: 'O+', comp: 'Packed Red Blood Cells (PRBC)', code: 'CL-PRBC-041', qty: 5, col: '2026-11-04', exp: '2026-12-16', loc: 'Unit North Shelf 1', status: 'USABLE' },
    { hId: 2, bg: 'O-', comp: 'Packed Red Blood Cells (PRBC)', code: 'CL-PRBC-042', qty: 1, col: '2026-11-09', exp: '2026-12-21', loc: 'Emergency Tray 1', status: 'USABLE' },
    { hId: 2, bg: 'Platelets', comp: 'Platelets', code: 'CL-PLT-109', qty: 2, col: '2026-11-14', exp: '2026-11-19', loc: 'Room 2 Agitator', status: 'USABLE' }
  ];

  inventoryItems.forEach(item => {
    insertInventory.run(item.hId, item.bg, item.comp, item.code, item.qty, item.col, item.exp, item.loc, item.status);
  });

  // 6. Seed Urgent Blood Requests
  const insertRequest = db.prepare(`
    INSERT INTO blood_requests (id, hospital_id, blood_group, component, quantity_needed, urgency, required_by, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRequest.run(
    1,
    1,
    'O-',
    'Packed Red Blood Cells (PRBC)',
    2,
    'CRITICAL',
    '2026-11-17 14:00',
    'MATCHING IN PROGRESS',
    'Trauma patient in ICU after acute vehicle collision. Emergency transfusion required.'
  );

  insertRequest.run(
    2,
    1,
    'B+',
    'Platelets',
    3,
    'URGENT',
    '2026-11-18 10:00',
    'DONORS CONTACTED',
    'Oncology ward patient with thrombocytopenia undergoing chemotherapy.'
  );

  insertRequest.run(
    3,
    1,
    'A+',
    'Whole Blood',
    2,
    'ROUTINE',
    '2026-11-21 09:00',
    'NEW',
    'Elective orthopedic surgery scheduled for Thursday morning.'
  );

  // 7. Seed Contact record for request #2
  const insertContact = db.prepare(`
    INSERT INTO donor_contact_records (request_id, donor_id, hospital_id, contacted_at, contact_method, response_status, notes)
    VALUES (?, ?, ?, datetime('now', '-3 hours'), 'IN_APP_SIMULATION', 'CONTACTED', 'Automated urgent mobilisation alert sent to verified nearby donor.')
  `);
  insertContact.run(2, 11, 1); // Tanvi Shinde

  // 8. Seed Weekly Availability Notifications
  const insertNotification = db.prepare(`
    INSERT INTO notifications (donor_id, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-1 day'))
  `);

  for (let i = 1; i <= 26; i++) {
    insertNotification.run(
      i,
      'A little check-in! ❤️',
      'Will you be available to help save a life next week? Tap to update your availability. 🩸',
      'WEEKLY_REMINDER',
      i <= 5 ? 1 : 0
    );
  }

  // 9. Generate Historical Demand Data (6 months of daily data for ML forecasting)
  console.log('Generating 180 days of realistic synthetic demand data for AI model training...');
  const insertDemand = db.prepare(`
    INSERT INTO historical_demand (hospital_id, date, blood_group, component, units_demanded, units_supplied, units_shortage, stock_level, day_of_week)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const bloodGroups = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
  const components = ['Packed Red Blood Cells (PRBC)', 'Platelets', 'Whole Blood', 'Plasma'];

  // Base demand weights by blood group
  const groupDemandBase = {
    'O+': 5.2, 'O-': 2.8, 'A+': 4.1, 'A-': 1.6,
    'B+': 4.5, 'B-': 1.4, 'AB+': 1.9, 'AB-': 0.8
  };

  const compDemandFactor = {
    'Packed Red Blood Cells (PRBC)': 1.0,
    'Platelets': 0.75,
    'Whole Blood': 0.6,
    'Plasma': 0.5
  };

  const today = new Date('2026-11-16');

  // Generate 180 days backward
  for (let d = 180; d >= 1; d--) {
    const curDate = new Date(today);
    curDate.setDate(today.getDate() - d);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayOfWeek = curDate.getDay(); // 0 is Sunday, 6 is Saturday

    // Weekend surge for emergency trauma
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.35 : 1.0;
    // Seasonal variation (sinusoidal over 180 days)
    const seasonalMultiplier = 1.0 + 0.15 * Math.sin((180 - d) / 28);

    // Pick top combinations to keep database size optimal and focused
    for (const bg of ['O+', 'O-', 'A+', 'B+']) {
      for (const comp of ['Packed Red Blood Cells (PRBC)', 'Platelets']) {
        const base = (groupDemandBase[bg] || 3.0) * (compDemandFactor[comp] || 1.0);
        // Random gaussian-like fluctuation
        const randNoise = (Math.random() + Math.random() + Math.random() - 1.5) * 1.5;
        const demand = Math.max(0, Math.round(base * weekendMultiplier * seasonalMultiplier + randNoise));
        
        // Supply fluctuates with collection
        const supplied = Math.max(0, Math.min(demand, Math.round(demand - Math.max(0, Math.random() * 2 - 0.5))));
        const shortage = demand - supplied;
        const simulatedStock = Math.max(1, Math.round(base * 3 + randNoise * 2));

        insertDemand.run(1, dateStr, bg, comp, demand, supplied, shortage, simulatedStock, dayOfWeek);
      }
    }
  }

  console.log('Database seeded successfully.');
}

module.exports = {
  seedDatabase
};
