const logger = require('../utils/logger');
let Bull;
try {
  Bull = require('bull');
} catch (e) {
  Bull = null;
}

let attendanceStatsQueue = null;
const REDIS_URL = process.env.REDIS_URL;

const Redis = require('ioredis');

function createBullRedisClient(type, redisUrl) {
  const isTls = redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io');
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 200, 3000);
    },
    ...(isTls ? { tls: { rejectUnauthorized: false } } : {})
  });

  client.on('error', (err) => {
    // Suppress unhandled ioredis error events that crash Node processes
  });

  return client;
}

if (REDIS_URL && Bull) {
  try {
    attendanceStatsQueue = new Bull('attendance:recalc-stats', {
      createClient: (type) => createBullRedisClient(type, REDIS_URL),
    });
    
    attendanceStatsQueue.process(async (job) => {
      const { studentId, subjectId, tenantId } = job.data;
      const { updateStudentAttendanceStats } = require('../controllers/attendanceController');
      if (typeof updateStudentAttendanceStats === 'function') {
        await updateStudentAttendanceStats(studentId, subjectId, tenantId);
      }
    });

    attendanceStatsQueue.on('failed', (job, err) => {
      logger.error('Attendance stats recalculation job failed', { jobId: job.id, error: err.message });
    });

    logger.info('Bull queue attendance:recalc-stats initialized with Redis');
  } catch (err) {
    logger.warn('Failed to initialize Redis Bull queue, using inline async fallback', { error: err.message });
    attendanceStatsQueue = null;
  }
} else {
  logger.info('Redis URL or Bull package not available — using inline async fallback for attendance stats');
}

/**
 * Dispatch job to recalculate student attendance stats asynchronously.
 */
const addStatRecalcJob = async (studentId, subjectId, tenantId) => {
  if (attendanceStatsQueue && attendanceStatsQueue.client && attendanceStatsQueue.client.status === 'ready') {
    try {
      const addPromise = attendanceStatsQueue.add(
        { studentId, subjectId, tenantId },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Queue add timeout')), 1500)
      );
      await Promise.race([addPromise, timeoutPromise]);
      return;
    } catch (err) {
      logger.warn('Redis queue add failed/timed out, executing stats update inline', { error: err.message });
    }
  }

  // Non-blocking asynchronous fallback using setImmediate
  setImmediate(async () => {
    try {
      const { updateStudentAttendanceStats } = require('../controllers/attendanceController');
      if (typeof updateStudentAttendanceStats === 'function') {
        await updateStudentAttendanceStats(studentId, subjectId, tenantId);
      }
    } catch (err) {
      logger.error('Async inline attendance stats update error', { error: err.message, studentId });
    }
  });
};

module.exports = {
  attendanceStatsQueue,
  addStatRecalcJob,
};
