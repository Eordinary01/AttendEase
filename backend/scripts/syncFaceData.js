/**
 * syncFaceData.js
 *
 * Phase 1 ATTEND-AI Data Synchronization Tool.
 * Imports pre-computed face descriptors and image paths from a JSON manifest
 * into AttendEase student User records, scoped strictly by tenant.
 *
 * Usage:
 *   node backend/scripts/syncFaceData.js --manifest path/to/face-manifest.json [--tenant-id 5f9a...]
 *
 * Manifest JSON format:
 * [
 *   {
 *     "enrollmentNumber": "23BCON1379",
 *     "descriptor": [0.12, -0.34, ...],
 *     "faceImageUrl": "/uploads/face-attendance/23BCON1379.jpg", // optional
 *     "tenantId": "5f9a..." // optional if --tenant-id is provided via CLI
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Tenant = require('../models/Tenant');

// --- Parse CLI Arguments ---
const args = process.argv.slice(2);
let manifestPath = null;
let cliTenantId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--manifest' && args[i + 1]) {
    manifestPath = args[i + 1];
    i++;
  } else if ((args[i] === '--tenant-id' || args[i] === '--tenantId') && args[i + 1]) {
    cliTenantId = args[i + 1];
    i++;
  }
}

if (!manifestPath) {
  console.error('\n❌ ERROR: Missing required argument --manifest <path-to-json>');
  console.log('\nUsage:');
  console.log('  node backend/scripts/syncFaceData.js --manifest ./manifest.json [--tenant-id <tenantObjectId>]\n');
  process.exit(1);
}

const resolvedManifestPath = path.isAbsolute(manifestPath)
  ? manifestPath
  : path.join(process.cwd(), manifestPath);

if (!fs.existsSync(resolvedManifestPath)) {
  console.error(`\n❌ ERROR: Manifest file not found at: ${resolvedManifestPath}\n`);
  process.exit(1);
}

const runSync = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendance_dev';
  console.log(`\nConnecting to MongoDB: ${mongoURI.replace(/\/\/.*@/, '//<credentials>@')}...`);
  
  await mongoose.connect(mongoURI, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('✅ Connected to MongoDB successfully.');

  let rawData;
  try {
    rawData = fs.readFileSync(resolvedManifestPath, 'utf8');
  } catch (err) {
    console.error(`❌ Failed to read manifest file: ${err.message}`);
    process.exit(1);
  }

  let entries;
  try {
    entries = JSON.parse(rawData);
  } catch (err) {
    console.error(`❌ Failed to parse JSON in manifest: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(entries)) {
    console.error('❌ Manifest JSON root must be an array of student face objects.');
    process.exit(1);
  }

  console.log(`\nFound ${entries.length} record(s) in manifest to process...\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const rollNo = (entry.enrollmentNumber || entry.rollNo || '').trim().toUpperCase();
    const descriptor = entry.descriptor || entry.faceDescriptor;
    const imageUrl = entry.faceImageUrl || entry.imagePath || null;
    const targetTenantId = entry.tenantId || cliTenantId;

    if (!rollNo) {
      console.warn(`⚠️ [Row ${index + 1}] Skipped: Missing enrollmentNumber/rollNo`);
      skippedCount++;
      continue;
    }

    if (!targetTenantId) {
      console.warn(`⚠️ [Row ${index + 1}] (${rollNo}) Skipped: No tenantId provided (use --tenant-id flag or include in manifest)`);
      skippedCount++;
      continue;
    }

    if (!mongoose.Types.ObjectId.isValid(targetTenantId)) {
      console.warn(`⚠️ [Row ${index + 1}] (${rollNo}) Skipped: Invalid tenantId format "${targetTenantId}"`);
      skippedCount++;
      continue;
    }

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length === 0) {
      console.warn(`⚠️ [Row ${index + 1}] (${rollNo}) Skipped: Descriptor must be a non-empty array of numbers`);
      skippedCount++;
      continue;
    }

    try {
      const student = await User.findOne({
        rollNo: rollNo,
        tenantId: new mongoose.Types.ObjectId(targetTenantId),
        role: 'student',
        isActive: true,
        isDeleted: false,
      });

      if (!student) {
        console.warn(`⚠️ [Row ${index + 1}] (${rollNo}) Skipped: Active student user not found in tenant ${targetTenantId}`);
        skippedCount++;
        continue;
      }

      student.faceDescriptor = descriptor;
      if (imageUrl) {
        student.faceImageUrl = imageUrl;
      }
      await student.save();

      console.log(`✅ [Row ${index + 1}] Updated ${student.name} (${rollNo}) — Descriptor vector length: ${descriptor.length}`);
      updatedCount++;
    } catch (err) {
      console.error(`❌ [Row ${index + 1}] (${rollNo}) Error updating student: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n==========================================');
  console.log('📊 ATTEND-AI Face Sync Summary');
  console.log('==========================================');
  console.log(`Total Entries : ${entries.length}`);
  console.log(`Updated       : ${updatedCount}`);
  console.log(`Skipped       : ${skippedCount}`);
  console.log(`Errors        : ${errorCount}`);
  console.log('==========================================\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Sync complete.');
};

runSync().catch(err => {
  console.error('Fatal sync error:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
