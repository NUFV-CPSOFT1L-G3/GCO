const { getDb, getAuth } = require("./utils/firebase-admin");

exports.handler = async (event) => {
  const db = getDb();
  const auth = getAuth();

  // 1. GET: List all counselors & their metrics
  if (event.httpMethod === "GET") {
    try {
      const snapshot = await db.collection("counselors").get();
      const counselors = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        counselors.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          title: data.title,
          role: data.role || "counselor",
          credentials: data.credentials || "",
          preferredAreas: data.preferredAreas || [],
          sessionsHandled: data.sessionsHandled || 0,
          sessionsCompleted: data.sessionsCompleted || 0,
          weeklyHours: data.weeklyHours || [],
          blockedDates: data.blockedDates || [],
        });
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(counselors),
      };
    } catch (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  // 2. POST: Create a new counselor account (Auth + Firestore)
  if (event.httpMethod === "POST") {
    try {
      const { name, email, password, title, credentials, preferredAreas } = JSON.parse(
        event.body || "{}"
      );

      if (!name || !email || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: "Name, email, and password are required." }) };
      }

      if (password.length < 6) {
        return { statusCode: 400, body: JSON.stringify({ error: "Password must be at least 6 characters." }) };
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Create in Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email: normalizedEmail,
          password,
          displayName: name.trim(),
        });
      } catch (authError) {
        return { statusCode: 400, body: JSON.stringify({ error: authError.message }) };
      }

      const defaultWeeklyHours = [
        { dayOfWeek: 0, isActive: false, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 1, isActive: true, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 2, isActive: true, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 3, isActive: true, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 4, isActive: true, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 5, isActive: true, startTime: "08:00", endTime: "17:00" },
        { dayOfWeek: 6, isActive: false, startTime: "08:00", endTime: "12:00" },
      ];

      const counselorProfile = {
        id: userRecord.uid,
        name: name.trim(),
        email: normalizedEmail,
        title: (title || "Guidance Counselor").trim(),
        credentials: credentials ? credentials.trim() : "RGC",
        role: "counselor",
        preferredAreas: Array.isArray(preferredAreas) && preferredAreas.length
          ? preferredAreas
          : ["Academic", "Career", "Personal", "Family", "Social", "Mental Wellness"],
        sessionsHandled: 0,
        sessionsCompleted: 0,
        defaultDurationMinutes: 30,
        weeklyHours: defaultWeeklyHours,
        blockedDates: [],
        createdAt: new Date().toISOString(),
      };

      await db.collection("counselors").doc(userRecord.uid).set(counselorProfile);

      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, counselor: counselorProfile }),
      };
    } catch (error) {
      console.error("Error creating counselor:", error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
};
