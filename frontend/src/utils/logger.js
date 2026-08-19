/**
 * Structured logging utility for the frontend.
 * Replaces direct console.log / console.error calls.
 *
 * In development, logs are written to the console.
 * In production, only errors are logged (and could be extended
 * to send to an external service like Sentry).
 */

const isDev = process.env.NODE_ENV === "development";

export const logger = {
  debug: (...args) => {
    if (isDev) console.debug("[DEBUG]", ...args);
  },

  info: (...args) => {
    if (isDev) console.info("[INFO]", ...args);
  },

  warn: (...args) => {
    console.warn("[WARN]", ...args);
  },

  error: (...args) => {
    console.error("[ERROR]", ...args);
  },
};

/**
 * Convenience function for error handlers that want to log and
 * optionally surface a user-facing message.
 */
export const logError = (context, error) => {
  const message = error?.response?.data?.message || error?.message || String(error);
  logger.error(`[${context}]`, message, error);
  return message;
};

export default logger;
