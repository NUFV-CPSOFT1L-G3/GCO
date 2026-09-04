/**
 * Firestore Database Seeding Script for GCOunsel
 * Run with: node scripts/seed-firestore.js
 */

const { getDb } = require("../netlify/functions/utils/firebase-admin");

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(baseDate, days) {
  const res = new Date(baseDate);
  res.setDate(res.getDate() + days);
  return res;
}

async function seed() {
  console.log("Seeding GCOunsel database...");
  const db = getDb();
  const today = new Date();
  const todayISO = toISODate(today);

  // 1. Seed Counselors
  const defaultWeeklyHours = [
    { dayOfWeek: 0, isActive: false, startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: 1, isActive: true, startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: 2, isActive: true, startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: 3, isActive: true, startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: 4, isActive: true, startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: 5, isActive: true, startTime: "08:00", endTime: "17:00" },
    { dayOfWeek: 6, isActive: true, startTime: "08:00", endTime: "12:00" },
  ];

  const inServiceDate = toISODate(addDays(today, 14));

  const counselors = [
    {
      id: "counselor_kyle_work",
      name: "Kyle Carandang",
      email: "kylecarandang.work@gmail.com",
      title: "Lead Guidance Counselor & Administrator",
      credentials: "RGC, RPm, System Admin",
      role: "admin", // Admin role gives you access to both Counselor Dashboard AND Admin Center!
      preferredAreas: ["Academic", "Career", "Personal", "Family", "Social", "Mental Wellness"],
      sessionsHandled: 128,
      sessionsCompleted: 115,
      defaultDurationMinutes: 30,
      weeklyHours: defaultWeeklyHours,
      blockedDates: [{ date: inServiceDate, reason: "Faculty In-Service Day" }],
      createdAt: new Date().toISOString(),
    },
    {
      id: "counselor_kyle_nu",
      name: "Kyle Carandang",
      email: "kyle.carandang@nu-fairview.edu.ph",
      title: "Lead Guidance Counselor",
      credentials: "RGC, RPm",
      role: "counselor",
      preferredAreas: ["Academic", "Career", "Personal", "Family", "Social", "Mental Wellness"],
      sessionsHandled: 64,
      sessionsCompleted: 58,
      defaultDurationMinutes: 30,
      weeklyHours: defaultWeeklyHours,
      blockedDates: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: "admin_kyle_001",
      name: "Kyle Carandang",
      email: "admin@nu-fairview.edu.ph",
      title: "Guidance Office Administrator",
      credentials: "Head Administrator",
      role: "admin",
      preferredAreas: ["Academic", "Career", "Personal", "Family", "Social", "Mental Wellness"],
      sessionsHandled: 0,
      sessionsCompleted: 0,
      defaultDurationMinutes: 30,
      weeklyHours: defaultWeeklyHours,
      blockedDates: [],
      createdAt: new Date().toISOString(),
    },
  ];

  for (const c of counselors) {
    await db.collection("counselors").doc(c.id).set(c);
    console.log(`✓ Seeded counselor/admin: ${c.name} (${c.email})`);
  }

  // 2. Seed Appointments
  const appointments = [
    // Today's appointments
    {
      id: "appt_today_01",
      confirmationNumber: "GCO-2026-00121",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Dela Cruz, Juan M.",
      studentId: "2024-100234",
      studentEmail: "jdelacruz@students.nu-fairview.edu.ph",
      course: "BS Information Technology",
      categories: ["Academic", "Career"],
      date: todayISO,
      startTime: "09:00",
      endTime: "09:30",
      slotKey: `counselor_reyes_001_${todayISO}_09:00`,
      status: "completed",
      hasFeedback: true,
      feedbackId: "fb_01",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "appt_today_02",
      confirmationNumber: "GCO-2026-00122",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Fernandez, Bea L.",
      studentId: "2023-100889",
      studentEmail: "bfernandez@students.nu-fairview.edu.ph",
      course: "BS Computer Science",
      categories: ["Career"],
      date: todayISO,
      startTime: "10:00",
      endTime: "10:30",
      slotKey: `counselor_reyes_001_${todayISO}_10:00`,
      status: "completed",
      hasFeedback: true,
      feedbackId: "fb_02",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "appt_today_03",
      confirmationNumber: "GCO-2026-00123",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Torres, Miguel P.",
      studentId: "2024-200112",
      studentEmail: "mtorres@students.nu-fairview.edu.ph",
      course: "SHS - STEM",
      categories: ["Academic"],
      date: todayISO,
      startTime: "11:00",
      endTime: "11:30",
      slotKey: `counselor_reyes_001_${todayISO}_11:00`,
      status: "no-show",
      hasFeedback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "appt_today_04",
      confirmationNumber: "GCO-2026-00124",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Ramos, Angelo V.",
      studentId: "2023-300445",
      studentEmail: "aramos@students.nu-fairview.edu.ph",
      course: "BS Computer Engineering",
      categories: ["Mental Wellness", "Personal"],
      date: todayISO,
      startTime: "13:00",
      endTime: "13:30",
      slotKey: `counselor_reyes_001_${todayISO}_13:00`,
      status: "confirmed",
      hasFeedback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "appt_today_05",
      confirmationNumber: "GCO-2026-00125",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Aquino, Paolo K.",
      studentId: "2022-100678",
      studentEmail: "paquino@students.nu-fairview.edu.ph",
      course: "BS Business Administration",
      categories: ["Career"],
      date: todayISO,
      startTime: "14:00",
      endTime: "14:30",
      slotKey: `counselor_reyes_001_${todayISO}_14:00`,
      status: "confirmed",
      hasFeedback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    // Past & other appointments for analytics
    {
      id: "appt_past_01",
      confirmationNumber: "GCO-2026-00118",
      counselorId: "counselor_santos_002",
      counselorName: "Mr. J. Santos",
      studentName: "Guerrero, Nadia C.",
      studentId: "2023-100999",
      studentEmail: "nguerrero@students.nu-fairview.edu.ph",
      course: "BS Psychology",
      categories: ["Social", "Family"],
      date: toISODate(addDays(today, -1)),
      startTime: "10:00",
      endTime: "10:30",
      slotKey: `counselor_santos_002_${toISODate(addDays(today, -1))}_10:00`,
      status: "completed",
      hasFeedback: true,
      feedbackId: "fb_03",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "appt_past_02",
      confirmationNumber: "GCO-2026-00119",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Ilagan, Sam R.",
      studentId: "2024-100555",
      studentEmail: "silagan@students.nu-fairview.edu.ph",
      course: "SHS - ABM",
      categories: ["Academic"],
      date: toISODate(addDays(today, -2)),
      startTime: "14:00",
      endTime: "14:30",
      slotKey: `CANCELLED_counselor_reyes_001_${toISODate(addDays(today, -2))}_14:00`,
      status: "cancelled",
      cancellationReason: "Student Requested Cancellation",
      cancellationRemarks: "Student had a class conflict",
      hasFeedback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  for (const a of appointments) {
    await db.collection("appointments").doc(a.id).set(a);
    console.log(`✓ Seeded appointment: ${a.confirmationNumber} (${a.studentName}) - ${a.status}`);
  }

  // 3. Seed Feedback
  const feedbackList = [
    {
      id: "fb_01",
      appointmentId: "appt_today_01",
      confirmationNumber: "GCO-2026-00121",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Dela Cruz, Juan M.",
      course: "BS Information Technology",
      categories: ["Academic", "Career"],
      rating: 5,
      appreciated: ["Helpful", "Professional", "Good Listener"],
      comments: "Very helpful and approachable. Cleared all my academic advising questions.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "fb_02",
      appointmentId: "appt_today_02",
      confirmationNumber: "GCO-2026-00122",
      counselorId: "counselor_reyes_001",
      counselorName: "Ms. A. Reyes",
      studentName: "Fernandez, Bea L.",
      course: "BS Computer Science",
      categories: ["Career"],
      rating: 5,
      appreciated: ["Professional", "Friendly", "Comfortable Environment"],
      comments: "The counselor was very easy to talk to and gave wonderful career guidance.",
      createdAt: new Date().toISOString(),
    },
    {
      id: "fb_03",
      appointmentId: "appt_past_01",
      confirmationNumber: "GCO-2026-00118",
      counselorId: "counselor_santos_002",
      counselorName: "Mr. J. Santos",
      studentName: "Guerrero, Nadia C.",
      course: "BS Psychology",
      categories: ["Social", "Family"],
      rating: 4,
      appreciated: ["Helpful", "Good Listener"],
      comments: "The session was helpful and I felt comfortable sharing my thoughts.",
      createdAt: new Date().toISOString(),
    },
  ];

  for (const fb of feedbackList) {
    await db.collection("feedback").doc(fb.id).set(fb);
    console.log(`✓ Seeded feedback: ${fb.rating} stars for ${fb.counselorName}`);
  }

  // 4. Seed Counter
  await db.collection("counters").doc("appointments").set({
    lastNumber: 125,
    year: today.getFullYear(),
    updatedAt: new Date().toISOString(),
  });
  console.log("✓ Seeded appointment counter (lastNumber: 125)");

  console.log("\nDatabase seeding completed successfully!");
  console.log("------------------------------------------------------------------");
  console.log("Default Logins:");
  console.log("Counselor: a.reyes@school.edu.ph / guidance123");
  console.log("Admin:     admin@school.edu.ph / admin123");
  console.log("------------------------------------------------------------------");
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
