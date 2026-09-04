const { getDb } = require("./utils/firebase-admin");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  const { month, year } = event.queryStringParameters || {};
  const db = getDb();

  try {
    // 1. Fetch appointments
    let apptQuery = db.collection("appointments");
    const apptsSnapshot = await apptQuery.get();

    let total = 0;
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let confirmed = 0;

    const categoryCounts = {};
    const courseCounts = {};
    const counselorStats = {};
    const allAppointments = [];

    apptsSnapshot.forEach((doc) => {
      const a = doc.data();

      // Optional month/year filter
      if (month && year && a.date) {
        const [aYear, aMonth] = a.date.split("-");
        if (aYear !== year || aMonth !== month.padStart(2, "0")) {
          return;
        }
      }

      total++;
      if (a.status === "completed") completed++;
      else if (a.status === "cancelled") cancelled++;
      else if (a.status === "no-show") noShow++;
      else if (a.status === "confirmed") confirmed++;

      // Category breakdown
      if (Array.isArray(a.categories)) {
        a.categories.forEach((cat) => {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });
      }

      // Course breakdown
      if (a.course) {
        courseCounts[a.course] = (courseCounts[a.course] || 0) + 1;
      }

      // Counselor breakdown
      const cName = a.counselorName || "Unknown Counselor";
      if (!counselorStats[cName]) {
        counselorStats[cName] = { total: 0, completed: 0, noShow: 0, cancelled: 0 };
      }
      counselorStats[cName].total++;
      if (a.status === "completed") counselorStats[cName].completed++;
      if (a.status === "no-show") counselorStats[cName].noShow++;
      if (a.status === "cancelled") counselorStats[cName].cancelled++;

      allAppointments.push(a);
    });

    // 2. Fetch feedback
    const feedbackSnapshot = await db.collection("feedback").get();
    let ratingSum = 0;
    let ratingCount = 0;
    const recentFeedback = [];

    feedbackSnapshot.forEach((doc) => {
      const f = doc.data();
      if (f.rating) {
        ratingSum += Number(f.rating);
        ratingCount++;
      }
      recentFeedback.push(f);
    });

    // Sort recent feedback descending
    recentFeedback.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    // Sort appointments descending by date
    allAppointments.sort((a, b) => {
      const cmp = (b.date || "").localeCompare(a.date || "");
      if (cmp !== 0) return cmp;
      return (b.startTime || "").localeCompare(a.startTime || "");
    });

    const averageRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : "0.0";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: {
          total,
          completed,
          cancelled,
          noShow,
          confirmed,
          averageRating: Number(averageRating),
          feedbackCount: ratingCount,
        },
        categories: categoryCounts,
        courses: courseCounts,
        counselors: counselorStats,
        recentFeedback: recentFeedback.slice(0, 10),
        appointments: allAppointments,
      }),
    };
  } catch (error) {
    console.error("Admin stats error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
