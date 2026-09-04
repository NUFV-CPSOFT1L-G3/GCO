const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function getMondayFor(dateInput) {
  const selectedDate = dateInput ? new Date(dateInput + "T00:00:00") : new Date();
  const day = selectedDate.getDay();
  const differenceToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(selectedDate);
  monday.setDate(selectedDate.getDate() + differenceToMonday);
  return monday;
}

function toISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, dayOffset) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

router.get("/week", requireAuth, (req, res) => {
  const counselorId = req.session.counselorId;
  const monday = getMondayFor(req.query.weekStart);
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((offset) => toISO(addDays(monday, offset)));
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const appointments = db
    .prepare(
      `SELECT id, student_name AS studentName, student_tag AS studentTag, session_type AS sessionType,
              date, start_time AS startTime, end_time AS endTime, status
       FROM appointments
       WHERE counselor_id = ? AND date BETWEEN ? AND ?
       ORDER BY start_time ASC`
    )
    .all(counselorId, weekStart, weekEnd);

  const blockedDates = db
    .prepare(
      `SELECT date, reason
       FROM availability_blocked_dates
       WHERE counselor_id = ? AND date BETWEEN ? AND ?
       ORDER BY date ASC`
    )
    .all(counselorId, weekStart, weekEnd);

  const weeklyHours = db
    .prepare(
      `SELECT day_of_week AS dayOfWeek, is_active AS isActive, start_time AS startTime, end_time AS endTime
       FROM availability_weekly
       WHERE counselor_id = ?`
    )
    .all(counselorId);

  const activeHours = weeklyHours.filter((entry) => entry.isActive);
  let earliestHour = 8;
  let latestHour = 17;

  if (activeHours.length) {
    earliestHour = Math.min(...activeHours.map((entry) => parseInt(entry.startTime.split(":")[0], 10)));
    latestHour = Math.max(...activeHours.map((entry) => parseInt(entry.endTime.split(":")[0], 10)));
  }

  const hours = [];
  for (let hour = earliestHour; hour < latestHour; hour++) {
    hours.push(`${String(hour).padStart(2, "0")}:00`);
  }

  res.json({ weekStart, weekEnd, weekDays, hours, appointments, blockedDates });
});

module.exports = router;
