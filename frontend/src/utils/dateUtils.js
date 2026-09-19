/**
 * Standardized Date Formatter Utilities
 * Enforces DD/MM/YYYY and DD MMM YYYY across the entire AttendEase platform
 */

/**
 * Format a date as DD/MM/YYYY (e.g. "10/03/2026")
 * @param {string|Date|number} dateInput
 * @param {string} fallback
 * @returns {string}
 */
export const formatDateDMY = (dateInput, fallback = "—") => {
  if (!dateInput) return fallback;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return fallback;
  }
};

/**
 * Format a date with month name (e.g. "10 Mar 2026" or with weekday "Tue, 10 Mar 2026")
 * @param {string|Date|number} dateInput
 * @param {boolean} includeWeekday
 * @param {string} fallback
 * @returns {string}
 */
export const formatDateReadable = (dateInput, includeWeekday = false, fallback = "—") => {
  if (!dateInput) return fallback;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-IN", {
      ...(includeWeekday && { weekday: "short" }),
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return fallback;
  }
};

/**
 * Format date & time (e.g. "10/03/2026, 09:30 AM")
 * @param {string|Date|number} dateInput
 * @param {string} fallback
 * @returns {string}
 */
export const formatDateTime = (dateInput, fallback = "—") => {
  if (!dateInput) return fallback;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return fallback;
  }
};

/**
 * Extract calendar badge parts: { month, day, weekday, weekdayLong, year }
 * Handles invalid or null dates with fallback indicators.
 * @param {string|Date|number} dateInput
 * @returns {{ month: string, day: string, weekday: string, weekdayLong: string, year: number|string }}
 */
export const getDateBadgeParts = (dateInput) => {
  if (!dateInput) return { month: "—", day: "—", weekday: "—", weekdayLong: "—", year: "—" };
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return { month: "—", day: "—", weekday: "—", weekdayLong: "—", year: "—" };
    return {
      month: d.toLocaleDateString("en-IN", { month: "short" }),
      day: String(d.getDate()).padStart(2, "0"),
      weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
      weekdayLong: d.toLocaleDateString("en-IN", { weekday: "long" }),
      year: d.getFullYear(),
    };
  } catch {
    return { month: "—", day: "—", weekday: "—", weekdayLong: "—", year: "—" };
  }
};

/**
 * Format weekday name (e.g. "Monday" or "Mon")
 * @param {string|Date|number} dateInput
 * @param {"long"|"short"} format
 * @param {string} fallback
 * @returns {string}
 */
export const formatWeekday = (dateInput = new Date(), format = "long", fallback = "Monday") => {
  if (!dateInput) return fallback;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("en-IN", { weekday: format });
  } catch {
    return fallback;
  }
};

/**
 * Get today's date as a YYYY-MM-DD string using LOCAL timezone parts.
 *
 * This avoids the common bug where `new Date().toISOString().split('T')[0]`
 * returns a UTC date that can be ±1 day off from the user's local date
 * near midnight in positive UTC offsets (e.g. IST = UTC+5:30).
 *
 * @returns {string} e.g. "2026-09-10"
 */
export const getLocalTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Convert any Date object to a YYYY-MM-DD string using its LOCAL date parts.
 * Use this instead of `d.toISOString().split('T')[0]` when you need to
 * preserve the date as the user sees it.
 *
 * @param {Date} d
 * @returns {string} e.g. "2026-09-10"
 */
export const toLocalDateStr = (d) => {
  if (!d) {
    return getLocalTodayStr();
  }
  if (typeof d === "string") {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match && trimmed.includes("T")) {
      return match[1];
    }
  }
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) {
    return getLocalTodayStr();
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default formatDateDMY;

