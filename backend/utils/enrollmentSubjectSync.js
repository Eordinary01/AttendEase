const Subject = require("../models/Subject");

/**
 * Synchronizes and returns populated subjects for an enrollment based on curriculum matching
 */
async function syncEnrollmentSubjects(enrollmentDoc) {
  if (!enrollmentDoc) return [];

  const tenantId = enrollmentDoc.tenantId;
  const section = enrollmentDoc.section;
  const courseId = enrollmentDoc.courseId;
  const branch = enrollmentDoc.branch;
  const semester = enrollmentDoc.semester;

  if (!tenantId) return enrollmentDoc.subjects || [];

  let subjectQuery = { tenantId, isActive: true };
  if (courseId) {
    subjectQuery.$or = [
      { courseId: courseId },
      { courseId: null },
      { courseId: { $exists: false } }
    ];
  }

  const activeSubjects = await Subject.find(subjectQuery).lean();
  const sectionUpper = (section || "").trim().toUpperCase();

  const branchCodeMap = {
    "CHEM": ["CHEM", "CHEMISTRY"],
    "CHEMISTRY": ["CHEM", "CHEMISTRY"],
    "CSE": ["CSE", "COMPUTER SCIENCE", "COMPUTER SCIENCE & ENGINEERING"],
    "ME": ["ME", "MECHANICAL", "MECHANICAL ENGINEERING"],
    "ECE": ["ECE", "ELECTRONICS"],
    "CIVIL": ["CIVIL", "CIVIL ENGINEERING"]
  };

  const branchUpper = (branch || "").trim().toUpperCase();
  const allowedBranches = branchUpper ? (branchCodeMap[branchUpper] || [branchUpper]) : null;

  const matchedSubjects = activeSubjects.filter((sub) => {
    if (allowedBranches && (sub.branch || sub.department)) {
      const subBranchUpper = (sub.branch || sub.department).trim().toUpperCase();
      if (!allowedBranches.includes(subBranchUpper)) return false;
    }
    if (sub.semester && semester) {
      const subSemNum = parseInt(String(sub.semester).replace(/\D/g, ""), 10);
      const enrSemNum = parseInt(String(semester).replace(/\D/g, ""), 10);
      if (!isNaN(subSemNum) && !isNaN(enrSemNum) && subSemNum !== enrSemNum) return false;
    }
    return true;
  });

  const enrollmentSubjects = matchedSubjects.map((sub) => {
    const assigned = (sub.assignedTeachers || sub.sectionsAssigned || []).find(
      (a) => (a.section || "").trim().toUpperCase() === sectionUpper
    );

    return {
      subjectId: sub._id,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode || "",
      teacherId: assigned?.teacherId || sub.teacherId || null,
      teacherName: assigned?.teacherName || "Unassigned",
      assignedAt: sub.updatedAt || sub.createdAt || new Date(),
      isActive: sub.isActive !== false
    };
  });

  // Self-heal Enrollment document in database if subjects array is empty
  if (enrollmentDoc._id && (!enrollmentDoc.subjects || enrollmentDoc.subjects.length === 0) && enrollmentSubjects.length > 0) {
    const Enrollment = require("../models/Enrollment");
    Enrollment.updateOne(
      { _id: enrollmentDoc._id },
      { $set: { subjects: enrollmentSubjects } }
    ).catch(() => {});
  }

  return enrollmentSubjects;
}

module.exports = { syncEnrollmentSubjects };
