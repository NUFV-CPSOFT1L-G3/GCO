const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDirectory = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const databasePath = path.join(dataDirectory, "guidance-office.sqlite");
const db = new DatabaseSync(databasePath);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS counselors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Guidance Counselor',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS availability_weekly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counselor_id INTEGER NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    start_time TEXT NOT NULL DEFAULT '08:00',
    end_time TEXT NOT NULL DEFAULT '17:00',
    UNIQUE(counselor_id, day_of_week)
  );

  CREATE TABLE IF NOT EXISTS availability_blocked_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counselor_id INTEGER NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS counselor_settings (
    counselor_id INTEGER PRIMARY KEY REFERENCES counselors(id) ON DELETE CASCADE,
    default_duration_minutes INTEGER NOT NULL DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    counselor_id INTEGER NOT NULL REFERENCES counselors(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_tag TEXT NOT NULL DEFAULT '',
    session_type TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
  );

  CREATE INDEX IF NOT EXISTS idx_appointments_counselor_date ON appointments(counselor_id, date);
`);

// node:sqlite's DatabaseSync does not provide a transaction helper, so this wrapper keeps the
// same API shape the rest of the app expects while making the behavior explicit and safer.
db.transaction = function createTransaction(callback) {
  return (...args) => {
    db.exec("BEGIN");
    try {
      const result = callback(...args);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };
};

module.exports = db;
