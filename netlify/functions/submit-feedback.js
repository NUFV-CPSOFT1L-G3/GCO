const { getDb } = require("./utils/firebase-admin");

exports.handler = async (event) => {
  const db = getDb();

  // GET: Fetch appointment details for feedback verification
  if (event.httpMethod === "GET") {
    const appointmentId = event.queryStringParameters && event.queryStringParameters.appointmentId;
    if (!appointmentId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing appointment ID." }) };
    }

    try {
      const apptDoc = await db.collection("appointments").doc(appointmentId).get();
      if (!apptDoc.exists) {
        return { statusCode: 404, body: JSON.stringify({ error: "Appointment not found." }) };
      }

      const data = apptDoc.data();
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId,
          counselorName: data.counselorName,
          counselorId: data.counselorId,
          confirmationNumber: data.confirmationNumber,
          date: data.date,
          status: data.status,
          hasFeedback: Boolean(data.hasFeedback),
        }),
      };
    } catch (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
  }

  // POST: Submit survey response
  if (event.httpMethod === "POST") {
    try {
      const { appointmentId, rating, appreciated, comments } = JSON.parse(event.body || "{}");

      if (!appointmentId) {
        return { statusCode: 400, body: JSON.stringify({ error: "Appointment ID is required." }) };
      }

      const numericRating = Number(rating);
      if (!numericRating || numericRating < 1 || numericRating > 5) {
        return { statusCode: 400, body: JSON.stringify({ error: "Please provide an overall rating from 1 to 5 stars." }) };
      }

      const apptRef = db.collection("appointments").doc(appointmentId);
      const apptDoc = await apptRef.get();

      if (!apptDoc.exists) {
        return { statusCode: 404, body: JSON.stringify({ error: "Appointment not found." }) };
      }

      const apptData = apptDoc.data();

      // Only completed appointments can receive feedback
      if (apptData.status !== "completed") {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Feedback can only be submitted for completed counseling sessions." }),
        };
      }

      // One feedback per completed appointment
      if (apptData.hasFeedback) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: "Feedback has already been submitted for this consultation." }),
        };
      }

      const feedbackRef = db.collection("feedback").doc();
      const feedbackRecord = {
        id: feedbackRef.id,
        appointmentId,
        confirmationNumber: apptData.confirmationNumber,
        counselorId: apptData.counselorId,
        counselorName: apptData.counselorName,
        studentName: apptData.studentName,
        course: apptData.course,
        categories: apptData.categories || [],
        rating: numericRating,
        appreciated: Array.isArray(appreciated) ? appreciated : [],
        comments: comments ? comments.trim() : "",
        createdAt: new Date().toISOString(),
      };

      await db.runTransaction(async (transaction) => {
        transaction.set(feedbackRef, feedbackRecord);
        transaction.update(apptRef, {
          hasFeedback: true,
          feedbackId: feedbackRef.id,
          updatedAt: new Date().toISOString(),
        });
      });

      return {
        statusCode: 201,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, message: "Thank you! Your feedback has been recorded." }),
      };
    } catch (error) {
      console.error("Feedback error:", error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message || "Failed to record feedback." }) };
    }
  }

  return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
};
