const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getCurrentWeekRange() {
  const today = new Date();
  const dayIndex = today.getDay();
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;

  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  return {
    start: monday.toISOString().slice(0, 10),
    end: friday.toISOString().slice(0, 10),
  };
}

router.get("/", requireAuth, (req, res) => {
  const counselorId = req.session.counselorId;
  const counselor = db
    .prepare("SELECT id, name, email, title FROM counselors WHERE id = ?")
    .get(counselorId);

  const todayISO = getTodayISO();
  const { start, end } = getCurrentWeekRange();

  const todaysSchedule = db
    .prepare(
      `SELECT id, student_name AS name, student_tag AS tag, session_type AS type,
              start_time AS startTime, end_time AS endTime, status
       FROM appointments
       WHERE counselor_id = ? AND date = ? AND status IN ('confirmed', 'blocked')
       ORDER BY start_time ASC`
    )
    .all(counselorId, todayISO);

  const sessionsToday = todaysSchedule.filter((appointment) => appointment.status === "confirmed").length;

  const { count: sessionsThisWeek } = db
    .prepare(
      `SELECT COUNT(*) AS count
       FROM appointments
       WHERE counselor_id = ? AND date BETWEEN ? AND ? AND status = 'confirmed'`
    )
    .get(counselorId, start, end);

  res.json({
    counselor,
    todayISO,
    stats: {
      sessionsToday,
      sessionsThisWeek,
      pendingRequests: 5,
    },
    todaysSchedule,
  });
});

module.exports = router;
