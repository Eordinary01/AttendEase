const express = require("express");
const router = express.Router();
const { authenticateToken, adminAuth, teacherAuth, authorizeRoles } = require("../middleware/auth");
const { requirePermission } = require("../middleware/permission");
const { featureGuard } = require("../middleware/featureGuard");
const validate = require("../middleware/validate");
const {
  createExam,
  updateExam,
  bulkCreateExams,
  submitGrades,
  publishExamResults,
  unpublishExamResults,
  updateResult,
  getExams,
  updateExamStructure,
  updateExamPeriods,
} = require("../validators/exam");
const {
  createExam: createExamCtrl,
  getExams: getExamsCtrl,
  getExamById,
  updateExam: updateExamCtrl,
  deleteExam,
  submitGrades: submitGradesCtrl,
  publishExamResults: publishExamResultsCtrl,
  unpublishExamResults: unpublishExamResultsCtrl,
  updateResult: updateResultCtrl,
  getMyResults,
  getUpcomingExams,
  getGradeReport,
  getBacklogs,
  bulkCreateExams: bulkCreateExamsCtrl,
  getExamStructure,
  updateExamStructure: updateExamStructureCtrl,
  getExamPeriods,
  updateExamPeriods: updateExamPeriodsCtrl,
  getMyDuty,
} = require("../controllers/examController");

router.use(authenticateToken);

// Feature guard for exam management module
router.use(featureGuard("exam_management"));

// ─── Exam structure (Enterprise-only) ───
router.get("/structure", getExamStructure);
router.put("/structure", authorizeRoles(["admin"]), requirePermission("exam:update"), featureGuard("examStructure"), updateExamStructure, validate, updateExamStructureCtrl);

// ─── Exam periods (Enterprise-only) ───
router.get("/periods", getExamPeriods);
router.put("/periods", authorizeRoles(["admin"]), requirePermission("exam:update"), featureGuard("examStructure"), updateExamPeriods, validate, updateExamPeriodsCtrl);

// ─── Public student/teacher endpoints ───
router.get("/upcoming", getUpcomingExams);
router.get("/my-results", getMyResults);
router.get("/my-duty", getMyDuty);
router.get("/grade-report", getGradeReport);
router.get("/backlogs", authorizeRoles(["admin", "teacher"]), requirePermission("exam:read"), getBacklogs);

// ─── Get single exam (admin + teacher + student) ───
router.get("/:id", getExamById);

// ─── List exams (filtered) ───
router.get("/", getExams, getExamsCtrl);

// ─── Create / bulk / update / delete (admin + teacher) ───
router.post("/bulk", authorizeRoles(["admin", "teacher"]), featureGuard("bulk_operations"), requirePermission("exam:create"), bulkCreateExams, validate, bulkCreateExamsCtrl);
router.post("/", authorizeRoles(["admin", "teacher"]), requirePermission("exam:create"), createExam, validate, createExamCtrl);
router.put("/:id", authorizeRoles(["admin", "teacher"]), requirePermission("exam:update"), updateExam, validate, updateExamCtrl);
router.delete("/:id", authorizeRoles(["admin", "teacher"]), requirePermission("exam:delete"), deleteExam);

// ─── Submit grades (bulk upload) ───
router.post("/:examId/grade", authorizeRoles(["admin", "teacher"]), requirePermission("exam:grade"), submitGrades, validate, submitGradesCtrl);

// ─── Result publication (admin + teacher with exam:publish permission) ───
router.post("/:examId/publish", authorizeRoles(["admin", "teacher"]), requirePermission("exam:publish"), publishExamResults, validate, publishExamResultsCtrl);
router.post("/:examId/unpublish", authorizeRoles(["admin", "teacher"]), requirePermission("exam:publish"), unpublishExamResults, validate, unpublishExamResultsCtrl);

// ─── Individual result update (only updates; creation is bulk-only) ───
router.put("/:examId/results/:studentId", authorizeRoles(["admin", "teacher"]), requirePermission("exam:grade"), updateResult, validate, updateResultCtrl);

module.exports = router;
