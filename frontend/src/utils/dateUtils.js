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

export default formatDateDMY;
