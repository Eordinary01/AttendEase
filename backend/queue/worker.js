/**
 * Bull worker for the promotion queue.
 *
 * Runs as part of the main server process (same process, started after Mongo + Redis
 * are connected). Processes jobs from the 'attendease:promotions' queue using the
 * promotionService.runPromotionJob handler.
 *
 * Because the worker lives in the same process as the Express server, a deployment
 * restart drains in-flight jobs gracefully (Bull persists state to Redis).
 */

const logger = require('../utils/logger');
const { getPromotionQueue } = require('./index');
const { runPromotionJob } = require('../services/promotionService');

let workerStarted = false;

/**
 * Start the promotion queue worker.
 * Safe to call multiple times — guards with a flag.
 */
function startPromotionWorker() {
  if (workerStarted) return;
  const queue = getPromotionQueue();
  if (!queue) {
    logger.info('Promotion worker: queue unavailable (Redis not reachable) — background promotions disabled');
    return;
  }

  const concurrency = Number(process.env.PROMOTION_WORKER_CONCURRENCY) || 1;

  queue.process('promote', concurrency, async (job) => {
    logger.info('Promotion job picked up', { jobId: job.id, tenantId: job.data.tenantId, studentIds: job.data.studentIds?.length });
    return runPromotionJob(job);
  });

  queue.process('daily_promotion_scan', 1, async (job) => {
    logger.info('Daily promotion scan job picked up via Redis Bull scheduler', { jobId: job.id });
    const { scanAllTenants } = require('../promotionScanner');
    return scanAllTenants();
  });

  queue.on('active', (job) => {
    logger.info('Promotion job active', { jobId: job.id, tenantId: job.data.tenantId, progress: job.progress() });
  });

  workerStarted = true;
  logger.info('Promotion worker started', { concurrency });
}

module.exports = { startPromotionWorker };
