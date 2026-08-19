const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");

const checkAssignments = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_dev";
  await mongoose.connect(mongoURI);

  const teachers = await User.find({ role: "teacher" }).lean();
  console.log(`Total teachers in DB: ${teachers.length}`);

  teachers.forEach((t) => {
    console.log(`\nTeacher: ${t.name} (${t.email})`);
    console.log(`  assignedSubjects count: ${t.assignedSubjects?.length || 0}`);
    if (t.assignedSubjects?.length) {
      console.log(`  assignedSubjects:`, JSON.stringify(t.assignedSubjects, null, 2));
    }
  });

  process.exit(0);
};

checkAssignments();
