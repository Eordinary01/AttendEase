require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

const BACKFILL_CHUNK = 300;

async function run() {
  const User = require('../models/User');
  const Course = require('../models/Course');

  const courses = await Course.find({ isActive: true }).lean();
  const courseMap = new Map(courses.map(c => [String(c._id), c]));

  const missingTotalSem = await User.countDocuments({
    role: 'student',
    $or: [{ totalSemesters: null }, { totalSemesters: { $exists: false } }, { totalSemesters: 0 }],
  });

  if (missingTotalSem === 0) {
    console.log('No students missing totalSemesters — nothing to backfill.');
    return;
  }

  console.log(`Students missing totalSemesters: ${missingTotalSem}`);

  let processed = 0, updated = 0, skipped = 0, lastId = null;

  while (processed < missingTotalSem) {
    const filter = {
      role: 'student',
      $or: [{ totalSemesters: null }, { totalSemesters: { $exists: false } }, { totalSemesters: 0 }],
    };
    if (lastId) filter._id = { $gt: lastId };

    const batch = await User.find(filter).sort({ _id: 1 }).limit(BACKFILL_CHUNK).select('courseId branch totalSemesters _id').lean();
    if (batch.length === 0) break;

    const ops = [];
    for (const student of batch) {
      const course = courseMap.get(String(student.courseId));
      if (!course) { skipped++; continue; }
      const branch = student.branch ? course.branches?.find(b => String(b.name).toLowerCase() === String(student.branch).toLowerCase()) : null;
      const totalSemesters = branch ? branch.totalSemesters : (course.durationYears || 3) * (course.semestersPerYear || 2);
      if (!totalSemesters || totalSemesters <= 0) { skipped++; continue; }
      ops.push({ updateOne: { filter: { _id: student._id }, update: { $set: { totalSemesters } } } });
    }

    if (ops.length > 0) {
      const result = await User.bulkWrite(ops, { ordered: false });
      updated += result.modifiedCount || 0;
    }

    processed += batch.length;
    lastId = batch[batch.length - 1]._id;
    console.log(`  chunk: ${processed}/${missingTotalSem} scanned, ${updated} updated, ${skipped} skipped`);
  }

  console.log(`\nBackfill complete: ${updated} updated, ${skipped} skipped`);
}

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('DB connected');
  try { await run(); }
  catch (e) { console.error('Backfill failed:', e.message); process.exit(1); }
  finally { await mongoose.disconnect(); console.log('Disconnected'); }
}).catch(e => { console.error('Connection failed:', e.message); process.exit(1); });
