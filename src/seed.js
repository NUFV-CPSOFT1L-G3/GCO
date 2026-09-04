const db = require("./db");
const { hashPassword } = require("./middleware/auth");

const DEMO_EMAIL = "a.reyes@school.edu.ph";
const DEMO_PASSWORD = "guidance123";

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(baseDate, dayCount) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + dayCount);
  return nextDate;
}

function getMondayOfCurrentWeek() {
  const today = new Date();
  const weekday = today.getDay();
  const offsetToMonday = weekday === 0 ? -6 : 1 - weekday;

  const monday = new Date(today);
  monday.setDate(today.getDate() + offsetToMonday);
  return monday;
}

const applySeed = db.transaction(() => {
  let counselor = db.prepare("SELECT id FROM counselors WHERE email = ?").get(DEMO_EMAIL);
  let counselorId;

  if (counselor) {
    counselorId = counselor.id;
    console.log(`Counselor already exists (id ${counselorId}); reseeding schedule data.`);
    db.prepare("DELETE FROM appointments WHERE counselor_id = ?").run(counselorId);
  } else {
    const insertResult = db
      .prepare("INSERT INTO counselors (name, email, password_hash, title) VALUES (?, ?, ?, ?)")
      .run("Ms. A. Reyes", DEMO_EMAIL, hashPassword(DEMO_PASSWORD), "Senior Guidance Counselor");
    counselorId = insertResult.lastInsertRowid;

    db.prepare("INSERT INTO counselor_settings (counselor_id, default_duration_minutes) VALUES (?, 20)").run(
      counselorId
    );

    const insertAvailability = db.prepare(
      "INSERT INTO availability_weekly (counselor_id, day_of_week, is_active, start_time, end_time) VALUES (?, ?, ?, ?, ?)"
    );
    const weekdayHours = {
      1: ["08:00", "17:00"],
      2: ["08:00", "17:00"],
      3: ["08:00", "12:00"],
      4: ["08:00", "17:00"],
      5: ["08:00", "15:00"],
    };

    for (let day = 0; day <= 6; day++) {
      const [startTime, endTime] = weekdayHours[day] || ["08:00", "17:00"];
      insertAvailability.run(counselorId, day, weekdayHours[day] ? 1 : 0, startTime, endTime);
    }

    db.prepare(
      "INSERT INTO availability_blocked_dates (counselor_id, date, reason) VALUES (?, ?, ?)"
    ).run(counselorId, toISODate(addDays(new Date(), 14)), "Faculty In-Service Day");
  }

  const mondayOfWeek = getMondayOfCurrentWeek();
  const insertAppointment = db.prepare(
    `INSERT INTO appointments (counselor_id, student_name, student_tag, session_type, date, start_time, end_time, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const today = new Date();
  const todayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const sampleAppointments = [
    { dayOffset: todayOffset, start: "09:00", end: "09:20", name: "Miguel Torres", tag: "SHS · Grade 11", type: "Academic Advising" },
    { dayOffset: todayOffset, start: "09:30", end: "10:00", name: "Bea Fernandez", tag: "College · BSIT-3", type: "Career Counseling" },
    { dayOffset: todayOffset, start: "10:00", end: "10:20", name: "Juan Dela Cruz", tag: "SHS · Grade 12", type: "Academic Advising" },
    { dayOffset: todayOffset, start: "13:00", end: "13:20", name: "Angelo Ramos", tag: "College · BSCS-2", type: "Follow-up Session" },
    { dayOffset: 0, start: "09:00", end: "09:20", name: "M. Torres", tag: "SHS · Grade 11", type: "Academic Advising" },
    { dayOffset: 0, start: "10:00", end: "10:30", name: "B. Fernandez", tag: "College · BSIT-3", type: "Career Counseling" },
    { dayOffset: 1, start: "11:00", end: "11:20", name: "J. Dela Cruz", tag: "SHS · Grade 12", type: "Academic Advising" },
    { dayOffset: 3, start: "13:00", end: "13:20", name: "A. Ramos", tag: "College · BSCS-2", type: "Follow-up Session" },
    { dayOffset: 3, start: "14:00", end: "14:30", name: "K. Villanueva", tag: "SHS · Grade 11", type: "Personal Counseling" },
    { dayOffset: 1, start: "15:00", end: "15:30", name: "P. Aquino", tag: "SHS · Grade 12", type: "Career Counseling" },
  ];

  const seenAppointments = new Set();
  for (const appointment of sampleAppointments) {
    const appointmentDate = toISODate(addDays(mondayOfWeek, appointment.dayOffset));
    const appointmentKey = `${appointmentDate}-${appointment.start}`;

    if (seenAppointments.has(appointmentKey)) {
      continue;
    }

    seenAppointments.add(appointmentKey);
    insertAppointment.run(
      counselorId,
      appointment.name,
      appointment.tag,
      appointment.type,
      appointmentDate,
      appointment.start,
      appointment.end,
      "confirmed"
    );
  }

  console.log("Seed complete.");
  console.log(`  Login email:    ${DEMO_EMAIL}`);
  console.log(`  Login password: ${DEMO_PASSWORD}`);
});

applySeed();
