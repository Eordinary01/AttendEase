const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Alert = require('../models/Alert');
const logger = require('../utils/logger');
const { sendMail } = require('../utils/emailService');
const { publishAlertCreated } = require('../events/publishers');

const GRACE_PERIOD_DAYS = 3;
const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Scan all tenants for trial expiration and grace periods,
 * dispatching in-app alerts and reminder emails.
 */
async function runTrialReminders() {
  try {
    const tenants = await Tenant.find({
      'subscription.plan': 'free',
      'subscription.trialEndsAt': { $ne: null },
      'subscription.status': { $in: ['trial', 'active'] },
    }).lean();

    const now = Date.now();
    let remindersSent = 0;

    for (const tenant of tenants) {
      const trialEndsAt = new Date(tenant.subscription.trialEndsAt).getTime();
      const diffMs = trialEndsAt - now;
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let reminderType = null;
      let title = '';
      let message = '';

      if (daysRemaining === 4) {
        reminderType = 'trial_ending_4d';
        title = 'Trial ending soon: 4 days remaining';
        message = `Your AttendEase trial will end in 4 days on ${new Date(trialEndsAt).toLocaleDateString()}. Upgrade to a paid plan or transition to the free tier to maintain uninterrupted access.`;
      } else if (daysRemaining === 2 || daysRemaining === 1) {
        reminderType = 'trial_ending_2d';
        title = `Trial ending soon: ${Math.max(1, daysRemaining)} day(s) remaining`;
        message = `Your AttendEase trial will expire in ${Math.max(1, daysRemaining)} day(s). Upgrade now or switch to the free tier to prevent disruption.`;
      } else if (diffMs < 0 && (now - trialEndsAt) < GRACE_PERIOD_MS) {
        reminderType = 'trial_grace_period';
        const graceDaysLeft = Math.max(1, Math.ceil((GRACE_PERIOD_MS - (now - trialEndsAt)) / (1000 * 60 * 60 * 24)));
        title = `Trial grace period active (${graceDaysLeft} day(s) remaining)`;
        message = `Your trial has concluded. You are currently in a ${graceDaysLeft}-day grace period. Upgrade your plan or choose to continue on the free tier to retain access.`;
      }

      if (!reminderType) continue;

      // Check if an alert for this trial reminder was already sent to this tenant in the last 24h
      const existingAlert = await Alert.findOne({
        tenantId: tenant._id,
        title,
        createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
      }).lean();

      if (existingAlert) continue;

      // Find tenant admins
      const admins = await User.find({
        tenantId: tenant._id,
        role: { $in: ['admin', 'super_admin'] },
        isActive: true,
      }).select('name email').lean();

      if (admins.length === 0) continue;

      const alert = await Alert.create({
        tenantId: tenant._id,
        createdBy: null,
        title,
        message,
        type: 'warning',
        priority: 'high',
        targetRoles: ['admin'],
        isGlobal: false,
        expiryDate: new Date(now + 7 * 24 * 60 * 60 * 1000),
      });

      publishAlertCreated(tenant._id, alert, null);
      remindersSent++;

      // Send emails to admins (suppress failures)
      for (const admin of admins) {
        if (admin.email) {
          try {
            await sendMail({
              to: admin.email,
              subject: `[AttendEase] ${title}`,
              html: `<p>Hello ${admin.name || 'Admin'},</p><p>${message}</p><p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/billing">Manage Subscription</a></p>`,
              text: `Hello ${admin.name || 'Admin'},\n\n${message}\n\nManage subscription: ${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/billing`,
            });
          } catch (mailErr) {
            logger.warn('Trial reminder email failed (suppressed)', { email: admin.email, error: mailErr.message });
          }
        }
      }

      logger.info('Trial reminder sent', { tenantId: tenant._id, title, daysRemaining });
    }

    logger.info('Trial reminders check finished', { tenantsChecked: tenants.length, remindersSent });
    return { tenantsChecked: tenants.length, remindersSent };
  } catch (err) {
    logger.error('Error running trial reminders', { error: err.message });
    return { error: err.message };
  }
}

module.exports = {
  runTrialReminders,
  GRACE_PERIOD_MS,
  GRACE_PERIOD_DAYS,
};
