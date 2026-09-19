const mongoose = require('mongoose');
const User = require('../models/User');
const CustomRole = require('../models/CustomRole');
const MentorAssignment = require('../models/MentorAssignment');
const { resolvePrimaryMentor } = require('../controllers/leaveController');

async function testRoleScopingOptionB() {
  console.log("=== TESTING OPTION B: CUSTOM ROLE & MENTOR ASSIGNMENT SCOPING ===");

  // 1. Verify User schema has the new fields on customRoles
  const customRolesPath = User.schema.path('customRoles');
  const schemaSubpaths = customRolesPath.schema.paths;
  console.log("User customRoles subpaths:", Object.keys(schemaSubpaths));

  if (!schemaSubpaths['courseId']) throw new Error("customRoles missing courseId");
  if (!schemaSubpaths['branch']) throw new Error("customRoles missing branch");
  if (!schemaSubpaths['semester']) throw new Error("customRoles missing semester");
  if (!schemaSubpaths['section']) throw new Error("customRoles missing section");
  if (!schemaSubpaths['isPrimary']) throw new Error("customRoles missing isPrimary");
  console.log("✅ User schema correctly supports academic scoping (courseId, branch, semester, section, isPrimary)");

  // 2. Validate customRole subdoc creation & query structure
  const testSubdoc = {
    roleId: new mongoose.Types.ObjectId(),
    courseId: new mongoose.Types.ObjectId(),
    branch: "Computer Science",
    semester: 4,
    section: "A",
    isPrimary: true,
  };

  const dummyUser = new User({
    name: "Dr. Mentor Faculty",
    email: "mentor.faculty@college.edu",
    password: "Password123!",
    role: "teacher",
    tenantId: new mongoose.Types.ObjectId(),
    customRoles: [testSubdoc],
  });

  if (dummyUser.customRoles[0].section !== "A") throw new Error("Subdoc section mismatch");
  if (dummyUser.customRoles[0].semester !== 4) throw new Error("Subdoc semester mismatch");
  if (dummyUser.customRoles[0].isPrimary !== true) throw new Error("Subdoc isPrimary mismatch");
  console.log("✅ User document successfully instantiates customRoles with academic cohort scoping");

  // 3. Validate MentorAssignment sync payload structure
  const mentorPayload = {
    tenantId: dummyUser.tenantId,
    teacherId: dummyUser._id,
    teacherName: dummyUser.name,
    teacherEmail: dummyUser.email,
    section: dummyUser.customRoles[0].section,
    courseId: dummyUser.customRoles[0].courseId,
    branch: dummyUser.customRoles[0].branch,
    semester: String(dummyUser.customRoles[0].semester),
    isPrimary: dummyUser.customRoles[0].isPrimary,
    isActive: true,
  };
  const dummyMentorDoc = new MentorAssignment(mentorPayload);
  const valError = dummyMentorDoc.validateSync();
  if (valError) throw new Error(`MentorAssignment validation error: ${valError.message}`);
  console.log("✅ MentorAssignment model accepts synced payload without schema validation errors");

  console.log("=== OPTION B BACKEND VALIDATIONS PASSED ===");
}

testRoleScopingOptionB()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
  });
