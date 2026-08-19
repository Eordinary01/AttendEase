const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");

const dumpAll = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_dev";
  await mongoose.connect(mongoURI);

  const teachers = await User.find({ role: "teacher" }).lean();
  console.log(`Total Teachers in DB: ${teachers.length}\n`);

  for (const t of teachers) {
    console.log(`Teacher: "${t.name}" | Email: ${t.email} | tenantId: ${t.tenantId}`);
    if (!t.assignedSubjects || t.assignedSubjects.length === 0) {
      console.log(`   --> NO ASSIGNED SUBJECTS (assignedSubjects: [])`);
    } else {
      t.assignedSubjects.forEach((a, i) => {
        console.log(`   [${i+1}] Subject: "${a.subjectName}" (ID: ${a.subjectId}) | Section: "${a.section}"`);
      });
    }
    console.log("---------------------------------------------------");
  }

  process.exit(0);
};

dumpAll();
