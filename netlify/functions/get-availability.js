const { getDb } = require("./utils/firebase-admin");

function formatTime12h(time24) {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const { counselorId, date } = event.queryStringParameters || {};

  if (!counselorId || !date) {
    return { statusCode: 400, body: JSON.stringify({ error: "counselorId and date are required." }) };
  }

  try {
    const db = getDb();
    const counselorDoc = await db.collection("counselors").doc(counselorId).get();

    if (!counselorDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: "Counselor not found." }) };
    }

    const counselor = counselorDoc.data();

    // 1. Check if date is blocked
    const blockedDates = counselor.blockedDates || [];
    const blockedMatch = blockedDates.find((b) => b.date === date);
    if (blockedMatch) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available: false,
          reason: blockedMatch.reason || "Counselor is out of office on this date.",
          slots: [],
        }),
      };
    }

    // 2. Determine Day of Week
    const parsedDate = new Date(`${date}T00:00:00`);
    const dayOfWeek = parsedDate.getDay(); // 0 = Sun, 1 = Mon ...

    const weeklyHours = counselor.weeklyHours || [];
    const daySchedule = weeklyHours.find((d) => d.dayOfWeek === dayOfWeek);

    if (!daySchedule || !daySchedule.isActive) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          available: false,
          reason: dayOfWeek === 0 ? "Guidance Counseling Office is closed on Sundays." : "Counselor is off-duty on this day.",
          slots: [],
        }),
      };
    }

    // 3. Fetch booked appointments for this counselor and date
    const bookedQuery = await db
      .collection("appointments")
      .where("counselorId", "==", counselorId)
      .where("date", "==", date)
      .where("status", "==", "confirmed")
      .get();

    const bookedStarts = new Set();
    bookedQuery.forEach((doc) => {
      const appt = doc.data();
      bookedStarts.add(appt.startTime);
    });

    // 4. Generate candidate time slots
    const duration = counselor.defaultDurationMinutes || 30;
    const [startH, startM] = (daySchedule.startTime || "08:00").split(":").map(Number);
    const [endH, endM] = (daySchedule.endTime || "17:00").split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const slots = [];
    const now = new Date();
    const isToday = now.toISOString().slice(0, 10) === date;
    const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

    for (let m = startMinutes; m + duration <= endMinutes; m += duration) {
      const slotH = String(Math.floor(m / 60)).padStart(2, "0");
      const slotM = String(m % 60).padStart(2, "0");
      const timeStr = `${slotH}:${slotM}`;

      const endSlotM = m + duration;
      const endSlotHStr = String(Math.floor(endSlotM / 60)).padStart(2, "0");
      const endSlotMStr = String(endSlotM % 60).padStart(2, "0");
      const endTimeStr = `${endSlotHStr}:${endSlotMStr}`;

      // Skip past slots if today
      if (isToday && m <= currentMinutesNow) {
        continue;
      }

      // Check collision
      const isBooked = bookedStarts.has(timeStr);

      slots.push({
        startTime: timeStr,
        endTime: endTimeStr,
        label: `${formatTime12h(timeStr)} - ${formatTime12h(endTimeStr)}`,
        available: !isBooked,
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        available: true,
        counselorName: counselor.name,
        date,
        durationMinutes: duration,
        slots,
      }),
    };
  } catch (error) {
    console.error("Availability query error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
