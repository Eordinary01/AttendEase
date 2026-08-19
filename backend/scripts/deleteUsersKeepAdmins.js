const mongoose = require("mongoose");
require("dotenv").config();
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");

const cleanUsersKeepAdmins = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_dev";

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB successfully.");

    // 1. Fetch count by role
    const totalCount = await User.countDocuments();
    const keptUsers = await User.find({ role: { $in: ["super_admin", "admin"] } }).select("name email role _id tenantId");
    const usersToDeleteCount = await User.countDocuments({ role: { $nin: ["super_admin", "admin"] } });

    console.log(`Total users in DB before cleanup: ${totalCount}`);
    console.log(`Preserved admin users count: ${keptUsers.length}`);
    keptUsers.forEach(u => {
      console.log(`  - Preserved [${u.role}]: Name: ${u.name}, Email: ${u.email}, ID: ${u._id}`);
    });
    console.log(`Users to delete (students, teachers, etc.): ${usersToDeleteCount}`);

    if (usersToDeleteCount === 0) {
      console.log("No users to delete.");
      process.exit(0);
    }

    // 2. Perform deletion of non-admin, non-super-admin users
    const deleteResult = await User.deleteMany({ role: { $nin: ["super_admin", "admin"] } });
    console.log(`Successfully deleted ${deleteResult.deletedCount} user(s).`);

    // 3. Clean up orphan refresh tokens if RefreshToken model exists
    if (RefreshToken) {
      const keptUserIds = keptUsers.map(u => u._id);
      const tokenDeleteResult = await RefreshToken.deleteMany({ user: { $nin: keptUserIds } });
      console.log(`Cleaned up ${tokenDeleteResult.deletedCount} refresh token(s) belonging to deleted users.`);
    }

    // 4. Print remaining users
    const remainingUsers = await User.find().select("name email role tenantId");
    console.log("\nRemaining users in database:");
    remainingUsers.forEach(u => console.log(`  - Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`));

    process.exit(0);
  } catch (error) {
    console.error("Error during user cleanup:", error);
    process.exit(1);
  }
};

cleanUsersKeepAdmins();
