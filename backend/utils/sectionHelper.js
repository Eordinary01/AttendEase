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

module.exports = {
  getActiveTenantSections,
  invalidateTenantSectionsCache,
  validateSectionsExist,
};
