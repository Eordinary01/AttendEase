const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import the User model
const User = require("./models/User"); // Adjust path based on your project structure

/**
 * Seed Admin User - Enhanced Version
 * Creates a default admin user with environment variable support
 * Can be run multiple times - it's idempotent (won't create duplicates)
 */
const seedAdmin = async () => {
  const mongoURI = process.env.MONGO_URI;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME;

  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("✓ Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    
    if (existingAdmin) {
      console.log("\n⚠ Admin user already exists in the database!");
      console.log(`
  ===========================
  Existing Admin Details:
  ===========================
  Name: ${existingAdmin.name}
  Email: ${existingAdmin.email}
  Role: ${existingAdmin.role}
  ===========================
      `);
      await mongoose.connection.close();
      return;
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Create admin user object
    const adminUser = new User({
      name: adminName,
      email: adminEmail,
      password: hashedPassword,
      section: "Admin",
      role: "admin",
      rollNo: "ADMIN001",
      attendance: {
        totalAttended: 0,
        totalClasses: 0,
        overallPercentage: 0,
        absentClasses: 0
      }
    });

    // Save to database
    await adminUser.save();
    console.log("\n✓ Admin user created successfully!");
    console.log(`
    ===========================
    Admin Credentials Created:
    ===========================
    Name: ${adminUser.name}
    Email: ${adminUser.email}
    Password: ${adminPassword}
    Role: ${adminUser.role}
    Section: ${adminUser.section}
    Roll No: ${adminUser.rollNo}
    ===========================
    IMPORTANT: Please change this password after first login!
    ===========================
    `);

    // Close database connection
    await mongoose.connection.close();
    console.log("✓ Database connection closed\n");

  } catch (error) {
    console.error("\n✗ Error seeding admin:", error.message);
    if (error.code === 11000) {
      console.error("✗ Duplicate email already exists!");
    }
    process.exit(1);
  }
};

// Export for use in other files (optional)
module.exports = seedAdmin;

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedAdmin();
}