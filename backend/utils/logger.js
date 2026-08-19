const isDev = (process.env.NODE_ENV || 'development') === 'development';

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = levels[process.env.LOG_LEVEL] ?? (isDev ? levels.debug : levels.info);

function formatMessage(level, msg, meta) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    msg,
    ...(meta && Object.keys(meta).length ? { meta } : {})
  };
  return isDev ? `[${level.toUpperCase()}] ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}` : JSON.stringify(entry);
}

const logger = {
  error: (msg, meta) => { if (currentLevel >= levels.error) console.error(formatMessage('error', msg, meta)); },
  warn: (msg, meta) => { if (currentLevel >= levels.warn) console.warn(formatMessage('warn', msg, meta)); },
  info: (msg, meta) => { if (currentLevel >= levels.info) console.log(formatMessage('info', msg, meta)); },
  debug: (msg, meta) => { if (currentLevel >= levels.debug) console.log(formatMessage('debug', msg, meta)); }
};

module.exports = logger;
