const { getAuth, getDb } = require("./utils/firebase-admin");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  try {
    const { startDate, endDate, month, year, counselorId: requestedCounselorId } = event.queryStringParameters || {};
    const authorization = event.headers && (event.headers.authorization || event.headers.Authorization);
    let userId = "";
    let role = "";

    if (!process.env.NETLIFY && !process.env.AWS_LAMBDA_FUNCTION_NAME && requestedCounselorId) {
      userId = requestedCounselorId;
    } else if (authorization && authorization.startsWith("Bearer ")) {
      const decodedToken = await getAuth().verifyIdToken(authorization.slice(7));
      userId = decodedToken.uid;
      const profile = await getDb().collection("counselors").doc(userId).get();
      if (profile.exists) role = profile.data().role || "counselor";
    } else {
      return { statusCode: 401, body: JSON.stringify({ error: "Authentication is required." }) };
    }

    if (role !== "admin" && requestedCounselorId && requestedCounselorId !== userId) {
      return { statusCode: 403, body: JSON.stringify({ error: "You may only view your own appointments." }) };
    }

    const db = getDb();
    const snapshot = await db.collection("appointments").get();
    const appointments = [];

    snapshot.forEach((doc) => {
      const appointment = { id: doc.id, ...doc.data() };
      if (role !== "admin" && appointment.counselorId !== userId) return;
      if (startDate && appointment.date < startDate) return;
      if (endDate && appointment.date > endDate) return;
      if (month && year && appointment.date) {
        const [appointmentYear, appointmentMonth] = appointment.date.split("-");
        if (appointmentYear !== year || appointmentMonth !== month.padStart(2, "0")) return;
      }
      appointments.push(appointment);
    });

    appointments.sort((a, b) => {
      const dateOrder = (a.date || "").localeCompare(b.date || "");
      return dateOrder || (a.startTime || "").localeCompare(b.startTime || "");
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointments }),
    };
  } catch (error) {
    console.error("Counselor stats error:", error);
    return { statusCode: 401, body: JSON.stringify({ error: "Could not authenticate or load appointments." }) };
  }
};