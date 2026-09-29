require('dotenv').config();
const Bull = require('bull');
const logger = require('../utils/logger');
const { createBullRedisClient } = require('../utils/redisClient');
const { publishPromotionCompleted } = require('../events/publishers');

let promotionQueue = null;

function getPromotionQueue() {
  if (promotionQueue) return promotionQueue;
  if (!process.env.REDIS_URL) {
    logger.warn('Promotion queue: REDIS_URL not set — background promotions disabled');
    return null;
  }
  try {
    promotionQueue = new Bull('attendease:promotions', {
      createClient: createBullRedisClient,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });

    promotionQueue.on('completed', (job, result) => {
      logger.info('Promotion Bull job completed event', { jobId: job.id, tenantId: job.data?.tenantId });
      if (job.data?.tenantId) {
        publishPromotionCompleted(job.data.tenantId, {
          jobId: job.id,
          promoted: result?.promoted ?? 0,
          graduated: result?.graduated ?? 0,
          eligible: result?.eligible ?? 0,
          skipped: result?.skipped ?? 0,
          details: result?.details || [],
          finishedAt: new Date().toISOString(),
        });
      }
    });

    promotionQueue.on('failed', (job, err) => {
      logger.error('Promotion job failed', {
        jobId: job.id,
        tenantId: job.data?.tenantId,
        attempt: job.attemptsMade,
        error: err?.message || String(err),
      });
    });

    promotionQueue.on('error', (err) => {
      logger.error('Promotion queue error', { error: err?.message || String(err) });
    });

    logger.info('Promotion queue initialized with Redis TLS client');
  } catch (err) {
    logger.error('Promotion queue init failed', { error: err.message });
    promotionQueue = null;
  }
  return promotionQueue;
}

async function enqueuePromotionBatch(tenantId, studentIds, options = {}) {
  const queue = getPromotionQueue();
  if (!queue) return { jobId: null, skipped: true, message: 'Queue unavailable' };
  const job = await queue.add('promote', { tenantId, studentIds, ...options });
  return { jobId: job.id, skipped: false };
}

async function getJobStatus(jobId) {
  const queue = getPromotionQueue();
  if (!queue) return null;
  try {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    const progress = typeof job.progress === 'function' ? job.progress() : (job.progress || 0);
    return {
      jobId: job.id,
      state,
      progress,
      data: job.data,
      result: job.returnvalue || null,
      failedReason: job.failedReason || null,
      attemptsMade: job.attemptsMade || 0,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
    };
  } catch (err) {
    logger.error('Error fetching job status', { jobId, error: err.message });
    return null;
  }
}

module.exports = { getPromotionQueue, enqueuePromotionBatch, getJobStatus };
