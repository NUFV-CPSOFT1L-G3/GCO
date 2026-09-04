const { getDb } = require("./utils/firebase-admin");
const { sendAppointmentConfirmation } = require("./utils/email");

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const {
      fullName,
      studentId,
      emailUsername,
      course,
      categories,
      counselorId,
      date,
      startTime,
      endTime,
    } = data;

    // 1. Validate required fields
    if (!fullName || !fullName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Full Name is required." }) };
    }

    if (!studentId || !/^\d{4}-\d{6}$/.test(studentId.trim())) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Valid Student ID is required (format: 20XX-XXXXXX)." }),
      };
    }

    if (!emailUsername || !emailUsername.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Institutional email username is required." }) };
    }

    if (!course || !course.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please select your course/program." }) };
    }

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please select at least one consultation reason." }) };
    }

    if (!counselorId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please select a guidance counselor." }) };
    }

    if (!date || !startTime) {
      return { statusCode: 400, body: JSON.stringify({ error: "Please select an appointment date and time." }) };
    }

    // Auto-generate full institutional email
    const cleanUsername = emailUsername.trim().replace(/@.*$/, "").toLowerCase();
    const fullStudentEmail = `${cleanUsername}@students.nu-fairview.edu.ph`;
    const cleanStudentId = studentId.trim();
    const cleanFullName = fullName.trim();
    const todayISO = getTodayISO();

    if (date < todayISO) {
      return { statusCode: 400, body: JSON.stringify({ error: "Appointment date cannot be in the past." }) };
    }

    const db = getDb();

    // 2. Duplicate Active Appointment Prevention
    // Check if the student already has an active (confirmed) appointment on or after today
    const studentIdQuery = await db
      .collection("appointments")
      .where("studentId", "==", cleanStudentId)
      .where("status", "==", "confirmed")
      .where("date", ">=", todayISO)
      .limit(1)
      .get();

    if (!studentIdQuery.empty) {
      const activeAppt = studentIdQuery.docs[0].data();
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: `You currently have an active appointment scheduled on ${activeAppt.date} at ${activeAppt.startTime} (Confirmation: ${activeAppt.confirmationNumber}). In accordance with GCO policy, students cannot maintain multiple active appointments.`,
        }),
      };
    }

    const studentEmailQuery = await db
      .collection("appointments")
      .where("studentEmail", "==", fullStudentEmail)
      .where("status", "==", "confirmed")
      .where("date", ">=", todayISO)
      .limit(1)
      .get();

    if (!studentEmailQuery.empty) {
      const activeAppt = studentEmailQuery.docs[0].data();
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: `An active appointment already exists under email ${fullStudentEmail} on ${activeAppt.date} at ${activeAppt.startTime}. In accordance with GCO policy, students cannot maintain multiple active appointments.`,
        }),
      };
    }

    // 3. Check Counselor Existence and Availability
    const counselorDoc = await db.collection("counselors").doc(counselorId).get();
    if (!counselorDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: "Selected guidance counselor was not found." }) };
    }
    const counselorData = counselorDoc.data();

    // Check if date is blocked by counselor
    if (Array.isArray(counselorData.blockedDates)) {
      const isBlocked = counselorData.blockedDates.some((b) => b.date === date);
      if (isBlocked) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: `The counselor is unavailable or out of office on ${date}.` }),
        };
      }
    }

    // Calculate appointment end time if not specified (default 30 or 60 mins)
    let calculatedEndTime = endTime;
    if (!calculatedEndTime) {
      const durationMins = counselorData.defaultDurationMinutes || 30;
      const [h, m] = startTime.split(":").map(Number);
      const endTotal = h * 60 + m + durationMins;
      const endH = String(Math.floor(endTotal / 60)).padStart(2, "0");
      const endM = String(endTotal % 60).padStart(2, "0");
      calculatedEndTime = `${endH}:${endM}`;
    }

    // 4. Atomic Transaction: Slot Check + Sequence Number + Creation
    const slotKey = `${counselorId}_${date}_${startTime}`;
    let confirmationNumber = "";
    let appointmentId = "";

    await db.runTransaction(async (transaction) => {
      // Collision check: verify slot has not been reserved
      const slotQuery = await transaction.get(
        db.collection("appointments")
          .where("slotKey", "==", slotKey)
          .where("status", "==", "confirmed")
      );

      if (!slotQuery.empty) {
        throw new Error("DOUBLE_BOOKING");
      }

      // Generate unique confirmation number (format: GCO-YYYY-XXXXX)
      const counterRef = db.collection("counters").doc("appointments");
      const counterDoc = await transaction.get(counterRef);
      const currentYear = new Date().getFullYear();
      let nextNum = 101;

      if (counterDoc.exists) {
        const lastNum = counterDoc.data().lastNumber || 100;
        nextNum = lastNum + 1;
        transaction.update(counterRef, { lastNumber: nextNum, updatedAt: new Date() });
      } else {
        transaction.set(counterRef, { lastNumber: nextNum, year: currentYear, updatedAt: new Date() });
      }

      confirmationNumber = `GCO-${currentYear}-${String(nextNum).padStart(5, "0")}`;

      const newApptRef = db.collection("appointments").doc();
      appointmentId = newApptRef.id;

      const appointmentRecord = {
        id: appointmentId,
        confirmationNumber,
        counselorId,
        counselorName: counselorData.name,
        studentName: cleanFullName,
        studentId: cleanStudentId,
        studentEmail: fullStudentEmail,
        course: course.trim(),
        categories,
        date,
        startTime,
        endTime: calculatedEndTime,
        slotKey,
        status: "confirmed",
        hasFeedback: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      transaction.set(newApptRef, appointmentRecord);

      // Increment counselor sessionsHandled
      const counselorRef = db.collection("counselors").doc(counselorId);
      const currentHandled = counselorData.sessionsHandled || 0;
      transaction.update(counselorRef, { sessionsHandled: currentHandled + 1 });
    });

    // 5. Send Confirmation Email
    await sendAppointmentConfirmation({
      studentEmail: fullStudentEmail,
      studentName: cleanFullName,
      confirmationNumber,
      counselorName: counselorData.name,
      date,
      startTime,
      endTime: calculatedEndTime,
      categories,
    });

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        appointment: {
          id: appointmentId,
          confirmationNumber,
          counselorName: counselorData.name,
          date,
          startTime,
          endTime: calculatedEndTime,
          studentEmail: fullStudentEmail,
          studentName: cleanFullName,
        },
      }),
    };
  } catch (error) {
    if (error.message === "DOUBLE_BOOKING") {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: "This consultation slot has just been reserved by another student. Please choose a different time or counselor.",
        }),
      };
    }

    console.error("Booking error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to process appointment." }),
    };
  }
};
