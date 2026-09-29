const express = require("express");
const router = express.Router();
const { authenticateToken, adminAuth } = require("../middleware/auth");
const { featureGuard } = require("../middleware/featureGuard");
const validate = require("../middleware/validate");
const {
  createCourse,
  updateCourse,
  bulkCreateCourses,
  updateStructure,
  getCourses,
} = require("../validators/academic");
const {
  getCourses: getCoursesCtrl,
  createCourse: createCourseCtrl,
  bulkCreateCourses: bulkCreateCoursesCtrl,
  updateCourse: updateCourseCtrl,
  deleteCourse,
  getStructure,
  updateStructure: updateStructureCtrl,
  getPromotionPreview,
  promoteStudents,
  promoteStudentsBatch,
  getPromotionJobStatus,
  getPromotionAudit,
  getPromotionSettings,
  updatePromotionSettings,
  bulkAssignCourse,
  getSemesterTimeline,
} = require("../controllers/academicController");

// All routes require authentication
router.use(authenticateToken);

// Read-only (needed for student/subject forms across roles)
router.get("/courses", getCourses, getCoursesCtrl);
router.get("/structure", getStructure);

// Management surface — gated from Basic plan upward (academic_structure module)
router.post("/courses", adminAuth, featureGuard("academic_structure"), createCourse, createCourseCtrl);
router.post("/courses/bulk", adminAuth, featureGuard("academic_structure"), featureGuard("bulk_operations"), bulkCreateCourses, bulkCreateCoursesCtrl);
router.put("/courses/:id", adminAuth, featureGuard("academic_structure"), updateCourse, updateCourseCtrl);
router.delete("/courses/:id", adminAuth, featureGuard("academic_structure"), deleteCourse);
router.put("/structure", adminAuth, featureGuard("academic_structure"), updateStructure, updateStructureCtrl);

// Semester auto-increment (admin-triggered promotion)
router.get("/promotion-preview", adminAuth, featureGuard("academic_structure"), getPromotionPreview);
router.post("/promote", adminAuth, featureGuard("academic_structure"), promoteStudents);
router.post("/promote/batch", adminAuth, featureGuard("academic_structure"), promoteStudentsBatch);
router.get("/promote/status/:jobId", adminAuth, featureGuard("academic_structure"), getPromotionJobStatus);
router.get("/promote/audit", adminAuth, featureGuard("academic_structure"), getPromotionAudit);
router.get("/promote/settings", adminAuth, featureGuard("academic_structure"), getPromotionSettings);
router.post("/promote/settings", adminAuth, featureGuard("academic_structure"), updatePromotionSettings);

// Bulk student course assignment
router.post("/students/bulk-assign-course", adminAuth, featureGuard("academic_structure"), bulkAssignCourse);

// Semester timeline (read-only, all authenticated users)
router.get("/courses/:id/semester-timeline", getSemesterTimeline);

module.exports = router;