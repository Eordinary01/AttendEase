const logger = require('./logger');

let Bull = null;
try {
  Bull = require('bull');
} catch (e) {
  // bull not available
}

const REDIS_URL = process.env.REDIS_URL;
let emailQueue = null;
let statsQueue = null;

const Redis = require('ioredis');

function createBullRedisClient(type, redisUrl) {
  const isTls = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');
  const REDIS_TLS_CA = process.env.REDIS_TLS_CA;
  const tlsConfig = isTls ? {
    rejectUnauthorized: !REDIS_TLS_CA,
    ...(REDIS_TLS_CA ? { ca: require('fs').readFileSync(REDIS_TLS_CA) } : {})
  } : undefined;

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
    ...(tlsConfig ? { tls: tlsConfig } : {})
  });

  client.on('error', () => {});

  return client;
}

if (Bull && REDIS_URL) {
  const bullOptions = {
    createClient: (type) => createBullRedisClient(type, REDIS_URL),
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
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'Gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
    });
    await transporter.sendMail(job.data.mailOptions);
    logger.info(`Email sent to ${job.data.mailOptions.to}`);
  });

  logger.info('Bull queues initialized with Redis');
} else {
  logger.info('Bull queues inactive (no Redis URL or bull package) — jobs run inline');
}

function addEmailJob(mailOptions) {
  if (emailQueue) {
    return emailQueue.add({ mailOptions });
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
