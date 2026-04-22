const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.ethereal.email",
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

const FROM = process.env.EMAIL_FROM || "Yor Talks <noreply@yortalks.com>";
const APP_URL = process.env.CLIENT_URL || "http://localhost:5173";

const emailTemplate = (title, body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #f09433, #dc2743, #bc1888); padding: 32px 28px; text-align: center; }
    .logo { font-size: 32px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .body { padding: 32px 28px; }
    h2 { margin: 0 0 12px; font-size: 22px; color: #111; }
    p { margin: 0 0 16px; color: #555; line-height: 1.6; font-size: 15px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #f09433, #dc2743); color: #fff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .footer { padding: 20px 28px; border-top: 1px solid #eee; text-align: center; color: #aaa; font-size: 13px; }
    .code { font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111; text-align: center; padding: 20px; background: #f9f9f9; border-radius: 8px; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><div class="logo">Yor Talks</div></div>
    <div class="body">${body}</div>
    <div class="footer">© ${new Date().getFullYear()} Yor Talks · <a href="${APP_URL}" style="color:#aaa">Visit app</a></div>
  </div>
</body>
</html>
`;

const send = async (to, subject, html) => {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] To: ${to} | Subject: ${subject}`);
    return { messageId: "dev-mode" };
  }
  const info = await transporter.sendMail({ from: FROM, to, subject, html });
  return info;
};

module.exports = {
  sendVerification: (to, name, token) => send(to, "Verify your Yor Talks email",
    emailTemplate("Verify Email", `
      <h2>Hi ${name}, welcome to Yor Talks!</h2>
      <p>Please verify your email to unlock all features.</p>
      <a class="btn" href="${APP_URL}/verify-email?token=${token}">Verify Email</a>
      <p style="font-size:13px;color:#aaa;margin-top:16px">This link expires in 24 hours.</p>
    `)
  ),

  sendPasswordReset: (to, name, token) => send(to, "Reset your Yor Talks password",
    emailTemplate("Password Reset", `
      <h2>Reset your password</h2>
      <p>Hi ${name}, someone requested a password reset for your account.</p>
      <a class="btn" href="${APP_URL}/reset-password?token=${token}">Reset Password</a>
      <p style="font-size:13px;color:#aaa;margin-top:16px">If you didn't request this, you can safely ignore this email. Link expires in 1 hour.</p>
    `)
  ),

  sendLoginAlert: (to, name, device, ip) => send(to, "New login to your Yor Talks account",
    emailTemplate("Login Alert", `
      <h2>New login detected</h2>
      <p>Hi ${name}, a new login was detected on your account.</p>
      <p><strong>Device:</strong> ${device}<br><strong>IP:</strong> ${ip}<br><strong>Time:</strong> ${new Date().toUTCString()}</p>
      <p>If this wasn't you, please change your password immediately.</p>
      <a class="btn" href="${APP_URL}/settings/security">Secure Account</a>
    `)
  ),

  sendWelcome: (to, name) => send(to, "Welcome to Yor Talks! 🎉",
    emailTemplate("Welcome", `
      <h2>Welcome to Yor Talks, ${name}! 🎉</h2>
      <p>You're now part of a community of creators and explorers. Start sharing your world!</p>
      <a class="btn" href="${APP_URL}">Open Yor Talks</a>
    `)
  ),
};
