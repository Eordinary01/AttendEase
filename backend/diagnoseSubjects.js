/**
 * Diagnostic script — run with: node diagnoseSubjects.js
 * Checks for corrupted subject data caused by the old normalization bugs.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Subject = require("./models/Subject");
const Course = require("./models/Course");

async function run() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_dev");
  console.log("Connected to MongoDB\n");

  const courses = await Course.find({ isActive: { $ne: false } }).lean();
  const subjects = await Subject.find({ isActive: true }).lean();

  const courseMapById = new Map(courses.map(c => [String(c._id), c]));
  const courseMapByCode = new Map(courses.map(c => [String(c.code).toUpperCase(), c]));

  const issues = {
    noCourse: [],
    wrongCourse: [],
    branchMismatch: [],
    staleBranch: [],
  };

  for (const s of subjects) {
    const course = s.courseId ? courseMapById.get(String(s.courseId)) : null;
    const courseByCode = s.courseCode ? courseMapByCode.get(String(s.courseCode).toUpperCase()) : null;

    // 1. Subject has no courseId at all
    if (!s.courseId) {
      issues.noCourse.push({
        subject: s.subjectName,
        code: s.subjectCode,
        courseCode: s.courseCode || "(empty)",
        branch: s.branch || "(empty)",
        semester: s.semester,
      });
      continue;
    }

    // 2. Subject's courseId points to a non-existent course
    if (!course) {
      issues.wrongCourse.push({
        subject: s.subjectName,
        code: s.subjectCode,
        courseId: String(s.courseId),
        courseCode: s.courseCode || "(empty)",
        branch: s.branch || "(empty)",
        problem: "courseId references a deleted/missing course",
      });
      continue;
    }

    // 3. Subject's courseCode doesn't match its courseId's course
    if (s.courseCode && courseByCode && String(courseByCode._id) !== String(s.courseId)) {
      issues.wrongCourse.push({
        subject: s.subjectName,
        code: s.subjectCode,
        courseCode: s.courseCode,
        assignedTo: `${course.code} (${course.name})`,
        shouldBe: `${courseByCode.code} (${courseByCode.name})`,
        branch: s.branch || "(empty)",
        problem: "courseCode points to a different course than courseId",
      });
      continue;
    }

    // 4. Subject's branch doesn't match any branch in its linked course
    if (s.branch && course.branches && course.branches.length > 0) {
      const branchMatch = course.branches.find(b =>
        String(b.name || "").toLowerCase() === String(s.branch).toLowerCase() ||
        String(b.code || "").toLowerCase() === String(s.branch).toLowerCase()
      );
      if (!branchMatch) {
        issues.branchMismatch.push({
          subject: s.subjectName,
          code: s.subjectCode,
          branch: s.branch,
          course: `${course.code} (${course.name})`,
          courseBranches: course.branches.map(b => `${b.name}${b.code ? ` [${b.code}]` : ""}`),
        });
      }
    }

    // 5. Subject has empty branch but its course has branches defined
    if ((!s.branch || !s.branch.trim()) && course.branches && course.branches.length > 0) {
      issues.staleBranch.push({
        subject: s.subjectName,
        code: s.subjectCode,
        course: `${course.code} (${course.name})`,
        courseBranches: course.branches.map(b => b.name),
        semester: s.semester,
      });
    }
  }

  console.log("=== DIAGNOSTIC RESULTS ===\n");

  console.log(`Total subjects: ${subjects.length}`);
  console.log(`Total courses: ${courses.length}\n`);

  if (issues.wrongCourse.length > 0) {
    console.log(`--- SUBJECTS WITH WRONG COURSE (${issues.wrongCourse.length}) ---`);
    console.log("These subjects were reassigned to the wrong course by the old normalization.\n");
    for (const i of issues.wrongCourse) {
      console.log(`  ${i.subject} (${i.code})`);
      console.log(`    Problem: ${i.problem}`);
      if (i.assignedTo) console.log(`    Currently in: ${i.assignedTo}`);
      if (i.shouldBe) console.log(`    Should be in: ${i.shouldBe}`);
      console.log(`    courseCode: ${i.courseCode} | branch: ${i.branch}`);
      console.log("");
    }
  }

  if (issues.branchMismatch.length > 0) {
    console.log(`--- SUBJECTS WITH WRONG BRANCH (${issues.branchMismatch.length}) ---`);
    console.log("These subjects have a branch that doesn't exist in their course.\n");
    for (const i of issues.branchMismatch) {
      console.log(`  ${i.subject} (${i.code})`);
      console.log(`    Branch: "${i.branch}" → not found in ${i.course}`);
      console.log(`    Valid branches: ${i.courseBranches.join(", ")}`);
      console.log("");
    }
  }

  if (issues.noCourse.length > 0) {
    console.log(`--- SUBJECTS WITH NO COURSE (${issues.noCourse.length}) ---`);
    console.log("These subjects have no courseId. They were NOT corrupted (just unlinked).\n");
    for (const i of issues.noCourse) {
      console.log(`  ${i.subject} (${i.code}) — courseCode: ${i.courseCode} | branch: ${i.branch} | sem: ${i.semester}`);
    }
    console.log("");
  }

  if (issues.staleBranch.length > 0) {
    console.log(`--- SUBJECTS WITH EMPTY BRANCH (${issues.staleBranch.length}) ---`);
    console.log("These subjects have no branch but their course has branches defined.\n");
    for (const i of issues.staleBranch) {
      console.log(`  ${i.subject} (${i.code}) — course: ${i.course} | valid: ${i.courseBranches.join(", ")} | sem: ${i.semester}`);
    }
    console.log("");
  }

  const totalIssues = issues.wrongCourse.length + issues.branchMismatch.length;
  if (totalIssues === 0) {
    console.log("No corruption detected. All subjects have valid courseId and branch values.");
  } else {
    console.log(`\n=== SUMMARY ===`);
    console.log(`${issues.wrongCourse.length} subjects with wrong course assignment`);
    console.log(`${issues.branchMismatch.length} subjects with invalid branch`);
    console.log(`${issues.noCourse.length} subjects with no course (not corrupted, just unlinked)`);
    console.log(`${issues.staleBranch.length} subjects with empty branch (need manual assignment)`);
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
