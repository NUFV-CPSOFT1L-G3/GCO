const nodemailer = require("nodemailer");

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : null;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, "") : null;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (user && pass) {
    // Direct Gmail optimization
    if ((host && host.includes("gmail")) || user.endsWith("@gmail.com")) {
      return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }

    if (host) {
      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
  }

  // Graceful fallback when SMTP credentials are not configured yet
  return null;
}

const DEFAULT_FROM = process.env.FROM_EMAIL || '"NU Fairview Guidance Counseling Office" <nufvgcounsel@gmail.com>';

async function sendEmail({ to, bcc, subject, html, text }) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log("==================== [MOCK EMAIL DISPATCH] ====================");
    console.log(`To:      ${to}`);
    if (bcc) console.log(`Bcc:     ${bcc}`);
    console.log(`Subject: ${subject}`);
    console.log(`Content:\n${text || html}`);
    console.log("================================================================");
    return { success: true, mocked: true };
  }

  try {
    const mailOptions = {
      from: DEFAULT_FROM,
      to,
      subject,
      text,
      html,
    };
    if (bcc) {
      mailOptions.bcc = bcc;
    }

    const info = await transporter.sendMail(mailOptions);
    console.log(`Email dispatched to ${to} (Bcc: ${bcc || "none"}): ${info.messageId}`);
    return { success: true, messageId: info.messageId, recipient: to, bcc: bcc || null };
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends Appointment Confirmation Email with Consultation Guidelines
 * Automatically copies (BCCs) the office email so staff inbox receives an instant booking record
 */
async function sendAppointmentConfirmation({
  studentEmail,
  studentName,
  confirmationNumber,
  counselorName,
  date,
  startTime,
  endTime,
  categories,
}) {
  const formattedCategories = Array.isArray(categories) ? categories.join(", ") : categories;
  const subject = `[GCOunsel] Appointment Confirmed - ${confirmationNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #262626; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; border: 1px solid #dcdcdc; border-radius: 8px; overflow: hidden; }
        .header { background-color: #1f1f1f; color: #ffffff; padding: 24px; text-align: center; border-bottom: 4px solid #d2a72e; }
        .header h1 { margin: 0; font-size: 22px; }
        .header p { margin: 4px 0 0; font-size: 13px; color: #d2a72e; }
        .content { padding: 24px; background: #ffffff; }
        .conf-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 6px; padding: 18px; margin: 20px 0; text-align: center; }
        .conf-label { font-size: 12px; text-transform: uppercase; color: #737373; font-weight: 600; letter-spacing: 0.5px; }
        .conf-num { font-size: 24px; font-weight: 800; color: #1f1f1f; margin: 6px 0; letter-spacing: 1px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
        .details-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
        .details-table td.label { width: 35%; color: #737373; font-weight: 600; }
        .guidelines { background: #fff9e6; border-left: 4px solid #d2a72e; padding: 16px; margin-top: 24px; border-radius: 0 6px 6px 0; }
        .guidelines h3 { margin-top: 0; font-size: 14px; color: #785a00; }
        .guidelines ul { margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #5a4300; }
        .guidelines li { margin-bottom: 6px; }
        .footer { background: #f5f5f5; padding: 16px; text-align: center; font-size: 11px; color: #737373; border-top: 1px solid #ebebeb; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>National University – Fairview</h1>
          <p>Guidance Counseling Office · GCOunsel</p>
        </div>
        <div class="content">
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>Your guidance counseling appointment has been successfully scheduled. Please review your appointment details below:</p>
          
          <div class="conf-box">
            <div class="conf-label">Confirmation Number</div>
            <div class="conf-num">${confirmationNumber}</div>
          </div>

          <table class="details-table">
            <tr>
              <td class="label">Guidance Counselor</td>
              <td><strong>${counselorName}</strong></td>
            </tr>
            <tr>
              <td class="label">Consultation Date</td>
              <td>${date}</td>
            </tr>
            <tr>
              <td class="label">Time</td>
              <td>${startTime} – ${endTime}</td>
            </tr>
            <tr>
              <td class="label">Reason / Category</td>
              <td>${formattedCategories}</td>
            </tr>
          </table>

          <div class="guidelines">
            <h3>Consultation Guidelines & Reminders</h3>
            <ul>
              <li><strong>Punctuality:</strong> Please arrive at the Guidance Counseling Office (GCO) at least 5–10 minutes prior to your scheduled time.</li>
              <li><strong>Identification:</strong> Present your valid NU Fairview Student Identification Card upon arrival.</li>
              <li><strong>Rescheduling & Cancellation:</strong> If you cannot attend your session, please notify the Guidance Office promptly so the slot can be made available to other students.</li>
              <li><strong>Confidentiality:</strong> In compliance with the Philippine Guidance and Counseling Act of 2004 (RA 9258) and Data Privacy Act of 2012 (RA 10173), all matters discussed during your consultation remain strictly private and confidential.</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          This is an automated notification from the GCOunsel System · National University – Fairview<br>
          For urgent concerns, please visit the Guidance Counseling Office in person.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Appointment Confirmed - ${confirmationNumber}

Dear ${studentName},
Your guidance counseling appointment with ${counselorName} has been confirmed.

Confirmation Number: ${confirmationNumber}
Date: ${date}
Time: ${startTime} - ${endTime}
Reason(s): ${formattedCategories}

Guidelines:
- Please arrive at the GCO 5-10 minutes prior to your appointment.
- Bring your NU Fairview Student ID.
- Sessions are strictly confidential under RA 9258 and RA 10173.
  `.trim();

  const officeEmail = process.env.SMTP_USER || "nufvgcounsel@gmail.com";
  const bcc = officeEmail.toLowerCase() !== studentEmail.toLowerCase() ? officeEmail : undefined;

  return sendEmail({ to: studentEmail, bcc, subject, html, text });
}

/**
 * Sends Appointment Cancellation Email
 */
async function sendAppointmentCancellation({
  studentEmail,
  studentName,
  confirmationNumber,
  counselorName,
  date,
  startTime,
  reason,
  remarks,
}) {
  const subject = `[GCOunsel] Notice of Cancellation - ${confirmationNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #262626; }
        .container { max-width: 600px; margin: 20px auto; border: 1px solid #dcdcdc; border-radius: 8px; overflow: hidden; }
        .header { background-color: #1f1f1f; color: #ffffff; padding: 20px; text-align: center; border-bottom: 4px solid #b3261e; }
        .content { padding: 24px; background: #ffffff; }
        .alert-box { background: #fdf2f2; border-left: 4px solid #b3261e; padding: 14px; margin: 16px 0; font-size: 14px; }
        .footer { background: #f5f5f5; padding: 16px; text-align: center; font-size: 11px; color: #737373; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin:0;">Appointment Cancellation Notice</h2>
        </div>
        <div class="content">
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>We regret to inform you that your guidance counseling appointment (<strong>${confirmationNumber}</strong>) originally scheduled for <strong>${date}</strong> at <strong>${startTime}</strong> with <strong>${counselorName}</strong> has been cancelled.</p>
          
          <div class="alert-box">
            <strong>Reason for Cancellation:</strong><br>
            ${reason}${remarks ? `<br><em>Remarks: ${remarks}</em>` : ""}
          </div>

          <p>If you would like to reschedule, please visit the <a href="https://nufairview-guidance.cordanya.com">GCOunsel Portal</a> to select a new available time slot.</p>
        </div>
        <div class="footer">
          Guidance Counseling Office · National University – Fairview
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Notice of Cancellation - ${confirmationNumber}

Dear ${studentName},
Your appointment (${confirmationNumber}) on ${date} at ${startTime} has been cancelled.
Reason: ${reason}${remarks ? ` (${remarks})` : ""}

You may schedule a new consultation on GCOunsel at your convenience.
  `.trim();

  const officeEmail = process.env.SMTP_USER || "nufvgcounsel@gmail.com";
  const bcc = officeEmail.toLowerCase() !== studentEmail.toLowerCase() ? officeEmail : undefined;

  return sendEmail({ to: studentEmail, bcc, subject, html, text });
}

/**
 * Sends Post-Consultation Satisfaction Survey Email
 */
async function sendFeedbackInvitation({
  studentEmail,
  studentName,
  confirmationNumber,
  counselorName,
  appointmentId,
}) {
  const baseUrl = process.env.APP_BASE_URL || "https://nufairview-guidance.cordanya.com";
  const feedbackUrl = `${baseUrl}/feedback.html?appointmentId=${encodeURIComponent(appointmentId)}`;
  const subject = `[GCOunsel] Student Satisfaction Survey - ${confirmationNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #262626; }
        .container { max-width: 600px; margin: 20px auto; border: 1px solid #dcdcdc; border-radius: 8px; overflow: hidden; }
        .header { background-color: #1f1f1f; color: #ffffff; padding: 24px; text-align: center; border-bottom: 4px solid #d2a72e; }
        .content { padding: 24px; background: #ffffff; text-align: center; }
        .btn { display: inline-block; background-color: #262626; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin: 20px 0; font-size: 14px; }
        .footer { background: #f5f5f5; padding: 16px; text-align: center; font-size: 11px; color: #737373; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin:0;">How was your consultation?</h2>
        </div>
        <div class="content">
          <p>Dear <strong>${studentName}</strong>,</p>
          <p>Thank you for attending your counseling session with <strong>${counselorName}</strong> (Appointment: <strong>${confirmationNumber}</strong>).</p>
          <p>To help us continuously enhance the guidance counseling services at National University – Fairview, please take a moment to answer our brief satisfaction survey.</p>
          
          <a href="${feedbackUrl}" class="btn">Complete Satisfaction Survey</a>

          <p style="font-size:12px; color:#737373;">If the button above does not work, copy and paste this link into your browser:<br>${feedbackUrl}</p>
        </div>
        <div class="footer">
          Guidance Counseling Office · National University – Fairview
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Student Satisfaction Survey - ${confirmationNumber}

Dear ${studentName},
Thank you for attending your counseling session with ${counselorName}.
Please take a moment to complete our brief satisfaction survey:
${feedbackUrl}
  `.trim();

  return sendEmail({ to: studentEmail, subject, html, text });
}

/**
 * Sends New Consultation Booking Notification directly to the Assigned Guidance Counselor
 */
async function sendCounselorBookingNotification({
  counselorEmail,
  counselorName,
  studentName,
  studentId,
  studentEmail,
  course,
  confirmationNumber,
  date,
  startTime,
  endTime,
  categories,
}) {
  if (!counselorEmail) return { success: false, error: "No counselor email" };

  const formattedCategories = Array.isArray(categories) ? categories.join(", ") : categories;
  const subject = `[GCOunsel] New Consultation Booked - ${confirmationNumber} (${studentName})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #262626; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 20px auto; border: 1px solid #dcdcdc; border-radius: 8px; overflow: hidden; }
        .header { background-color: #1f1f1f; color: #ffffff; padding: 22px; text-align: center; border-bottom: 4px solid #d2a72e; }
        .header h1 { margin: 0; font-size: 20px; }
        .content { padding: 24px; background: #ffffff; }
        .tag-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px; margin: 16px 0; color: #166534; font-weight: 700; text-align: center; font-size: 16px; }
        .details-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
        .details-table td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
        .details-table td.label { width: 35%; color: #737373; font-weight: 600; }
        .footer { background: #f5f5f5; padding: 14px; text-align: center; font-size: 11px; color: #737373; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>National University – Fairview</h1>
          <p style="color:#d2a72e; margin:4px 0 0; font-size:12px;">Guidance Counseling Office · Staff Notification</p>
        </div>
        <div class="content">
          <p>Dear <strong>${counselorName}</strong>,</p>
          <p>A student has reserved a consultation slot on your schedule:</p>

          <div class="tag-box">
            Confirmation Number: ${confirmationNumber}
          </div>

          <table class="details-table">
            <tr>
              <td class="label">Student Name</td>
              <td><strong>${studentName}</strong></td>
            </tr>
            <tr>
              <td class="label">Student ID</td>
              <td><code>${studentId}</code></td>
            </tr>
            <tr>
              <td class="label">Course / Program</td>
              <td>${course || "N/A"}</td>
            </tr>
            <tr>
              <td class="label">Student Email</td>
              <td><a href="mailto:${studentEmail}">${studentEmail}</a></td>
            </tr>
            <tr>
              <td class="label">Consultation Date</td>
              <td><strong>${date}</strong></td>
            </tr>
            <tr>
              <td class="label">Time Slot</td>
              <td><strong>${startTime} – ${endTime}</strong></td>
            </tr>
            <tr>
              <td class="label">Reason(s)</td>
              <td>${formattedCategories}</td>
            </tr>
          </table>

          <p style="margin-top:20px; font-size:13px; color:#555;">
            You can review, manage, or reschedule this session anytime via the <a href="https://nufairview-guidance.cordanya.com/dashboard.html">Counselor Portal</a>.
          </p>
        </div>
        <div class="footer">
          GCOunsel Automated Notification · NU Fairview Guidance Counseling Office
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New Consultation Booked - ${confirmationNumber}

Dear ${counselorName},
A student has booked a consultation slot on your schedule:

Confirmation: ${confirmationNumber}
Student Name: ${studentName} (${studentId})
Course: ${course}
Student Email: ${studentEmail}
Date: ${date}
Time: ${startTime} - ${endTime}
Reason(s): ${formattedCategories}

Manage this appointment on the Counselor Portal: https://nufairview-guidance.cordanya.com/dashboard.html
  `.trim();

  return sendEmail({ to: counselorEmail, subject, html, text });
}

module.exports = {
  sendEmail,
  sendAppointmentConfirmation,
  sendAppointmentCancellation,
  sendFeedbackInvitation,
  sendCounselorBookingNotification,
};
