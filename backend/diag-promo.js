require('dotenv').config();
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI;

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('DB connected');

    const User = require('./models/User');
    const Course = require('./models/Course');

    const totalStudents = await User.countDocuments({ role: 'student' });
    const activeStudents = await User.countDocuments({ role: 'student', isActive: true, academicStatus: { $ne: 'graduated' } });
    const graduated = await User.countDocuments({ role: 'student', academicStatus: 'graduated' });
    console.log(`\nTotal students: ${totalStudents}`);
    console.log(`Active (non-graduated): ${activeStudents}`);
    console.log(`Graduated: ${graduated}`);

    // Semester distribution
    const semDist = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$semester', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    console.log('\nSemester distribution:');
    semDist.forEach(r => console.log(`  Semester ${r._id}: ${r.count} students`));

    // Missing critical fields
    const missingAdmissionYear = await User.countDocuments({ role: 'student', $or: [{ admissionYear: null }, { admissionYear: { $exists: false } }] });
    const missingCourseId = await User.countDocuments({ role: 'student', $or: [{ courseId: null }, { courseId: { $exists: false } }] });
    const missingTotalSemesters = await User.countDocuments({ role: 'student', $or: [{ totalSemesters: null }, { totalSemesters: { $exists: false } }] });
    const holdPromotionCount = await User.countDocuments({ role: 'student', holdPromotion: true });
    console.log(`\nMissing admissionYear: ${missingAdmissionYear}`);
    console.log(`Missing courseId: ${missingCourseId}`);
    console.log(`Missing totalSemesters: ${missingTotalSemesters}`);
    console.log(`holdPromotion=true: ${holdPromotionCount}`);

    // lastPromotedAt distribution
    const lastPromoted = await User.aggregate([
      { $match: { role: 'student', lastPromotedAt: { $ne: null } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastPromotedAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      { $limit: 10 }
    ]);
    console.log('\nlastPromotedAt distribution (recent 10):');
    lastPromoted.forEach(r => console.log(`  ${r._id}: ${r.count} students`));

    // Students at semester cap (totalSemesters == semester)
    const atCap = await User.countDocuments({ role: 'student', $expr: { $eq: ['$semester', '$totalSemesters'] } });
    console.log(`\nStudents at semester cap (semester == totalSemesters): ${atCap}`);

    // Sample: first 10 active students with their fields
    const sample = await User.find({ role: 'student', isActive: true })
      .select('name rollNo section courseId branch semester admissionYear totalSemesters academicStatus holdPromotion lastPromotedAt')
      .limit(10)
      .lean();
    console.log('\nSample students (first 10):');
    sample.forEach(s => console.log(`  ${s.name} | roll=${s.rollNo} | sec=${s.section} | course=${s.courseId} | branch=${s.branch} | sem=${s.semester} | admYr=${s.admissionYear} | totalSem=${s.totalSemesters} | status=${s.academicStatus} | hold=${s.holdPromotion}`));

    // Courses with their branches
    const courses = await Course.find({ isActive: true }).select('name code durationYears branches totalSemesters').lean();
    console.log('\nActive courses:');
    courses.forEach(c => {
      console.log(`  ${c.name} (${c.code}) | duration=${c.durationYears} | totalSemesters=${c.totalSemesters}`);
      c.branches?.forEach(b => console.log(`    Branch: ${b.name} | totalSemesters=${b.totalSemesters}`));
    });

    // Now simulate the promotion context logic
    const structure = { semestersPerYear: 2, autoPromote: true, academicStartMonth: 5 };
    const now = new Date();
    console.log(`\n=== Promotion simulation (now: ${now.toISOString().split('T')[0]}) ===`);
    console.log(`academicStartMonth: ${structure.academicStartMonth} (May)`);

    let eligibleCount = 0, skippedDueToHold = 0, skippedMissingYear = 0, skippedNotDue = 0, willGraduate = 0, branchMissing = 0;
    const allActive = await User.find({ role: 'student', isActive: true, academicStatus: { $ne: 'graduated' } })
      .select('name rollNo semester admissionYear totalSemesters courseId branch holdPromotion')
      .lean();
    const courseMap = new Map(courses.map(c => [String(c._id), c]));

    for (const student of allActive) {
      if (student.holdPromotion) { skippedDueToHold++; continue; }
      if (!student.admissionYear) { skippedMissingYear++; continue; }

      const monthsPerSemester = 12 / 2; // 6 months
      const elapsed = now.getFullYear() * 12 + now.getMonth() - (Number(student.admissionYear) * 12 + structure.academicStartMonth);
      const expected = elapsed < 0 ? 1 : 1 + Math.floor(elapsed / monthsPerSemester);
      const current = student.semester || 1;

      if (expected <= current) { skippedNotDue++; continue; }

      // Determine totalSemesters
      let totalSem = student.totalSemesters;
      if (!totalSem) {
        const course = courseMap.get(String(student.courseId));
        if (!course) { branchMissing++; continue; }
        const branch = student.branch ? course.branches?.find(b => b.name.toLowerCase() === student.branch.toLowerCase()) : null;
        totalSem = branch ? branch.totalSemesters : course.durationYears * course.semestersPerYear;
      }

      if (totalSem && current >= totalSem) { willGraduate++; }
      else { eligibleCount++; }
    }

    console.log(`Eligible for promotion: ${eligibleCount}`);
    console.log(`Will graduate: ${willGraduate}`);
    console.log(`Skipped (holdPromotion): ${skippedDueToHold}`);
    console.log(`Skipped (missing admissionYear): ${skippedMissingYear}`);
    console.log(`Skipped (not yet due / already at expected): ${skippedNotDue}`);
    console.log(`Skipped (course not found for totalSem): ${branchMissing}`);

    // Show sample eligible students
    const eligibleSample = await User.find({ role: 'student', isActive: true, academicStatus: { $ne: 'graduated' }, holdPromotion: { $ne: true } })
      .select('name rollNo semester admissionYear totalSemesters courseId branch')
      .limit(20)
      .lean();

    console.log('\nSample of eligible students (simulated):');
    let shown = 0;
    for (const s of eligibleSample) {
      if (!s.admissionYear) continue;
      const elapsed = now.getFullYear() * 12 + now.getMonth() - (Number(s.admissionYear) * 12 + 5);
      const expected = elapsed < 0 ? 1 : 1 + Math.floor(elapsed / 6);
      const current = s.semester || 1;
      if (expected <= current) continue;

      let totalSem = s.totalSemesters;
      if (!totalSem) {
        const course = courseMap.get(String(s.courseId));
        if (!course) continue;
        const branch = s.branch ? course.branches?.find(b => b.name.toLowerCase() === s.branch.toLowerCase()) : null;
        totalSem = branch ? branch.totalSemesters : course.durationYears * 2;
      }

      if (shown < 10) {
        console.log(`  ${s.name} | sem=${s.semester} | admYr=${s.admissionYear} | exp=${expected} | totalSem=${totalSem} | willGrad=${current >= totalSem ? 'YES' : 'no'}`);
        shown++;
      }
    }

    // === EDGE CASES ===
    console.log('\n=== Edge case audit ===');
    const overshoot = await User.countDocuments({ role: 'student', isActive: true, academicStatus: { $ne: 'graduated' }, lastPromotedAt: { $ne: null } });
    console.log(`Students who have been promoted at least once (lastPromotedAt != null): ${overshoot}`);

    const nullSem = await User.countDocuments({ role: 'student', $or: [{ semester: null }, { semester: { $exists: false } }] });
    console.log(`Students with null semester: ${nullSem}`);

    const futureYear = await User.countDocuments({ role: 'student', admissionYear: { $gt: now.getFullYear() } });
    console.log(`Students with admissionYear > current year: ${futureYear}`);

    // Students with semester > totalSemesters (overshoot)
    const overshootSem = await User.countDocuments({ role: 'student', isActive: true, $expr: { $gt: ['$semester', '$totalSemesters'] } });
    console.log(`Students with semester > totalSemesters (overshoot): ${overshootSem}`);

    // Students with totalSemesters = 0 or negative
    const zeroTotalSem = await User.countDocuments({ role: 'student', $or: [{ totalSemesters: 0 }, { totalSemesters: { $lt: 0 } }] });
    console.log(`Students with totalSemesters <= 0: ${zeroTotalSem}`);

    await mongoose.disconnect();
    console.log('\nDone.');
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();
