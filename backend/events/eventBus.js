const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('../utils/logger');
const sseManager = require('../utils/sseManager');
const { getSharedRedisClient, createDedicatedRedisClient } = require('../utils/redisClient');

const INSTANCE_ID = `proc_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const REDIS_EVENT_CHANNEL_PREFIX = 'attendease:events:';
const REDIS_PATTERN = 'attendease:events:*';

class DomainEventBus extends EventEmitter {
  constructor() {
    super();
    this.instanceId = INSTANCE_ID;
    this.redisPublisher = null;
    this.redisSubscriber = null;
    this.isRedisSubscribed = false;

    // Default max listeners to accommodate multi-feature listeners without warnings
    this.setMaxListeners(100);

    this.initRedisPubSub();
  }

  /**
   * Initializes Redis pub/sub if Redis is available.
   * Subscriber uses createDedicatedRedisClient() because in Redis/ioredis,
   * a subscriber client enters subscriber mode and cannot issue regular commands.
   */
  async initRedisPubSub() {
    // Check if explicitly disabled (useful for Upstash free tier or single-instance setups)
    if (process.env.DISABLE_REDIS_PUBSUB === 'true' || process.env.REDIS_PUBSUB_ENABLED === 'false') {
      logger.info('EventBus: Redis pub/sub explicitly disabled; operating in local in-memory mode.');
      return;
    }

    try {
      // 1. Publisher: can reuse the shared client
      this.redisPublisher = getSharedRedisClient();

      // 2. Subscriber: MUST be a dedicated client
      this.redisSubscriber = createDedicatedRedisClient();
      if (!this.redisSubscriber) {
        logger.info('Redis not configured for EventBus; running in local in-memory mode.');
        return;
      }

      this.redisSubscriber.on('error', (err) => {
        logger.warn('EventBus Redis subscriber warning', { error: err.message });
      });

      // Handle connection
      const connectPromise = this.redisSubscriber.status === 'ready' || this.redisSubscriber.status === 'connecting'
        ? Promise.resolve()
        : this.redisSubscriber.connect().catch((err) => {
            logger.warn('EventBus Redis subscriber connect failed, falling back to local mode', {
              error: err.message,
            });
          });

      await connectPromise;

      if (this.redisSubscriber.status === 'ready' || this.redisSubscriber.status === 'connect') {
        this.setupSubscriber();
      } else {
        this.redisSubscriber.once('ready', () => this.setupSubscriber());
      }
    } catch (err) {
      logger.warn('EventBus Redis initialization failed; operating in local mode', {
        error: err.message,
      });
    }
  }

  setupSubscriber() {
    if (!this.redisSubscriber || this.isRedisSubscribed) return;

    this.redisSubscriber.psubscribe(REDIS_PATTERN, (err) => {
      if (err) {
        logger.info('EventBus Redis pub/sub not supported or rejected (e.g. Upstash free tier); operating in local mode', {
          error: err.message,
        });
        this.isRedisSubscribed = false;
        return;
      }
      this.isRedisSubscribed = true;
      logger.info('EventBus successfully subscribed to Redis events pattern', { pattern: REDIS_PATTERN });
    });

    this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
      try {
        const envelope = JSON.parse(message);
        // Ignore events originating from this server instance (already dispatched locally)
        if (envelope.originInstanceId === this.instanceId) {
          return;
        }

        // Forward cross-instance event to local SSE clients
        const eventName = envelope.event || envelope.eventName;
        sseManager.publishLocal(
          envelope.tenantId,
          eventName,
          envelope.payload,
          envelope.dedupeId,
          envelope.targetFilter,
          envelope.excludeUserId
        );

        // Also emit on in-process EventEmitter
        this.emit(eventName, envelope);
      } catch (err) {
        logger.warn('Failed to parse incoming Redis event message', {
          channel,
          error: err.message,
        });
      }
    });
  }

  /**
   * Publish a domain event.
   * This is fire-and-forget: it will never throw or block calling controller logic.
   *
   * @param {string} eventName
   * @param {object} options
   * @param {string} [options.tenantId] - Tenant ID (null/'global' for platform-wide)
   * @param {string} [options.userId] - User ID if user-specific
   * @param {unknown} options.payload - Event payload data
   * @param {string} [options.dedupeId] - Client deduplication ID
   * @returns {string} The dedupeId assigned to the event
   */
  publish(eventName, { tenantId = null, userId = null, payload = {}, dedupeId = null, targetFilter = null, excludeUserId = null } = {}) {
    try {
      const generatedDedupeId = dedupeId || `${eventName}:${Date.now()}:${crypto.randomBytes(4).toString('hex')}`;
      const envelope = {
        event: eventName,
        tenantId: tenantId ? String(tenantId) : null,
        userId: userId ? String(userId) : null,
        payload,
        targetFilter,
        excludeUserId: excludeUserId ? String(excludeUserId) : null,
        timestamp: new Date().toISOString(),
        dedupeId: generatedDedupeId,
        originInstanceId: this.instanceId,
      };

      // 1. Dispatch immediately to local SSE connections
      sseManager.publishLocal(
        envelope.tenantId,
        eventName,
        envelope.payload,
        envelope.dedupeId,
        envelope.targetFilter,
        envelope.excludeUserId
      );

      // 2. Emit to local EventEmitter listeners
      this.emit(eventName, envelope);

      // 3. Broadcast to Redis pub/sub if available and subscribed for multi-instance distribution
      if (this.redisPublisher && this.redisPublisher.status === 'ready' && this.isRedisSubscribed) {
        const channelKey = envelope.tenantId ? envelope.tenantId : 'global';
        const channel = `${REDIS_EVENT_CHANNEL_PREFIX}${channelKey}`;
        this.redisPublisher.publish(channel, JSON.stringify(envelope)).catch((err) => {
          logger.debug('EventBus Redis publish error (non-fatal)', {
            channel,
            error: err.message,
          });
        });
      }

      return generatedDedupeId;
    } catch (err) {
      logger.error('Unexpected error in EventBus.publish (suppressed)', {
        eventName,
        error: err.message,
      });
      return '';
    }
  }

  /**
   * Clean up Redis connections during server shutdown.
   */
  async close() {
    this.removeAllListeners();

    if (this.redisSubscriber) {
      try {
        if (this.isRedisSubscribed) {
          await this.redisSubscriber.punsubscribe(REDIS_PATTERN).catch(() => {});
        }
        await this.redisSubscriber.quit().catch(() => {});
      } catch {
        // ignore
      }
      this.redisSubscriber = null;
      this.isRedisSubscribed = false;
    }
  }
}

// Singleton export
const eventBus = new DomainEventBus();

module.exports = eventBus;
