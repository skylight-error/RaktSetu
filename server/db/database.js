const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.resolve(__dirname, '..', '..', 'raktsetu.db');
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for reliability
db.exec('PRAGMA foreign_keys = ON;');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      pincode TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donor_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT DEFAULT 'Unspecified',
      mobile TEXT NOT NULL,
      email TEXT,
      blood_group TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      pincode TEXT NOT NULL,
      preferred_hospital_id INTEGER,
      consent_contact INTEGER DEFAULT 1,
      status TEXT DEFAULT 'PENDING_APPROVAL',
      reviewed_by_hospital_id INTEGER,
      reviewed_by_staff_name TEXT,
      reviewed_at TEXT,
      rejection_reason TEXT,
      activation_otp TEXT,
      activation_otp_expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (preferred_hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY (reviewed_by_hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER,
      full_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT DEFAULT 'Unspecified',
      mobile TEXT UNIQUE NOT NULL,
      email TEXT,
      blood_group TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      pincode TEXT NOT NULL,
      preferred_hospital_id INTEGER,
      registration_status TEXT DEFAULT 'APPROVED',
      account_status TEXT DEFAULT 'ACTIVE',
      medical_screening_status TEXT DEFAULT 'PENDING_SCREENING',
      screening_status TEXT DEFAULT 'PENDING SCREENING',
      screening_valid_until TEXT,
      last_donation_date TEXT,
      next_eligible_date TEXT,
      weekly_availability TEXT DEFAULT 'UNCONFIRMED',
      weekly_availability_updated_at TEXT,
      latitude REAL,
      longitude REAL,
      consent_contact INTEGER DEFAULT 1,
      source TEXT DEFAULT 'SELF_REGISTERED',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (preferred_hospital_id) REFERENCES hospitals(id),
      FOREIGN KEY (application_id) REFERENCES donor_applications(id)
    );

    CREATE TABLE IF NOT EXISTS donor_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER UNIQUE,
      donor_id INTEGER UNIQUE NOT NULL,
      email TEXT,
      mobile TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      account_status TEXT DEFAULT 'ACTIVE',
      activated_at TEXT DEFAULT (datetime('now')),
      last_login_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (application_id) REFERENCES donor_applications(id),
      FOREIGN KEY (donor_id) REFERENCES donors(id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      user_type TEXT NOT NULL,
      role TEXT NOT NULL,
      hospital_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS screening_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      staff_name TEXT NOT NULL,
      screening_date TEXT NOT NULL,
      status TEXT NOT NULL,
      deferral_reason TEXT,
      staff_notes TEXT,
      next_eligible_date TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (donor_id) REFERENCES donors(id),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT DEFAULT 'SCHEDULED',
      instructions TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (donor_id) REFERENCES donors(id),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS availability_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      week_number TEXT NOT NULL,
      status TEXT NOT NULL,
      response_timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (donor_id) REFERENCES donors(id)
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL,
      blood_group TEXT NOT NULL,
      component TEXT NOT NULL,
      unit_code TEXT NOT NULL,
      quantity_units INTEGER NOT NULL DEFAULT 1,
      collection_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      storage_location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'USABLE',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL,
      inventory_id INTEGER,
      blood_group TEXT NOT NULL,
      component TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      reason TEXT,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS blood_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL,
      blood_group TEXT NOT NULL,
      component TEXT NOT NULL,
      quantity_needed INTEGER NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'ROUTINE',
      required_by TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'NEW',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS donor_contact_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      donor_id INTEGER NOT NULL,
      hospital_id INTEGER NOT NULL,
      contacted_at TEXT DEFAULT (datetime('now')),
      contact_method TEXT DEFAULT 'IN_APP_SIMULATION',
      response_status TEXT DEFAULT 'CONTACTED',
      notes TEXT,
      FOREIGN KEY (request_id) REFERENCES blood_requests(id),
      FOREIGN KEY (donor_id) REFERENCES donors(id),
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER,
      application_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (donor_id) REFERENCES donors(id),
      FOREIGN KEY (application_id) REFERENCES donor_applications(id)
    );

    CREATE TABLE IF NOT EXISTS historical_demand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hospital_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      component TEXT NOT NULL,
      units_demanded INTEGER NOT NULL,
      units_supplied INTEGER NOT NULL,
      units_shortage INTEGER NOT NULL DEFAULT 0,
      stock_level INTEGER NOT NULL DEFAULT 10,
      day_of_week INTEGER NOT NULL,
      FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
    );
    CREATE TABLE IF NOT EXISTS administrators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT DEFAULT 'SUPER_ADMIN',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Run schema migration checks for columns that might be missing in existing database files
  const safeAddColumn = (table, column, colDef) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${colDef};`);
    } catch (e) {
      // Column already exists or table doesn't need alteration
    }
  };

  safeAddColumn('donors', 'application_id', 'INTEGER');
  safeAddColumn('donors', 'registration_status', "TEXT DEFAULT 'APPROVED'");
  safeAddColumn('donors', 'account_status', "TEXT DEFAULT 'ACTIVE'");
  safeAddColumn('donors', 'medical_screening_status', "TEXT DEFAULT 'PENDING_SCREENING'");
  safeAddColumn('donor_applications', 'donor_id', 'INTEGER');
  safeAddColumn('hospitals', 'password_salt', 'TEXT');
  safeAddColumn('hospitals', 'application_id', 'TEXT');
  safeAddColumn('hospitals', 'registration_status', "TEXT DEFAULT 'APPROVED'");
  safeAddColumn('hospitals', 'account_status', "TEXT DEFAULT 'ACTIVE'");
  safeAddColumn('hospitals', 'reviewed_by_admin_id', 'INTEGER');
  safeAddColumn('hospitals', 'reviewed_at', 'TEXT');
  safeAddColumn('hospitals', 'rejection_reason', 'TEXT');
  safeAddColumn('hospitals', 'activation_otp', 'TEXT');
  safeAddColumn('hospitals', 'activation_otp_expires_at', 'TEXT');
  safeAddColumn('notifications', 'application_id', 'INTEGER');
}

module.exports = {
  db,
  initSchema
};
