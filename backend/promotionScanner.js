/**
 * Daily scanner — checks every tenant for students due for promotion and creates
 * an Alert to the tenant admin when promotions are ready.
 *
 * Runs once per server start + every 24h. Does NOT auto-promote — only pings the
 * admin. To auto-promote, set tenant.settings.autoPromote = true AND call
 * enqueuePromotionBatch from this scanner.
 *
 * Patterns: mirrors the existing setInterval(autoCompleteExams, ...) pattern in
 * backend/index.js. Uses the Alert model directly (no controller) to avoid
 * auth middlware coupling.
 */

const logger = require('./utils/logger');
const Tenant = require('./models/Tenant');
const Alert = require('./models/Alert');
const { scanForDuePromotions } = require('./services/promotionService');
const { runTrialReminders } = require('./services/trialReminderService');
const { enqueuePromotionBatch } = require('./queue');

const SCAN_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

async function scanAllTenants() {
  try {
    await runTrialReminders();
  } catch (trialErr) {
    logger.error('Promotion scanner: trial reminders run failed', { error: trialErr.message });
  }

  const tenants = await Tenant.find({}).lean();
  let pings = 0;

  for (const tenant of tenants) {
    try {
      const { due, eligibleCount, graduatingCount, skippedCount, summary } =
        await scanForDuePromotions(tenant._id);

      if (!due) continue;

      const autoPromote = tenant?.settings?.semesterStructure?.autoPromote !== false;

      // Find the tenant admin(s)
      const User = require('./models/User');
      const admins = await User.find({
        tenantId: tenant._id,
        role: { $in: ['admin', 'super_admin'] },
        isActive: true,
      }).select('name email').lean();

      if (admins.length === 0) {
        logger.info('Promotion scanner: tenant has eligible students but no admin to notify', {
          tenantId: tenant._id,
          slug: tenant.slug,
          eligibleCount,
        });
        continue;
      }

      if (autoPromote) {
        // Enqueue background batch promotion
        const queueResult = await enqueuePromotionBatch(tenant._id, null, {
          type: 'auto_scanner',
          runByName: 'Auto Promotion Scanner',
        });

        const alertTitle = queueResult?.jobId ? 'Automatic semester promotion queued' : 'Semester promotion ready';
        const alertMessage = queueResult?.jobId
          ? `Automatic semester promotion has been queued for ${eligibleCount} student(s) (${graduatingCount} graduating).`
          : `Semester promotion is due for ${eligibleCount} student(s) (${graduatingCount} graduating). Auto-queue unavailable; please trigger manually.`;

        // Check if an alert was already created in the last 24h
        const existingAlert = await Alert.findOne({
          tenantId: tenant._id,
          title: alertTitle,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }).lean();

        if (!existingAlert) {
          const alert = await Alert.create({
            tenantId: tenant._id,
            createdBy: null,
            title: alertTitle,
            message: alertMessage,
            type: 'announcement',
            priority: 'high',
            targetRoles: ['admin'],
            isGlobal: false,
            expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });

          const { publishAlertCreated } = require('./events/publishers');
          publishAlertCreated(tenant._id, alert, null);
          pings++;

          logger.info('Promotion scanner: auto-promotion queued and admin alerted', {
            tenantId: tenant._id,
            slug: tenant.slug,
            eligibleCount,
            jobId: queueResult?.jobId,
          });
        }
      } else {
        // Check if an alert for promotion was already created in the last 24h
        const existingAlert = await Alert.findOne({
          tenantId: tenant._id,
          title: 'Semester promotion ready',
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }).lean();

        if (existingAlert) {
          logger.info('Promotion scanner: recent alert already exists for tenant within 24h, skipping ping', {
            tenantId: tenant._id,
            slug: tenant.slug,
          });
          continue;
        }

        // Create ONE alert for manual review
        const alert = await Alert.create({
          tenantId: tenant._id,
          createdBy: null, // system-generated
          title: 'Semester promotion ready',
          message: [
            `Semester promotion is due for ${eligibleCount} student(s)`,
            graduatingCount > 0 ? `, ${graduatingCount} of which will graduate` : '',
            `. ${skippedCount > 0 ? `Skipping ${skippedCount} students (on hold / not yet due / missing data).` : ''}`,
            summary.length > 0
              ? ` First few: ${summary.map(s => `${s.name} (Sem ${s.currentSemester} → ${s.toSemester}${s.willGraduate ? ' — graduating' : ''})`).join(', ')}.` 
              : '',
          ].join(''),
          type: 'announcement',
          priority: 'high',
          targetRoles: ['admin'],
          isGlobal: false,
          expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        const { publishAlertCreated } = require('./events/publishers');
        publishAlertCreated(tenant._id, alert, null);

        pings++;
        logger.info('Promotion scanner: alerted admin about due promotion', {
          tenantId: tenant._id,
          slug: tenant.slug,
          eligibleCount,
          graduatingCount,
          alertId: alert._id,
        });
      }
    } catch (err) {
      logger.error('Promotion scanner: tenant scan failed', {
        tenantId: tenant._id,
        slug: tenant.slug,
        error: err.message,
      });
    }
  }

  logger.info('Promotion scanner run complete', { tenantsChecked: tenants.length, adminsPinged: pings });
}

let scannerTimer = null;

function startPromotionScanner() {
  if (scannerTimer) return;
  // 1. In-memory interval execution (immediate scan on startup + daily interval fallback)
  scanAllTenants().catch(err => logger.error('Promotion scanner initial run failed', { error: err.message }));
  scannerTimer = setInterval(() => {
    scanAllTenants().catch(err => logger.error('Promotion scanner interval run failed', { error: err.message }));
  }, SCAN_INTERVAL_MS);
  logger.info('Promotion scanner started', { intervalHours: SCAN_INTERVAL_MS / 3600000 });

  // 2. Persistent Redis-backed repeatable Bull job (survives process restarts and deployments)
  try {
    const { getPromotionQueue } = require('./queue');
    const queue = getPromotionQueue();
    if (queue) {
      const cronExp = process.env.PROMOTION_SCAN_CRON || '0 2 * * *';
      queue.add('daily_promotion_scan', {}, {
        jobId: 'daily_promotion_scan_job',
        repeat: { cron: cronExp },
        removeOnComplete: true,
      }).catch(err => {
        logger.debug('Bull repeatable promotion scan registration notice', { error: err.message });
      });
      logger.info('Promotion scanner: persistent Bull repeatable job registered', { cron: cronExp });
    }
  } catch (err) {
    logger.debug('Redis Bull scheduler not initialized, operating in interval mode', { error: err.message });
  }
}

module.exports = {
  startPromotionScanner,
  scanAllTenants,
  runDailyScanner: scanAllTenants,
};
