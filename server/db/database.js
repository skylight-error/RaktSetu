const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.resolve(__dirname, '..', '..', 'raktsetu.db');
const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for better concurrency
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      FOREIGN KEY (preferred_hospital_id) REFERENCES hospitals(id)
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
      donor_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (donor_id) REFERENCES donors(id)
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
  `);
}

module.exports = {
  db,
  initSchema
};
