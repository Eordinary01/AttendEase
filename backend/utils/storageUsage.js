const mongoose = require("mongoose");

/**
 * Compute a tenant's live storage footprint (in bytes) by summing the BSON
 * size of every document the tenant owns across all tenant-scoped collections.
 * Uses MongoDB's $bsonSize aggregation, so the figure reflects real stored data
 * (users, subjects, timetables, attendance, enrollments, exams, fees, ...).
 */
async function computeStorageUsedBytes(tenantId) {
  const oid = new mongoose.Types.ObjectId(String(tenantId));
  let totalBytes = 0;

  for (const Model of Object.values(mongoose.models)) {
    if (!Model.modelName || Model.modelName === "Tenant") continue;
    if (!Model.schema || !Model.schema.paths || !Model.schema.paths.tenantId) continue;
    try {
      const rows = await Model.aggregate([
        { $match: { tenantId: oid } },
        { $group: { _id: null, bytes: { $sum: { $bsonSize: "$$ROOT" } } } },
      ]);
      totalBytes += (rows[0] && rows[0].bytes) || 0;
    } catch (err) {
      // Collection may not support this aggregation shape; skip it.
    }
  }

  // Include the Tenant document itself (matched by _id, not tenantId).
  try {
    const Tenant = mongoose.model("Tenant");
    const rows = await Tenant.aggregate([
      { $match: { _id: oid } },
      { $group: { _id: null, bytes: { $sum: { $bsonSize: "$$ROOT" } } } },
    ]);
    totalBytes += (rows[0] && rows[0].bytes) || 0;
  } catch (err) {
    // ignore
  }

  return totalBytes;
}

/**
 * Tenant storage usage in megabytes, rounded to 2 decimals.
 */
async function computeStorageUsedMB(tenantId) {
  const bytes = await computeStorageUsedBytes(tenantId);
  return Number((bytes / (1024 * 1024)).toFixed(2));
}

module.exports = { computeStorageUsedBytes, computeStorageUsedMB };
