const express = require("express");
const db = require("../db");
const { hashPassword, verifyPassword, requireAuth } = require("../middleware/auth");

const router = express.Router();
const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5];

function createDefaultAvailability(counselorId) {
  const insertDay = db.prepare(
    "INSERT INTO availability_weekly (counselor_id, day_of_week, is_active, start_time, end_time) VALUES (?, ?, ?, ?, ?)"
  );

  for (let day = 0; day <= 6; day++) {
    const isActive = DEFAULT_WORKING_DAYS.includes(day) ? 1 : 0;
    insertDay.run(counselorId, day, isActive, "08:00", "17:00");
  }
}

router.post("/register", (req, res) => {
  const { name, email, password, title } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existingCounselor = db.prepare("SELECT id FROM counselors WHERE email = ?").get(normalizedEmail);

  if (existingCounselor) {
    return res.status(409).json({ error: "An account with that email already exists." });
  }

  const passwordHash = hashPassword(password);
  const insertCounselor = db.prepare(
    "INSERT INTO counselors (name, email, password_hash, title) VALUES (?, ?, ?, ?)"
  );
  const insertResult = insertCounselor.run(
    name.trim(),
    normalizedEmail,
    passwordHash,
    (title || "Guidance Counselor").trim()
  );
  const counselorId = insertResult.lastInsertRowid;

  db.prepare("INSERT INTO counselor_settings (counselor_id, default_duration_minutes) VALUES (?, 30)").run(
    counselorId
  );

  createDefaultAvailability(counselorId);

  res.status(201).json({ id: counselorId, name, email: normalizedEmail });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const counselor = db.prepare("SELECT * FROM counselors WHERE email = ?").get(normalizedEmail);

  if (!counselor || !verifyPassword(password, counselor.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  req.session.counselorId = counselor.id;
  res.json({ id: counselor.id, name: counselor.name, email: counselor.email, title: counselor.title });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", requireAuth, (req, res) => {
  const counselor = db
    .prepare("SELECT id, name, email, title FROM counselors WHERE id = ?")
    .get(req.session.counselorId);

  if (!counselor) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.json(counselor);
});

module.exports = router;
