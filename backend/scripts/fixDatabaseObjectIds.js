const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");
const Subject = require("../models/Subject");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");

const fixDatabaseObjectIds = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_dev";
  await mongoose.connect(mongoURI);
  console.log("Connected to MongoDB for DB migration fix...");

  // Fix Users
  const users = await User.collection.find({}).toArray();
  let usersFixed = 0;
  for (const u of users) {
    const updates = {};
    if (typeof u.tenantId === "string" && mongoose.Types.ObjectId.isValid(u.tenantId)) {
      updates.tenantId = new mongoose.Types.ObjectId(u.tenantId);
    }
    if (typeof u.courseId === "string" && mongoose.Types.ObjectId.isValid(u.courseId)) {
      updates.courseId = new mongoose.Types.ObjectId(u.courseId);
    }
    if (Object.keys(updates).length > 0) {
      await User.collection.updateOne({ _id: u._id }, { $set: updates });
      usersFixed++;
    }
  }
  console.log(`Updated ${usersFixed} user document(s) converting String IDs to ObjectIds.`);

  // Fix Subjects
  const subjects = await Subject.collection.find({}).toArray();
  let subjectsFixed = 0;
  for (const s of subjects) {
    const updates = {};
    if (typeof s.tenantId === "string" && mongoose.Types.ObjectId.isValid(s.tenantId)) {
      updates.tenantId = new mongoose.Types.ObjectId(s.tenantId);
    }
    if (typeof s.courseId === "string" && mongoose.Types.ObjectId.isValid(s.courseId)) {
      updates.courseId = new mongoose.Types.ObjectId(s.courseId);
    }
    if (typeof s.createdBy === "string" && mongoose.Types.ObjectId.isValid(s.createdBy)) {
      updates.createdBy = new mongoose.Types.ObjectId(s.createdBy);
    }
    if (Object.keys(updates).length > 0) {
      await Subject.collection.updateOne({ _id: s._id }, { $set: updates });
      subjectsFixed++;
    }
  }
  console.log(`Updated ${subjectsFixed} subject document(s) converting String IDs to ObjectIds.`);

  // Fix Courses
  const courses = await Course.collection.find({}).toArray();
  let coursesFixed = 0;
  for (const c of courses) {
    const updates = {};
    if (typeof c.tenantId === "string" && mongoose.Types.ObjectId.isValid(c.tenantId)) {
      updates.tenantId = new mongoose.Types.ObjectId(c.tenantId);
    }
    if (typeof c.createdBy === "string" && mongoose.Types.ObjectId.isValid(c.createdBy)) {
      updates.createdBy = new mongoose.Types.ObjectId(c.createdBy);
    }
    if (Object.keys(updates).length > 0) {
      await Course.collection.updateOne({ _id: c._id }, { $set: updates });
      coursesFixed++;
    }
  }
  console.log(`Updated ${coursesFixed} course document(s) converting String IDs to ObjectIds.`);

  // Fix Enrollments
  const enrollments = await Enrollment.collection.find({}).toArray();
  let enrollmentsFixed = 0;
  for (const e of enrollments) {
    const updates = {};
    if (typeof e.tenantId === "string" && mongoose.Types.ObjectId.isValid(e.tenantId)) {
      updates.tenantId = new mongoose.Types.ObjectId(e.tenantId);
    }
    if (typeof e.courseId === "string" && mongoose.Types.ObjectId.isValid(e.courseId)) {
      updates.courseId = new mongoose.Types.ObjectId(e.courseId);
    }
    if (typeof e.uploadedBy === "string" && mongoose.Types.ObjectId.isValid(e.uploadedBy)) {
      updates.uploadedBy = new mongoose.Types.ObjectId(e.uploadedBy);
    }
    if (Object.keys(updates).length > 0) {
      await Enrollment.collection.updateOne({ _id: e._id }, { $set: updates });
      enrollmentsFixed++;
    }
  }
  console.log(`Updated ${enrollmentsFixed} enrollment document(s) converting String IDs to ObjectIds.`);

  // Now test User.find() again
  const tenantIdStr = "6a8025dc363c10d25f11f04a";
  const teachersAfterFix = await User.find({ role: "teacher", tenantId: tenantIdStr });
  console.log(`\nAFTER FIX: User.find({ role: 'teacher', tenantId: '${tenantIdStr}' }) returned: ${teachersAfterFix.length} teachers!`);

  process.exit(0);
};

fixDatabaseObjectIds();
