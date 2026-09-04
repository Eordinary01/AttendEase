/**
 * Role-based field selection for User objects in API responses.
 * Ensures students don't see teacher-specific fields, etc.
 */

const ROLE_FIELDS = {
  super_admin: [
    "_id", "name", "email", "role", "tenantId", "isActive", "avatar",
    "faceRegistered", "isFaceRegistered", "faceDescriptor", "faceImageUrl", "faceUpdatedAt",
    "lastLoginAt", "lastLoginIP", "twoFactorEnabled",
    "profileComplete", "isFirstLogin", "createdByAdmin",
    "tokenVersion", "emailVerified", "createdAt", "loginCount",
  ],
  admin: [
    "_id", "name", "email", "role", "tenantId", "isActive", "avatar",
    "section", "rollNo", "courseId", "courseName", "branch",
    "semester", "admissionYear", "academicYear", "totalSemesters",
    "academicStatus", "holdPromotion",
    "faceRegistered", "isFaceRegistered", "faceDescriptor", "faceImageUrl", "faceUpdatedAt",
    "parentName", "parentPhone", "parentEmail",
    "attendance", "subjectAttendance",
    "phone", "address",
    "assignedSubjects", "assignmentsBySection", "teachingSections",
    "qualification", "specialization",
    "lastLoginAt", "lastLoginIP", "twoFactorEnabled",
    "profileComplete", "isFirstLogin", "createdByAdmin",
    "tokenVersion", "emailVerified", "createdAt", "loginCount",
  ],
  teacher: [
    "_id", "name", "email", "role", "tenantId", "isActive", "avatar",
    "rollNo", "section", "courseId", "courseName", "branch", "semester",
    "faceRegistered", "isFaceRegistered", "faceDescriptor", "faceImageUrl", "faceUpdatedAt",
    "assignedSubjects", "assignmentsBySection", "teachingSections",
    "qualification", "specialization",
    "joiningDate", "customRoles", "phone", "address",
    "profileComplete", "isFirstLogin", "createdByAdmin", "lastLoginAt", "lastLoginIP",
    "twoFactorEnabled", "tokenVersion", "emailVerified", "createdAt",
    "loginCount",
  ],
  student: [
    "_id", "name", "email", "role", "tenantId", "isActive", "avatar",
    "section", "rollNo", "courseId", "courseName", "branch",
    "semester", "admissionYear", "academicYear", "totalSemesters",
    "faceRegistered", "isFaceRegistered", "faceDescriptor", "faceImageUrl", "faceUpdatedAt",
    "holdPromotion", "academicStatus", "parentName", "parentPhone",
    "parentEmail", "attendance", "subjectAttendance", "phone",
    "address", "profileComplete", "isFirstLogin", "createdByAdmin", "lastLoginAt", "lastLoginIP",
    "twoFactorEnabled", "tokenVersion", "emailVerified", "createdAt",
    "loginCount",
  ],
  parent: [
    "_id", "name", "email", "role", "tenantId", "isActive", "avatar",
    "section", "rollNo", "courseId", "courseName", "branch",
    "semester", "admissionYear", "academicYear", "totalSemesters",
    "faceRegistered", "isFaceRegistered",
    "parentName", "parentPhone", "parentEmail", "phone", "address",
    "studentName", "studentRollNo",
    "profileComplete", "isFirstLogin", "createdByAdmin",
    "lastLoginAt", "lastLoginIP", "twoFactorEnabled",
    "tokenVersion", "emailVerified", "createdAt",
  ],
};

function filterUserByRole(user, role) {
  if (!user) return user;
  if (typeof user.toObject === "function") {
    user = user.toObject();
  } else {
    user = { ...user };
  }
  const effectiveRole = user.role || role;
  const fields = ROLE_FIELDS[effectiveRole] || ROLE_FIELDS[role] || ["_id", "name", "email", "role"];
  const filtered = {};
  fields.forEach((field) => {
    if (user[field] !== undefined && user[field] !== null) {
      filtered[field] = user[field];
    }
  });
  filtered._id = user._id;
  return filtered;
}

function filterUsersByRole(users, role) {
  if (!Array.isArray(users)) return users;
  return users.map((u) => filterUserByRole(u, role));
}

module.exports = { filterUserByRole, filterUsersByRole, ROLE_FIELDS };
