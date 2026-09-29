const logger = require('./logger');

let Bull = null;
try {
  Bull = require('bull');
} catch (e) {
  // bull not available
}

const REDIS_URL = process.env.REDIS_URL;
const { createBullRedisClient } = require('./redisClient');
let emailQueue = null;
let statsQueue = null;

const isProductionEmail = process.env.BREVO_PRODUCTION === 'true';

if (Bull && REDIS_URL) {
  const bullOptions = {
    createClient: createBullRedisClient,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50
    }
  };

  emailQueue = new Bull('email', bullOptions);
  statsQueue = new Bull('stats', bullOptions);

  let hasLoggedEmailErr = false;
  let hasLoggedStatsErr = false;
  emailQueue.on('error', (err) => {
    if (!hasLoggedEmailErr) {
      logger.warn('Email queue connection warning (jobs will run inline if Redis fails)', { error: err.message });
      hasLoggedEmailErr = true;
    }
  });
  statsQueue.on('error', (err) => {
    if (!hasLoggedStatsErr) {
      logger.warn('Stats queue connection warning (jobs will run inline if Redis fails)', { error: err.message });
      hasLoggedStatsErr = true;
    }
  });

  emailQueue.process(async (job) => {
    const { mailOptions, tenantId, template } = job.data;
    
    if (!isProductionEmail) {
      logger.info(`[EMAIL DEV MODE] Queue would send email to ${mailOptions.to}`, {
        subject: mailOptions.subject,
        template,
        tenantId,
      });
      return { success: true, devMode: true };
    }

    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'Gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
    });
    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${mailOptions.to}`);
  });

  logger.info('Bull queues initialized with Redis');
} else {
  logger.info('Bull queues inactive (no Redis URL or bull package) — jobs run inline');
}

function addEmailJob(mailOptions, options = {}) {
  const { tenantId, template, priority = 'normal' } = options;
  
  if (!isProductionEmail) {
    logger.info(`[EMAIL DEV MODE] addEmailJob would queue email to ${mailOptions.to}`, {
      subject: mailOptions.subject,
      template,
      tenantId,
      priority,
    });
    return Promise.resolve({ success: true, devMode: true, messageId: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` });
  }

  if (emailQueue) {
    return emailQueue.add({ mailOptions, tenantId, template, priority }, { priority: 10, attempts: 3 });
  }
  // Fallback: send inline
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'Gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
  });
  return transporter.sendMail(mailOptions).catch(err => logger.error('Inline email send failed', { error: err.message }));
}

function addStatsJob(tenantId) {
  if (statsQueue) {
    return statsQueue.add({ tenantId });
  }
  return Promise.resolve();
}

module.exports = { addEmailJob, addStatsJob };
