const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const Enrollment = require("../models/Enrollment");
const Attendance = require("../models/Attendance");

const cleanUsers = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_dev";

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB successfully.");

    // 1. Fetch count by role
    const allUsersCount = await User.countDocuments();
    const superAdmins = await User.find({ role: "super_admin" }).select("name email role _id");
    const nonSuperAdminsCount = await User.countDocuments({ role: { $ne: "super_admin" } });

    console.log(`Total users in DB: ${allUsersCount}`);
    console.log(`Super Admin count: ${superAdmins.length}`);
    if (superAdmins.length > 0) {
      console.log("Super Admin user(s):");
      superAdmins.forEach(sa => console.log(`  - ID: ${sa._id}, Name: ${sa.name}, Email: ${sa.email}`));
    } else {
      console.log("WARNING: No user with role 'super_admin' was found!");
    }
    console.log(`Non-super-admin users to delete: ${nonSuperAdminsCount}`);

    if (nonSuperAdminsCount === 0) {
      console.log("No non-super-admin users to delete.");
      process.exit(0);
    }

    // 2. Perform deletion of non-super_admin users
    const deleteResult = await User.deleteMany({ role: { $ne: "super_admin" } });
    console.log(`Successfully deleted ${deleteResult.deletedCount} user(s).`);

    // 3. Clean up orphan refresh tokens if any exist
    if (RefreshToken) {
      const superAdminIds = superAdmins.map(sa => sa._id);
      const tokenDeleteResult = await RefreshToken.deleteMany({ user: { $nin: superAdminIds } });
      console.log(`Cleaned up ${tokenDeleteResult.deletedCount} refresh token(s) belonging to deleted users.`);
    }

    // Print final status
    const remainingUsers = await User.find().select("name email role");
    console.log("\nRemaining users in database:");
    remainingUsers.forEach(u => console.log(`  - Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`));

    process.exit(0);
  } catch (error) {
    console.error("Error deleting non-super-admin users:", error);
    process.exit(1);
  }
};

cleanUsers();
