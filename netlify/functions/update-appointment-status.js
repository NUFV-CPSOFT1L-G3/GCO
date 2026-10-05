const { getDb } = require("./utils/firebase-admin");
const { sendAppointmentCancellation, sendFeedbackInvitation } = require("./utils/email");

const VALID_STATUSES = ["completed", "no-show", "cancelled"];
const VALID_CANCELLATION_REASONS = [
  "Student Requested Cancellation",
  "Counselor Unavailable",
  "Office Closure or Holiday",
  "Emergency",
  "Others with remarks",
];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST" && event.httpMethod !== "PATCH") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed. Use POST." }) };
  }

  try {
    const { appointmentId, status, cancellationReason, cancellationRemarks } = JSON.parse(
      event.body || "{}"
    );

    if (!appointmentId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Appointment ID is required." }) };
    }

    const normalizedStatus = String(status || "").toLowerCase().trim();
    if (!VALID_STATUSES.includes(normalizedStatus)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }),
      };
    }

    if (normalizedStatus === "cancelled") {
      if (!cancellationReason || !VALID_CANCELLATION_REASONS.includes(cancellationReason)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: `A valid cancellation reason is required: ${VALID_CANCELLATION_REASONS.join("; ")}`,
          }),
        };
      }
    }

    const db = getDb();
    const apptRef = db.collection("appointments").doc(appointmentId);
    const apptDoc = await apptRef.get();

    if (!apptDoc.exists) {
      return { statusCode: 404, body: JSON.stringify({ error: "Appointment not found." }) };
    }

    const apptData = apptDoc.data();
    
    // No-Show will only appear after the scheduled appointment ends
    if (normalizedStatus === "no-show") {
      const endTime = apptData.endTime || apptData.startTime;
      const apptEnd = new Date(`${apptData.date}T${endTime}:00`);
      if (isNaN(apptEnd.getTime())) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Appointment schedule is invalid; cannot determine No-Show eligibility." }),
        };
      }
      if (apptEnd.getTime() > Date.now()) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "You can only mark an appointment as No-Show after the scheduled appointment has ended." }),
        };
      }
    }
    
    // Prepare update data
    const updateData = {
      status: normalizedStatus,
      updatedAt: new Date().toISOString(),
    };

    if (normalizedStatus === "cancelled") {
      updateData.cancellationReason = cancellationReason;
      updateData.cancellationRemarks = cancellationRemarks ? cancellationRemarks.trim() : "";
      // Unlink active slot key so the counselor slot can be re-booked if applicable
      updateData.slotKey = `CANCELLED_${apptData.slotKey}`;
    }

    await apptRef.update(updateData);

    // If marked Completed, increment counselor completed counter and send feedback invitation
    if (normalizedStatus === "completed") {
      if (apptData.counselorId) {
        const counselorRef = db.collection("counselors").doc(apptData.counselorId);
        const counselorDoc = await counselorRef.get();
        if (counselorDoc.exists) {
          const currentCompleted = counselorDoc.data().sessionsCompleted || 0;
          await counselorRef.update({ sessionsCompleted: currentCompleted + 1 });
        }
      }

      // Dispatch post-consultation satisfaction survey email
      await sendFeedbackInvitation({
        studentEmail: apptData.studentEmail,
        studentName: apptData.studentName,
        confirmationNumber: apptData.confirmationNumber,
        counselorName: apptData.counselorName,
        appointmentId,
      });
    }

    // If marked Cancelled, dispatch cancellation notice email
    if (normalizedStatus === "cancelled") {
      await sendAppointmentCancellation({
        studentEmail: apptData.studentEmail,
        studentName: apptData.studentName,
        confirmationNumber: apptData.confirmationNumber,
        counselorName: apptData.counselorName,
        date: apptData.date,
        startTime: apptData.startTime,
        reason: cancellationReason,
        remarks: cancellationRemarks,
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        appointmentId,
        status: normalizedStatus,
      }),
    };
  } catch (error) {
    console.error("Status update error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Failed to update appointment status." }),
    };
  }
};
