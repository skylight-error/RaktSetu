const XLSX = require('xlsx');
const { db } = require('../db/database');

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/**
 * Generate standard hospital Excel donor template
 */
function generateDonorTemplateBuffer(format = 'xlsx') {
  const headers = [
    'Full Name',
    'Date of Birth (YYYY-MM-DD)',
    'Gender',
    'Mobile Number',
    'Email Address',
    'Blood Group',
    'Address',
    'City',
    'PIN Code',
    'Last Donation Date (YYYY-MM-DD)',
    'Existing Hospital Notes'
  ];

  const sampleRows = [
    [
      'Aakash Mehta',
      '1995-07-14',
      'Male',
      '+91 98200 55112',
      'aakash.m@example.com',
      'O+',
      '102, Shanti Bhavan, Dadar West',
      'Mumbai',
      '400028',
      '2026-04-10',
      'Regular voluntary donor at annual camp'
    ],
    [
      'Neelam Sen',
      '1998-11-20',
      'Female',
      '+91 98200 55113',
      'neelam.sen@example.com',
      'A-',
      'B/22, Sagar Tarang, Bandra West',
      'Mumbai',
      '400050',
      '2026-05-15',
      'Donor card verified by staff'
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, { wch: 25 }, { wch: 10 }, { wch: 18 }, { wch: 25 },
    { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 28 }, { wch: 35 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'RaktSetu_Donor_Template');

  if (format === 'csv') {
    return XLSX.write(wb, { type: 'buffer', bookType: 'csv' });
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Normalize and auto-map column headers
 */
function autoMapColumns(rawHeaders) {
  const mapping = {};
  const lowerMap = {
    name: 'full_name',
    'full name': 'full_name',
    'donor name': 'full_name',
    dob: 'dob',
    'date of birth': 'dob',
    birthdate: 'dob',
    gender: 'gender',
    sex: 'gender',
    mobile: 'mobile',
    phone: 'mobile',
    'mobile number': 'mobile',
    contact: 'mobile',
    'phone number': 'mobile',
    email: 'email',
    'email address': 'email',
    'blood group': 'blood_group',
    blood: 'blood_group',
    'blood type': 'blood_group',
    bg: 'blood_group',
    address: 'address',
    city: 'city',
    pincode: 'pincode',
    pin: 'pincode',
    'pin code': 'pincode',
    'zip code': 'pincode',
    'last donation date': 'last_donation_date',
    'last donation': 'last_donation_date',
    notes: 'notes'
  };

  rawHeaders.forEach(header => {
    if (!header) return;
    const cleanHeader = header.toString().trim().toLowerCase().replace(/[^a-z0-9 ]/g, '');
    for (const [key, field] of Object.entries(lowerMap)) {
      if (cleanHeader.includes(key)) {
        mapping[header] = field;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Parse and validate uploaded buffer
 */
function processExcelUpload(fileBuffer, hospitalId = 1) {
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  // Convert to JSON with headers
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rawRows.length === 0) {
    throw new Error('Spreadsheet appears to be empty.');
  }

  const rawHeaders = Object.keys(rawRows[0]);
  const columnMapping = autoMapColumns(rawHeaders);

  // Fetch all existing mobiles and emails to check duplicates in DB
  const existingMobiles = new Set(db.prepare('SELECT mobile FROM donors').all().map(r => r.mobile.replace(/\D/g, '')));
  const existingEmails = new Set(db.prepare('SELECT email FROM donors WHERE email IS NOT NULL').all().map(r => r.email.toLowerCase()));

  const validRows = [];
  const invalidRows = [];
  const duplicateRows = [];
  const seenFileMobiles = new Set();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for 0-index, +1 for header
    const mapped = {};

    for (const [rawKey, targetKey] of Object.entries(columnMapping)) {
      mapped[targetKey] = (row[rawKey] || '').toString().trim();
    }

    // Default missing fields
    const name = mapped.full_name || row['Full Name'] || row['Name'] || '';
    let dob = mapped.dob || row['Date of Birth'] || row['DOB'] || '1995-01-01';
    if (dob instanceof Date) {
      dob = dob.toISOString().split('T')[0];
    }
    const gender = mapped.gender || row['Gender'] || 'Unspecified';
    const rawMobile = (mapped.mobile || row['Mobile'] || row['Phone'] || '').toString();
    const cleanMobileDigits = rawMobile.replace(/\D/g, '');
    const email = (mapped.email || row['Email'] || '').toLowerCase();
    let bloodGroup = (mapped.blood_group || row['Blood Group'] || '').toUpperCase().trim();
    const address = mapped.address || row['Address'] || 'Mumbai';
    const city = mapped.city || row['City'] || 'Mumbai';
    const pincode = mapped.pincode || row['PIN Code'] || '400001';
    let lastDonation = mapped.last_donation_date || row['Last Donation Date'] || null;
    if (lastDonation instanceof Date) {
      lastDonation = lastDonation.toISOString().split('T')[0];
    }
    const notes = mapped.notes || row['Notes'] || 'Imported via Excel spreadsheet';

    // Normalise blood group formatting (e.g. "O positive" -> "O+")
    bloodGroup = bloodGroup.replace(' POSITIVE', '+').replace(' NEGATIVE', '-');

    // Validation checks
    const errors = [];
    if (!name) errors.push('Missing Full Name');
    if (!cleanMobileDigits || cleanMobileDigits.length < 10) errors.push('Invalid phone number (must contain at least 10 digits)');
    if (!VALID_BLOOD_GROUPS.includes(bloodGroup)) errors.push(`Invalid blood group: "${bloodGroup}" (Must be one of: ${VALID_BLOOD_GROUPS.join(', ')})`);
    if (!pincode) errors.push('Missing PIN code');

    // Calculate approximate age
    let age = 25;
    try {
      const birthYear = new Date(dob).getFullYear();
      if (!isNaN(birthYear)) {
        age = Math.max(18, Math.min(65, 2026 - birthYear));
      }
    } catch (e) {
      age = 28;
    }

    const formattedMobile = cleanMobileDigits.length === 10 ? `+91 ${cleanMobileDigits.slice(0, 5)} ${cleanMobileDigits.slice(5)}` : rawMobile;

    const rowData = {
      rowNumber,
      fullName: name,
      dob,
      age,
      gender,
      mobile: formattedMobile,
      rawMobile: cleanMobileDigits,
      email,
      bloodGroup,
      address,
      city,
      pincode,
      lastDonationDate: lastDonation,
      notes
    };

    if (errors.length > 0) {
      invalidRows.push({ ...rowData, errors });
      return;
    }

    // Check duplicate within file
    if (seenFileMobiles.has(cleanMobileDigits)) {
      duplicateRows.push({ ...rowData, reason: 'Duplicate mobile number in same spreadsheet' });
      return;
    }
    seenFileMobiles.add(cleanMobileDigits);

    // Check duplicate in database
    if (existingMobiles.has(cleanMobileDigits)) {
      duplicateRows.push({ ...rowData, reason: 'Donor already registered in RaktSetu database' });
      return;
    }

    validRows.push(rowData);
  });

  return {
    fileName: sheetName,
    totalRows: rawRows.length,
    validCount: validRows.length,
    duplicateCount: duplicateRows.length,
    invalidCount: invalidRows.length,
    rawHeaders,
    columnMapping,
    previewRows: rawRows.slice(0, 5),
    validRows,
    duplicateRows,
    invalidRows
  };
}

/**
 * Commit validated rows into SQLite with status PENDING VERIFICATION
 */
function commitImportedDonors(validRows, hospitalId = 1) {
  const insertStmt = db.prepare(`
    INSERT INTO donors (
      full_name, dob, age, gender, mobile, email, blood_group, address, city, pincode,
      preferred_hospital_id, screening_status, screening_valid_until, last_donation_date,
      weekly_availability, latitude, longitude, consent_contact, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING VERIFICATION', NULL, ?, 'UNCONFIRMED', 19.0760, 72.8777, 1, 'EXCEL_IMPORT')
  `);

  let insertedCount = 0;
  for (const donor of validRows) {
    try {
      insertStmt.run(
        donor.fullName,
        donor.dob,
        donor.age,
        donor.gender,
        donor.mobile,
        donor.email || null,
        donor.bloodGroup,
        donor.address,
        donor.city,
        donor.pincode,
        hospitalId,
        donor.lastDonationDate || null
      );
      insertedCount++;
    } catch (err) {
      console.error('Failed to insert imported donor row:', err.message);
    }
  }

  return {
    success: true,
    insertedCount
  };
}

/**
 * Generate error report Excel file buffer
 */
function generateErrorReportBuffer(invalidRows) {
  const data = invalidRows.map(r => ({
    'Row #': r.rowNumber,
    'Full Name': r.fullName,
    'Mobile': r.mobile,
    'Blood Group': r.bloodGroup,
    'Errors': (r.errors || [r.reason]).join('; ')
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Import_Errors');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  generateDonorTemplateBuffer,
  processExcelUpload,
  commitImportedDonors,
  generateErrorReportBuffer
};
