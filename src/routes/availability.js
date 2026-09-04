const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  const counselorId = req.session.counselorId;

  const weeklyHours = db
    .prepare(
      `SELECT day_of_week AS dayOfWeek, is_active AS isActive, start_time AS startTime, end_time AS endTime
       FROM availability_weekly
       WHERE counselor_id = ?
       ORDER BY day_of_week ASC`
    )
    .all(counselorId);

  const blockedDates = db
    .prepare(
      `SELECT id, date, reason
       FROM availability_blocked_dates
       WHERE counselor_id = ?
       ORDER BY date ASC`
    )
    .all(counselorId);

  const settings =
    db
      .prepare(
        `SELECT default_duration_minutes AS defaultDurationMinutes
         FROM counselor_settings
         WHERE counselor_id = ?`
      )
      .get(counselorId) || { defaultDurationMinutes: 30 };

  res.json({ weeklyHours, blockedDates, settings });
});

router.put("/", requireAuth, (req, res) => {
  const counselorId = req.session.counselorId;
  const { weeklyHours, defaultDurationMinutes, blockedDates } = req.body || {};

  const updateDay = db.prepare(
    `UPDATE availability_weekly
     SET is_active = ?, start_time = ?, end_time = ?
     WHERE counselor_id = ? AND day_of_week = ?`
  );
  const updateSettings = db.prepare(
    `UPDATE counselor_settings
     SET default_duration_minutes = ?
     WHERE counselor_id = ?`
  );
  const deleteBlockedDates = db.prepare("DELETE FROM availability_blocked_dates WHERE counselor_id = ?");
  const insertBlockedDate = db.prepare(
    "INSERT INTO availability_blocked_dates (counselor_id, date, reason) VALUES (?, ?, ?)"
  );

  const runUpdate = db.transaction(() => {
    if (Array.isArray(weeklyHours)) {
      for (const day of weeklyHours) {
        updateDay.run(
          day.isActive ? 1 : 0,
          day.startTime || "08:00",
          day.endTime || "17:00",
          counselorId,
          day.dayOfWeek
        );
      }
    }

    if (defaultDurationMinutes != null) {
      const currentSettings = db
        .prepare(
          `SELECT default_duration_minutes AS defaultDurationMinutes
           FROM counselor_settings
           WHERE counselor_id = ?`
        )
        .get(counselorId);

      updateSettings.run(
        defaultDurationMinutes != null ? defaultDurationMinutes : currentSettings.defaultDurationMinutes,
        counselorId
      );
    }

    if (Array.isArray(blockedDates)) {
      deleteBlockedDates.run(counselorId);
      for (const blockedDate of blockedDates) {
        if (!blockedDate || !blockedDate.date) continue;
        insertBlockedDate.run(counselorId, blockedDate.date, blockedDate.reason || "");
      }
    }
  });

  runUpdate();
  res.json({ ok: true });
});

router.post("/blocked-dates", requireAuth, (req, res) => {
  const counselorId = req.session.counselorId;
  const { date, reason } = req.body || {};

  if (!date) {
    return res.status(400).json({ error: "Date is required." });
  }

  const insertBlockedDate = db.prepare(
    "INSERT INTO availability_blocked_dates (counselor_id, date, reason) VALUES (?, ?, ?)"
  );
  const insertResult = insertBlockedDate.run(counselorId, date, reason || "");

  res.status(201).json({ id: insertResult.lastInsertRowid, date, reason: reason || "" });
});

router.delete("/blocked-dates/:id", requireAuth, (req, res) => {
  const counselorId = req.session.counselorId;

  db.prepare("DELETE FROM availability_blocked_dates WHERE id = ? AND counselor_id = ?").run(
    req.params.id,
    counselorId
  );

  res.json({ ok: true });
});

module.exports = router;
