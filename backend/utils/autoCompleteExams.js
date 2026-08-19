const Exam = require('../models/Exam');
const Tenant = require('../models/Tenant');
const logger = require('./logger');

async function autoCompleteExams() {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Mark past exams (date before today) as completed
    const pastResult = await Exam.updateMany(
      {
        isActive: true,
        status: { $in: ['scheduled', 'in_progress'] },
        date: { $lt: startOfToday },
      },
      { $set: { status: 'completed' } }
    );

    // 2. Mark exams whose period has ended as completed
    const tenants = await Tenant.find({ 'settings.examPeriods': { $exists: true, $ne: [] } })
      .select('settings.examPeriods')
      .lean();

    let periodCount = 0;
    for (const tenant of tenants) {
      const periods = tenant.settings?.examPeriods || [];
      const endedPeriodIds = periods
        .filter(p => p.endDate && new Date(p.endDate) < startOfToday)
        .map(p => String(p._id));

      if (endedPeriodIds.length === 0) continue;

      const periodResult = await Exam.updateMany(
        {
          tenantId: tenant._id,
          isActive: true,
          status: { $in: ['scheduled', 'in_progress'] },
          examPeriodId: { $in: endedPeriodIds },
        },
        { $set: { status: 'completed' } }
      );
      periodCount += periodResult.modifiedCount;
    }

    // 3. Self-heal exams with missing semester / courseId from linked Subject
    const Subject = require('../models/Subject');
    const examsMissingSemester = await Exam.find({
      isActive: true,
      $or: [{ semester: null }, { semester: { $exists: false } }],
      subjectId: { $exists: true, $ne: null }
    }).select('_id subjectId tenantId');

    for (const ex of examsMissingSemester) {
      const sub = await Subject.findById(ex.subjectId).select('semester courseId branch').lean();
      if (sub && sub.semester) {
        const semNum = parseInt(String(sub.semester).replace(/\D/g, ''), 10);
        if (!isNaN(semNum) && semNum > 0) {
          await Exam.updateOne(
            { _id: ex._id },
            {
              $set: {
                semester: semNum,
                ...(sub.courseId ? { courseId: sub.courseId } : {}),
                ...(sub.branch ? { branch: sub.branch } : {})
              }
            }
          );
        }
      }
    }

    const total = pastResult.modifiedCount + periodCount;
    if (total > 0) {
      logger.info(`Auto-completed ${pastResult.modifiedCount} past exams, ${periodCount} period-ended exams`);
    }
  } catch (error) {
    logger.error('Error auto-completing exams', { error: error.message });
  }
}

module.exports = autoCompleteExams;
