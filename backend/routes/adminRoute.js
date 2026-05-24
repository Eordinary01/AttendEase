/**
 * Admin Routes
 * All routes require both authentication AND admin authorization
 */

const express = require("express");
const adminRoute = express.Router();

// Import middleware
const { authenticateToken, adminAuth } = require("../middleware/auth");
const upload = require("../middleware/fileUpload");

// Import controllers
const {
  getAllTeachers,
  createTeacher,
  getAllSubjects,
  assignSubjectToTeacher,
  uploadEnrollments,
  getAllEnrollments, // ← Make sure this is imported
  getEnrollmentById,
  getEnrollmentsBySection,
  getMyEnrollment,
  getAssignmentsByTeacher,
  getAssignmentsBySubject,
  getAssignmentsBySection,
   getAllAssignments,
   

} = require("../controllers/adminController");

// ============ TEACHERS ============
adminRoute.get("/teachers", authenticateToken, adminAuth, getAllTeachers);
adminRoute.post("/create-teacher", authenticateToken, adminAuth, createTeacher);

// ============ SUBJECTS ============
adminRoute.get("/subjects", authenticateToken, adminAuth, getAllSubjects);

// ============ ASSIGNMENTS ============
adminRoute.post(
  "/assign-subject",
  authenticateToken,
  adminAuth,
  assignSubjectToTeacher,
);
adminRoute.get("/assignments", authenticateToken, adminAuth, getAllAssignments);

adminRoute.get(
  "/assignments/teacher/:teacherId",
  authenticateToken,
  adminAuth,
  getAssignmentsByTeacher,
);

adminRoute.get(
  "/assignments/subject/:subjectId",
  authenticateToken,
  adminAuth,
  getAssignmentsBySubject,
);

adminRoute.get(
  "/assignments/section/:section",
  authenticateToken,
  adminAuth,
  getAssignmentsBySection,
);

// ============ ENROLLMENTS ============
adminRoute.get("/enrollments", authenticateToken, adminAuth, getAllEnrollments);
adminRoute.get(
  "/enrollments/:id",
  authenticateToken,
  adminAuth,
  getEnrollmentById,
);
adminRoute.get(
  "/enrollments/section/:section",
  authenticateToken,
  adminAuth,
  getEnrollmentsBySection,
);

// ============ UPLOAD ENROLLMENTS ============
adminRoute.post(
  "/upload-enrollments",
  authenticateToken,
  adminAuth,
  upload.single("file"),
  uploadEnrollments,
);

module.exports = adminRoute;
