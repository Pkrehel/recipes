const nodemailer = require("nodemailer");
const { SITE } = require("./seo");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    // No SMTP configured: log emails to the console instead of failing. Useful for local dev.
    transporter = nodemailer.createTransport({ jsonTransport: true });
    transporter.__console = true;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
  return transporter;
}

async function send({ to, subject, text, html }) {
  const t = getTransporter();
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || `no-reply@example.com`;
  const info = await t.sendMail({ from: `"${SITE.name}" <${from}>`, to, subject, text, html });
  if (t.__console) console.log("[mail:console]", JSON.stringify(JSON.parse(info.message), null, 2));
  return info;
}

function baseUrl(req) {
  return SITE.url && !SITE.url.includes("localhost") ? SITE.url : `${req.protocol}://${req.get("host")}`;
}

async function sendVerificationEmail(req, user) {
  const link = `${baseUrl(req)}/verify/${user.verificationToken}`;
  return send({
    to: user.username,
    subject: `Confirm your ${SITE.name} account`,
    text: `Hi ${user.firstName},\n\nBefore you can share recipes, please verify your email by opening this link:\n\n${link}\n\nThe link expires in 24 hours. If you did not create an account, you can ignore this email.\n`
  });
}

async function sendPasswordResetEmail(req, user) {
  const link = `${baseUrl(req)}/reset/${user.resetPasswordToken}`;
  return send({
    to: user.username,
    subject: `Reset your ${SITE.name} password`,
    text: `You are receiving this because a password reset was requested for your account.\n\nOpen this link to choose a new password (valid for 1 hour):\n\n${link}\n\nIf you did not request this, ignore this email and your password will remain unchanged.\n`
  });
}

async function sendPasswordChangedEmail(user) {
  return send({
    to: user.username,
    subject: "Your password has been changed",
    text: `Hello,\n\nThis is a confirmation that the password for your ${SITE.name} account (${user.username}) was just changed.\n`
  });
}

module.exports = { send, sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail };
