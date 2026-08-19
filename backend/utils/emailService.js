const nodemailer = require('nodemailer');
const https = require('https');
const logger = require('./logger');

/**
 * Send transactional email using Brevo REST API if API Key is configured,
 * otherwise fall back to Nodemailer SMTP (e.g. Brevo SMTP or Gmail SMTP).
 */
const sendMail = async ({ to, subject, html, text }) => {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER || 'noreply@attendease.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'AttendEase';

  // Option 1: Brevo HTTP REST API
  if (brevoApiKey) {
    const payload = JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
      subject: subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]+>/g, ''),
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        'https://api.brevo.com/v3/smtp/email',
        {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'api-key': brevoApiKey,
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              logger.info(`Email sent via Brevo REST API to ${to}`);
              resolve({ success: true, body });
            } else {
              logger.error(`Brevo REST API error (${res.statusCode}): ${body}`);
              reject(new Error(`Brevo API error ${res.statusCode}: ${body}`));
            }
          });
        }
      );

      req.on('error', (err) => {
        logger.error('Failed to send email via Brevo REST API', { error: err.message });
        reject(err);
      });

      req.write(payload);
      req.end();
    });
  }

  // Option 2: Nodemailer (Brevo SMTP or custom SMTP / Gmail)
  const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD;

  const transporter = nodemailer.createTransport(
    process.env.EMAIL_SERVICE
      ? {
          service: process.env.EMAIL_SERVICE,
          auth: { user: smtpUser, pass: smtpPass },
        }
      : {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        }
  );

  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject,
    text: text || html.replace(/<[^>]+>/g, ''),
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent via Nodemailer to ${to}`, { messageId: info.messageId });
    return { success: true, info };
  } catch (error) {
    logger.error('Failed to send email via Nodemailer', { error: error.message });
    throw error;
  }
};

/**
 * Send Email Verification OTP to user
 */
const sendVerificationOTP = async (email, name, otp) => {
  const subject = 'AttendEase - Verify Your Email Address';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #8b5cf6;">
        <h2 style="color: #6d28d9; margin: 0;">AttendEase Verification</h2>
      </div>
      <div style="padding: 20px 0;">
        <p style="font-size: 16px; color: #334155;">Hello ${name || 'User'},</p>
        <p style="font-size: 15px; color: #475569;">Thank you for registering with <strong>AttendEase</strong>. Please use the verification code below to complete your email verification:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6d28d9; background: #f3e8ff; padding: 12px 24px; border-radius: 8px; display: inline-block;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 14px; color: #64748b;">This code is valid for <strong>15 minutes</strong>. If you did not request this, please ignore this email.</p>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
        &copy; ${new Date().getFullYear()} AttendEase. All rights reserved.
      </div>
    </div>
  `;

  return sendMail({ to: email, subject, html });
};

/**
 * Send Password Reset link to user (Item #15)
 */
const sendPasswordResetEmail = async (email, name, resetToken) => {
  const subject = 'AttendEase - Password Reset Request';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #8b5cf6;">
        <h2 style="color: #6d28d9; margin: 0;">AttendEase Password Reset</h2>
      </div>
      <div style="padding: 20px 0;">
        <p style="font-size: 16px; color: #334155;">Hello ${name || 'User'},</p>
        <p style="font-size: 15px; color: #475569;">We received a request to reset your password for your <strong>AttendEase</strong> account. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #6d28d9; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #64748b;">This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">Direct link: ${resetUrl}</p>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; color: #94a3b8; font-size: 12px;">
        &copy; ${new Date().getFullYear()} AttendEase. All rights reserved.
      </div>
    </div>
  `;

  return sendMail({ to: email, subject, html });
};

module.exports = {
  sendMail,
  sendVerificationOTP,
  sendPasswordResetEmail,
};

