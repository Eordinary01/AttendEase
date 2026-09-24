const logger = require('./logger');

/**
 * Format a date value to ISO date string YYYY-MM-DD.
 * Uses UTC calendar fields to avoid local-timezone drift.
 */
function toISODateString(dateInput) {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const isoDateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDateMatch && trimmed.includes('T')) {
      return isoDateMatch[1];
    }
  }
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) {
      logger.warn('toISODateString received invalid date', { input: dateInput });
      return '';
    }
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    logger.warn('toISODateString formatting failed', { error: error.message, input: dateInput });
    return '';
  }
}

/**
 * Format a date value to DD/MM/YYYY.
 */
function formatDateDMY(dateInput, fallback = '') {
  if (dateInput === null || dateInput === undefined) return fallback;
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return fallback;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    logger.warn('formatDateDMY formatting failed', { error: error.message, input: dateInput });
    return fallback;
  }
}

/**
 * Returns today's date in YYYY-MM-DD format using UTC calendar parts.
 */
function getTodayISODateString() {
  return toISODateString(new Date());
}

module.exports = {
  toISODateString,
  formatDateDMY,
  getTodayISODateString,
};
