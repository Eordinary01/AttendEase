/**
 * Semester date utilities — single source of truth for semester timing.
 *
 * Rules:
 *   semestersPerYear = 2 (half-yearly):
 *     - Odd semesters (1, 3, 5, …) start at academicStartMonth
 *     - Even semesters (2, 4, 6, …) start at academicStartMonth + 6
 *   semestersPerYear = 1 (annual):
 *     - Each semester starts at academicStartMonth
 *
 * All months are 0-indexed (0 = Jan … 11 = Dec).
 */

/**
 * Return an array of { semester, startDate, endDate, academicYear } for every
 * semester of a course, anchored to a reference year.
 *
 * @param {Object}  opts
 * @param {number}  opts.semestersPerYear   1 | 2
 * @param {number}  opts.durationYears      total program length in years
 * @param {number}  opts.academicStartMonth  0-indexed month the academic year begins
 * @param {number}  [opts.anchorYear]       year the first semester starts (default: current year)
 * @returns {Array<{ semester: number, startDate: Date, endDate: Date, academicYear: string }>}
 */
function buildSemesterTimeline({ semestersPerYear, durationYears, academicStartMonth, anchorYear }) {
  const totalSemesters = durationYears * semestersPerYear;
  const now = new Date();
  const year = anchorYear ?? now.getFullYear();
  const monthsPerSemester = 12 / semestersPerYear;

  const timeline = [];
  for (let sem = 1; sem <= totalSemesters; sem++) {
    // Within each academic year, offset by (semesterIndex % semestersPerYear)
    const semIndex = sem - 1;
    const yearIndex = Math.floor(semIndex / semestersPerYear);
    const offsetInYear = semIndex % semestersPerYear;

    const startMonth = (academicStartMonth + offsetInYear * monthsPerSemester) % 12;
    const startYear = year + Math.floor((academicStartMonth + offsetInYear * monthsPerSemester) / 12);

    const endMonth = (startMonth + monthsPerSemester) % 12;
    const endYear = startYear + Math.floor((startMonth + monthsPerSemester) / 12);

    const startDate = new Date(startYear, startMonth, 1);
    const endDate = new Date(endYear, endMonth, 0); // last day of endMonth

    // Academic year label (e.g. "2026-27")
    const ayStart = academicStartMonth <= startMonth ? startYear : startYear - 1;
    const academicYear = `${ayStart}-${String(ayStart + 1).slice(-2)}`;

    timeline.push({ semester: sem, startDate, endDate, academicYear });
  }

  return timeline;
}

/**
 * Given the current date, figure out which semesters are in the "current" academic year.
 * Returns { currentYearNumber, semesters: [{ semester, startDate, endDate }] }
 */
function getCurrentAcademicYearSemesters({ semestersPerYear, durationYears, academicStartMonth }) {
  const timeline = buildSemesterTimeline({ semestersPerYear, durationYears, academicStartMonth });
  const now = new Date();

  // Which semesters contain `now`?
  const activeSem = timeline.find(s => now >= s.startDate && now <= s.endDate);

  if (!activeSem) {
    // Before first semester or after last — fall back to first semester
    return {
      currentYearNumber: 1,
      semesters: timeline.filter(s => s.semester <= semestersPerYear),
    };
  }

  const yearIndex = Math.floor((activeSem.semester - 1) / semestersPerYear);
  const firstSemOfThisYear = yearIndex * semestersPerYear + 1;
  const lastSemOfThisYear = Math.min(firstSemOfThisYear + semestersPerYear - 1, durationYears * semestersPerYear);

  return {
    currentYearNumber: yearIndex + 1,
    semesters: timeline.filter(s => s.semester >= firstSemOfThisYear && s.semester <= lastSemOfThisYear),
  };
}

/**
 * Calculate the exact payment deadline for a given semester based on the tenant's configured academic structure.
 * It computes the semester's window and returns the exact end date of that semester window.
 *
 * @param {number|string} semester
 * @param {Object} [opts]
 * @param {number} [opts.semestersPerYear=2]
 * @param {number} [opts.academicStartMonth=6]
 * @param {number} [opts.durationYears=4]
 * @param {number} [opts.anchorYear=currentYear]
 * @returns {Date}
 */
function getSemesterDeadline(semester, opts = {}) {
  const semNum = parseInt(String(semester).replace(/\D/g, ""), 10) || 1;
  const semestersPerYear = opts.semestersPerYear || 2;
  const academicStartMonth = opts.academicStartMonth != null ? opts.academicStartMonth : 6;
  const durationYears = opts.durationYears || 4;
  const anchorYear = opts.anchorYear || new Date().getFullYear();

  const timeline = buildSemesterTimeline({
    semestersPerYear,
    durationYears,
    academicStartMonth,
    anchorYear,
  });

  const matched = timeline.find(s => s.semester === semNum);
  if (matched && matched.endDate) {
    return matched.endDate;
  }

  // Fallback calculation for higher semesters beyond standard durationYears
  const monthsPerSemester = 12 / semestersPerYear;
  const semIndex = semNum - 1;
  const offsetInYear = semIndex % semestersPerYear;
  const startMonth = (academicStartMonth + offsetInYear * monthsPerSemester) % 12;
  const startYear = anchorYear + Math.floor((academicStartMonth + offsetInYear * monthsPerSemester) / 12) + Math.floor(semIndex / semestersPerYear);
  const endMonth = (startMonth + monthsPerSemester) % 12;
  const endYear = startYear + Math.floor((startMonth + monthsPerSemester) / 12);
  return new Date(endYear, endMonth, 0, 23, 59, 59, 999);
}

module.exports = { buildSemesterTimeline, getCurrentAcademicYearSemesters, getSemesterDeadline };
