const { getDb, getAuth } = require("./utils/firebase-admin");

exports.handler = async (event) => {
  const db = getDb();
  const auth = getAuth();

  // 1. GET: List all counselors & their metrics (Deduplicated)
  if (event.httpMethod === "GET") {
    try {
      const snapshot = await db.collection("counselors").get();
      const rawCounselors = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        rawCounselors.push({
          id: doc.id,
          name: data.name,
          email: data.email,
          title: data.title,
          role: data.role || "counselor",
          status: data.status || "active",
          credentials: data.credentials || "",
          preferredAreas: data.preferredAreas || ["Academic", "Career", "Personal", "Mental Wellness"],
          sessionsHandled: data.sessionsHandled || 0,
          sessionsCompleted: data.sessionsCompleted || 0,
          weeklyHours: data.weeklyHours || [],
          blockedDates: data.blockedDates || [],
          createdAt: data.createdAt || "",
        });
      });

      // Strict in-memory deduplication by email
      const counselors = [];
      const seenEmails = new Set();
      for (const c of rawCounselors) {
        const normEmail = (c.email || "").toLowerCase().trim();
        if (!normEmail) {
          counselors.push(c);
          continue;
        }
        if (seenEmails.has(normEmail)) {
          const existingIndex = counselors.findIndex(
            (item) => (item.email || "").toLowerCase().trim() === normEmail
          );
          if (existingIndex >= 0) {
            const existing = counselors[existingIndex];
            if (
              (c.sessionsHandled || 0) > (existing.sessionsHandled || 0) ||
              (!c.id.startsWith("counselor_") && existing.id.startsWith("counselor_"))
            ) {
              counselors[existingIndex] = c;
            }
          }
          continue;
        }
        seenEmails.add(normEmail);
        counselors.push(c);
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(counselors),
      };
    } catch (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  // 2. POST: Create a new counselor or admin staff account (Auth + Firestore)
  if (event.httpMethod === "POST") {
    try {
      const { name, email, password, title, credentials, preferredAreas, role } = JSON.parse(
        event.body || "{}"
      );

      if (!name || !email || !password) {
        return { statusCode: 400, body: JSON.stringify({ error: "Name, email, and password are required." }) };
      }

      if (password.length < 6) {
        return { statusCode: 400, body: JSON.stringify({ error: "Password must be at least 6 characters." }) };
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check if counselor already exists in Firestore by email
      try {
        const existingEmailDocs = await db
          .collection("counselors")
          .where("email", "==", normalizedEmail)
          .get();

        if (!existingEmailDocs.empty) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "An account with this email address already exists." }),
          };
        }
      } catch (queryErr) {
        // Continue if where query unsupported by mock
      }

      // Create in Firebase Auth
      let userRecord;
      try {
        userRecord = await auth.createUser({
          email: normalizedEmail,
          password,
          displayName: name.trim(),
        });
      } catch (authError) {
        // If user already exists in Auth, handle gracefully
        if (authError.code === "auth/email-already-exists") {
          return { statusCode: 400, body: JSON.stringify({ error: "An account with this email address already exists." }) };
        }
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

      const staffRole = role === "admin" ? "admin" : "counselor";
      const counselorProfile = {
        id: userRecord.uid,
        name: name.trim(),
        email: normalizedEmail,
        title: (title || (staffRole === "admin" ? "GCO Administrator" : "Guidance Counselor")).trim(),
        credentials: credentials ? credentials.trim() : "RGC",
        role: staffRole,
        status: "active",
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

      // Self-healing cleanup: delete any orphaned legacy documents with the same email
      try {
        const cleanupSnap = await db.collection("counselors").where("email", "==", normalizedEmail).get();
        cleanupSnap.forEach(async (doc) => {
          if (doc.id !== userRecord.uid) {
            await db.collection("counselors").doc(doc.id).delete();
          }
        });
      } catch (cleanupErr) {}

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

  // 3. DELETE: Remove counselor account (Auth + Firestore)
  if (event.httpMethod === "DELETE") {
    try {
      const { counselorId, currentUserId, currentUserEmail } = JSON.parse(event.body || "{}");
      if (!counselorId) {
        return { statusCode: 400, body: JSON.stringify({ error: "counselorId is required." }) };
      }

      // Self-removal protection by ID
      if (currentUserId && counselorId === currentUserId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "You cannot remove your own active administrator account." }),
        };
      }

      // Root administrator & self-removal protection by email
      let targetEmail = "";
      const counselorDoc = await db.collection("counselors").doc(counselorId).get();
      if (counselorDoc.exists) {
        const data = counselorDoc.data();
        targetEmail = (data.email || "").toLowerCase().trim();
        if (
          targetEmail === "kylecarandang.work@gmail.com" ||
          targetEmail === "kyle.carandang@nu-fairview.edu.ph"
        ) {
          return {
            statusCode: 403,
            body: JSON.stringify({ error: "Cannot delete primary root administrator account." }),
          };
        }
        if (currentUserEmail && targetEmail === currentUserEmail.toLowerCase().trim()) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: "You cannot remove your own active administrator account." }),
          };
        }
      }

      // Delete target doc
      await db.collection("counselors").doc(counselorId).delete();

      // If email exists, delete ANY duplicate docs in Firestore with this email
      if (targetEmail) {
        try {
          const matchingDocs = await db.collection("counselors").where("email", "==", targetEmail).get();
          matchingDocs.forEach(async (doc) => {
            await db.collection("counselors").doc(doc.id).delete();
          });
        } catch (delErr) {}
      }

      // Delete from Firebase Auth
      let deletedFromAuth = false;
      try {
        await auth.deleteUser(counselorId);
        deletedFromAuth = true;
      } catch (authErr) {
        // counselorId might not be the Auth UID
      }

      if (!deletedFromAuth && targetEmail && typeof auth.getUserByEmail === "function") {
        try {
          const authUser = await auth.getUserByEmail(targetEmail);
          if (authUser && authUser.uid) {
            await auth.deleteUser(authUser.uid);
          }
        } catch (e) {}
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, message: "Counselor account removed successfully." }),
      };
    } catch (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  // 4. PATCH: Update counselor details or toggle active status
  if (event.httpMethod === "PATCH" || event.httpMethod === "PUT") {
    try {
      const { counselorId, updates } = JSON.parse(event.body || "{}");
      if (!counselorId || !updates) {
        return { statusCode: 400, body: JSON.stringify({ error: "counselorId and updates are required." }) };
      }

      await db.collection("counselors").doc(counselorId).set(updates, { merge: true });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, message: "Counselor account updated successfully." }),
      };
    } catch (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
};
