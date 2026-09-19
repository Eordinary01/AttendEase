const Enrollment = require("../models/Enrollment");
const cache = require("../middleware/cache");
const logger = require("./logger");

/**
 * Get active student sections for a tenant with 30s RAM caching
 * @param {string|ObjectId} tenantId 
 * @returns {Promise<Array<string>>} List of active uppercase section strings
 */
const getActiveTenantSections = async (tenantId) => {
  if (!tenantId) return [];
  const cacheKey = `tenant:sections:${tenantId}`;
  
  try {
    let sections = await cache.get(cacheKey);
    if (!sections) {
      const rawSections = await Enrollment.distinct("section", {
        tenantId,
        section: { $exists: true, $ne: "" },
      });
      sections = (rawSections || [])
        .map((s) => String(s || "").trim().toUpperCase())
        .filter(Boolean);
      sections = [...new Set(sections)].sort();
      
      if (sections) {
        await cache.set(cacheKey, sections, 30);
      }
    }
    return sections;
  } catch (error) {
    logger.error("Error fetching active tenant sections", { error: error.message, tenantId });
    return [];
  }
};

/**
 * Invalidate active section cache when enrollments change
 * @param {string|ObjectId} tenantId 
 */
const invalidateTenantSectionsCache = async (tenantId) => {
  if (!tenantId) return;
  const cacheKey = `tenant:sections:${tenantId}`;
  try {
    await cache.del(cacheKey);
  } catch (e) {
    // Ignore cache clear error
  }
};

/**
 * Validate if section(s) exist in active tenant enrollments
 * @param {string|ObjectId} tenantId 
 * @param {string|Array<string>} requestedSections 
 * @returns {Promise<{ valid: boolean, invalidSections: string[], availableSections: string[], message?: string }>}
 */
const validateSectionsExist = async (tenantId, requestedSections) => {
  const activeSections = await getActiveTenantSections(tenantId);
  const sectionsArray = Array.isArray(requestedSections)
    ? requestedSections
    : [requestedSections];
  
  const activeSet = new Set(activeSections.map((s) => s.toUpperCase()));
  const invalidSections = [];

  for (const s of sectionsArray) {
    const norm = String(s || "").trim().toUpperCase();
    if (norm && !activeSet.has(norm)) {
      invalidSections.push(norm);
    }
  }

  if (invalidSections.length > 0) {
    const availableStr = activeSections.length > 0 ? activeSections.join(", ") : "none currently uploaded";
    const sectionWord = invalidSections.length === 1 ? `Section '${invalidSections[0]}'` : `Sections '${invalidSections.join(", ")}'`;
    return {
      valid: false,
      invalidSections,
      availableSections: activeSections,
      message: `${sectionWord} is not listed in active student enrollments. Available active section(s): ${availableStr}`,
    };
  }

  return {
    valid: true,
    invalidSections: [],
    availableSections: activeSections,
  };
};

/**
 * Resolves distinct uppercase assigned sections for a teacher user across
 * assignedSubjects, customRoles, and active Timetable slots.
 * @param {Object} teacherUser - req.user or teacher document
 * @param {string|ObjectId} tenantId
 * @returns {Promise<Array<string>>}
 */
const getTeacherAssignedSections = async (teacherUser, tenantId) => {
  if (!teacherUser) return [];
  const sections = new Set();

  const customRoles = teacherUser.customRoles || [];
  const hasBeyondClassRole = customRoles.some((cr) => cr && (!cr.section || String(cr.section).trim() === ""));
  if (hasBeyondClassRole && tenantId) {
    const allSecs = await getActiveTenantSections(tenantId);
    if (allSecs && allSecs.length > 0) {
      return allSecs;
    }
  }

  (teacherUser.assignedSubjects || []).forEach((a) => {
    if (a.section) sections.add(String(a.section).trim().toUpperCase());
  });
  (teacherUser.customRoles || []).forEach((cr) => {
    if (cr.section) sections.add(String(cr.section).trim().toUpperCase());
  });

  const teacherId = teacherUser._id || teacherUser.id;
  if (sections.size === 0 && teacherId) {
    const User = require("../models/User");
    const fresh = await User.findById(teacherId).select("assignedSubjects customRoles").lean();
    if (fresh?.customRoles?.some((cr) => cr && (!cr.section || String(cr.section).trim() === "")) && tenantId) {
      const allSecs = await getActiveTenantSections(tenantId);
      if (allSecs && allSecs.length > 0) {
        return allSecs;
      }
    }
    (fresh?.assignedSubjects || []).forEach((a) => {
      if (a.section) sections.add(String(a.section).trim().toUpperCase());
    });
    (fresh?.customRoles || []).forEach((cr) => {
      if (cr.section) sections.add(String(cr.section).trim().toUpperCase());
    });
  }

  if (teacherId && tenantId) {
    const Timetable = require("../models/Timetable");
    const timetableSecs = await Timetable.distinct("section", {
      tenantId,
      teacherId,
      isActive: true,
    });
    timetableSecs.forEach((s) => {
      if (s) sections.add(String(s).trim().toUpperCase());
    });
  }

  return Array.from(sections).filter(Boolean).sort();
};

module.exports = {
  getActiveTenantSections,
  invalidateTenantSectionsCache,
  validateSectionsExist,
  getTeacherAssignedSections,
};

