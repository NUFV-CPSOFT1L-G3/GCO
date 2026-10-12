const { sendEmail } = require("./utils/email");

exports.handler = async (event) => {
  const to = event.queryStringParameters?.to || process.env.SMTP_USER || "nufvgcounsel@gmail.com";

  const diagnostics = {
    env: {
      hasUser: !!process.env.SMTP_USER,
      user: process.env.SMTP_USER ? process.env.SMTP_USER.replace(/(?<=.{3}).(?=.*@)/g, "*") : null,
      hasPass: !!process.env.SMTP_PASS,
      passLength: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
      host: process.env.SMTP_HOST || "default",
      port: process.env.SMTP_PORT || "default",
      from: process.env.FROM_EMAIL || "default",
    },
    targetRecipient: to,
  };

  try {
    const result = await sendEmail({
      to,
      subject: "[GCOunsel Diagnostic] Live Email Test",
      text: "This is a diagnostic test email from the live GCOunsel deployment. If you received this, Gmail SMTP is working 100%!",
      html: "<p>This is a diagnostic test email from the live GCOunsel deployment.</p><p><strong>Status:</strong> Gmail SMTP is working 100%!</p>",
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnostics, result }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnostics, error: error.message, stack: error.stack }),
    };
  }
};
