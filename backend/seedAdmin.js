const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import models
const User = require("./models/User");
const Tenant = require("./models/Tenant");
const Plan = require("./models/Plan");

/**
 * SEED SUPER ADMIN - For multi-tenant ERP system
 * Creates a super admin user with access to all tenants
 * Also creates default plans if they don't exist
 */
const seedSuperAdmin = async () => {
  const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_dev";
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  const superAdminName = process.env.SUPER_ADMIN_NAME || process.env.ADMIN_NAME || "Super Administrator";

  try {
    // Connect to MongoDB
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("✓ Connected to MongoDB");

    // ==================== 1. CREATE DEFAULT PLANS ====================
    console.log("\n📋 Checking default plans...");

    const plans = [
      {
        name: 'Free',
        code: 'free',
        description: 'Perfect for small institutions starting out',
        pricing: { monthly: 0, yearly: 0, currency: 'INR' },
        limits: {
          maxStudents: 50,
          maxTeachers: 5,
          maxAdmins: 1,
          maxStorageMB: 1024,
          maxAPIcallsPerDay: 10000
        },
        features: [
          { code: 'basic_attendance', name: 'Basic Attendance', included: true },
          { code: 'email_support', name: 'Email Support', included: true },
          { code: 'basic_reports', name: 'Basic Reports', included: true }
        ],
        modules: {
          attendance: true,
          timetable: false,
          timetableManagement: false,
          customRoles: false,
          roleManagement: false,
          examManagement: false,
          financeManagement: false,
          libraryManagement: false,
          hrManagement: false,
          parentPortal: false,
          analytics: false,
          apiAccess: false,
          customBranding: false,
          prioritySupport: false
        },
        sortOrder: 1,
        isActive: true,
        isPopular: false
      },
      {
        name: 'Basic',
        code: 'basic',
        description: 'Great for growing schools',
        pricing: { monthly: 49, yearly: 499, currency: 'INR' },
        limits: {
          maxStudents: 200,
          maxTeachers: 20,
          maxAdmins: 3,
          maxStorageMB: 10240,
          maxAPIcallsPerDay: 50000
        },
        features: [
          { code: 'advanced_attendance', name: 'Advanced Attendance', included: true },
          { code: 'timetable_management', name: 'Timetable Scheduling', included: true },
          { code: 'exam_management', name: 'Exam Management', included: true },
          { code: 'analytics', name: 'Analytics Dashboard', included: true },
          { code: 'priority_support', name: 'Priority Support', included: true },
          { code: 'data_export', name: 'Data Export', included: true }
        ],
        modules: {
          attendance: true,
          timetable: true,
          timetableManagement: true,
          customRoles: false,
          roleManagement: false,
          examManagement: true,
          financeManagement: false,
          libraryManagement: false,
          hrManagement: false,
          parentPortal: false,
          analytics: true,
          apiAccess: false,
          customBranding: false,
          prioritySupport: true
        },
        sortOrder: 2,
        isActive: true,
        isPopular: true
      },
      {
        name: 'Professional',
        code: 'professional',
        description: 'For large institutions',
        pricing: { monthly: 149, yearly: 1499, currency: 'INR' },
        limits: {
          maxStudents: 1000,
          maxTeachers: 100,
          maxAdmins: 10,
          maxStorageMB: 51200,
          maxAPIcallsPerDay: 200000
        },
        features: [
          { code: 'all_basic_features', name: 'All Basic Features', included: true },
          { code: 'custom_roles', name: 'Custom Roles & RBAC', included: true },
          { code: 'finance_management', name: 'Finance Management', included: true },
          { code: 'parent_portal', name: 'Parent Portal', included: true },
          { code: 'api_access', name: 'API Access', included: true },
          { code: 'custom_branding', name: 'Custom Branding', included: true }
        ],
        modules: {
          attendance: true,
          timetable: true,
          timetableManagement: true,
          customRoles: true,
          roleManagement: true,
          examManagement: true,
          financeManagement: true,
          libraryManagement: true,
          hrManagement: false,
          parentPortal: true,
          analytics: true,
          apiAccess: true,
          customBranding: true,
          prioritySupport: true
        },
        sortOrder: 3,
        isActive: true,
        isPopular: false
      },
      {
        name: 'Enterprise',
        code: 'enterprise',
        description: 'Complete ERP solution',
        pricing: { monthly: 499, yearly: 4999, currency: 'INR' },
        limits: {
          maxStudents: 10000,
          maxTeachers: 1000,
          maxAdmins: 50,
          maxStorageMB: 512000,
          maxAPIcallsPerDay: 1000000
        },
        features: [
          { code: 'all_features', name: 'All Features', included: true },
          { code: 'hr_management', name: 'HR Management', included: true },
          { code: 'library_management', name: 'Library Management', included: true },
          { code: 'white_label', name: 'White Label Solution', included: true },
          { code: 'dedicated_support', name: 'Dedicated Support', included: true }
        ],
        modules: {
          attendance: true,
          timetable: true,
          timetableManagement: true,
          customRoles: true,
          roleManagement: true,
          examManagement: true,
          financeManagement: true,
          libraryManagement: true,
          hrManagement: true,
          parentPortal: true,
          analytics: true,
          apiAccess: true,
          customBranding: true,
          prioritySupport: true
        },
        sortOrder: 4,
        isActive: true,
        isPopular: false
      }
    ];

    let plansCreated = 0;
    for (const planData of plans) {
      const existingPlan = await Plan.findOne({ code: planData.code });
      if (!existingPlan) {
        await Plan.create(planData);
        plansCreated++;
        console.log(`  ✓ Created plan: ${planData.name} (${planData.code})`);
      } else {
        existingPlan.modules = { ...existingPlan.modules, ...planData.modules };
        existingPlan.features = planData.features;
        await existingPlan.save();
        console.log(`  ✓ Updated modules & features for plan: ${planData.name} (${planData.code})`);
      }
    }
    console.log(`\n✓ Plans processed: ${plansCreated} new, ${plans.length - plansCreated} updated`);

    // Sync all existing tenants to their plan defaults
    const { getEffectiveLimits, getEffectiveModules } = require("./utils/planDefaults");
    const allTenants = await Tenant.find({});
    for (const t of allTenants) {
      t.limits = getEffectiveLimits(t.subscription?.plan, t.limits);
      t.modules = getEffectiveModules(t.subscription?.plan, t.modules);
      if (t.subscription?.status === 'active' || t.subscription?.plan !== 'free') {
        t.subscription.trialEndsAt = null;
      }
      await t.save();
    }
    console.log(`✓ Synced effective limits & modules for ${allTenants.length} existing tenant(s)`);

    // ==================== 2. CREATE SUPER ADMIN ====================
    console.log("\n👑 Checking super admin user...");

    // Check if super admin already exists
    const existingSuperAdmin = await User.findOne({
      $or: [
        { role: "super_admin" },
        { email: superAdminEmail, role: "admin" } // Fallback for existing admin
      ]
    });

    if (existingSuperAdmin) {
      console.log("\n⚠ Super admin already exists in the database!");
      console.log(`
  ═══════════════════════════════════════════════════════
  Existing Super Admin Details:
  ═══════════════════════════════════════════════════════
  Name: ${existingSuperAdmin.name}
  Email: ${existingSuperAdmin.email}
  Role: ${existingSuperAdmin.role || 'admin'}
  Status: ${existingSuperAdmin.isActive ? 'Active' : 'Inactive'}
  ═══════════════════════════════════════════════════════
      `);
    } else {
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(superAdminPassword, salt);

      // Create super admin user
      const superAdmin = new User({
        name: superAdminName,
        email: superAdminEmail,
        password: hashedPassword,
        section: "Super Admin",
        role: "super_admin",
        rollNo: "SA001",
        isActive: true,
        isFirstLogin: false,
        emailVerified: true,
        profileComplete: true,
        createdByAdmin: true,
        tenantId: null, // Super admin doesn't belong to any tenant

      });

      await superAdmin.save();
      console.log("\n✓ Super admin user created successfully!");
      console.log(`
  ═══════════════════════════════════════════════════════
  SUPER ADMIN CREDENTIALS:
  ═══════════════════════════════════════════════════════
  Name: ${superAdmin.name}
  Email: ${superAdmin.email}
  Password: ${superAdminPassword}
  Role: ${superAdmin.role}
  ═══════════════════════════════════════════════════════
  ⚠ IMPORTANT: Store these credentials securely!
  ⚠ This account has access to ALL tenants.
  ═══════════════════════════════════════════════════════
      `);
    }

    // ==================== 3. CREATE DEFAULT DEMO TENANT (Optional) ====================
    const createDemoTenant = process.env.CREATE_DEMO_TENANT === 'true';

    if (createDemoTenant) {
      console.log("\n🏫 Creating demo tenant...");

      const demoSubdomain = process.env.DEMO_SUBDOMAIN || "demo";
      const existingTenant = await Tenant.findOne({ subdomain: demoSubdomain });

      if (!existingTenant) {
        const freePlan = await Plan.findOne({ code: 'free' });

        const demoTenant = new Tenant({
          name: process.env.DEMO_TENANT_NAME || "Demo School",
          subdomain: demoSubdomain,
          contact: {
            email: process.env.DEMO_TENANT_EMAIL || "demo@school.com",
            phone: process.env.DEMO_TENANT_PHONE || "9999999999"
          },
          subscription: {
            plan: 'free',
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
          },
          limits: freePlan.limits,
          branding: {
            institutionName: process.env.DEMO_TENANT_NAME || "Demo School",
            primaryColor: "#6366f1",
            secondaryColor: "#8b5cf6"
          },
          isActive: true
        });

        await demoTenant.save();
        console.log(`  ✓ Demo tenant created: ${demoTenant.name} (${demoSubdomain}.${process.env.BASE_DOMAIN || 'localhost'})`);

        // Create demo admin user for the tenant
        const demoTenantAdmin = new User({
          name: "Demo Admin",
          email: "admin@demo.com",
          password: await bcrypt.hash("demo123", 10),
          role: "admin",
          tenantId: demoTenant._id,
          section: "Admin",
          rollNo: "ADMIN001",
          isActive: true,
          emailVerified: true
        });

        await demoTenantAdmin.save();
        console.log(`  ✓ Demo tenant admin created: admin@demo.com / demo123`);

      } else {
        console.log(`  ⚠ Demo tenant already exists: ${demoSubdomain}`);
      }
    }

    // ==================== 4. DISPLAY SUMMARY ====================
    console.log("\n╔═══════════════════════════════════════════════════════════════╗");
    console.log("║                    SEEDING COMPLETED SUCCESSFULLY              ║");
    console.log("╚═══════════════════════════════════════════════════════════════╝");

    // Get counts
    const totalUsers = await User.countDocuments();
    const totalTenants = await Tenant.countDocuments();
    const totalPlans = await Plan.countDocuments();

    console.log(`
  📊 DATABASE SUMMARY:
  ═══════════════════════════════════════════════════════
  Total Users: ${totalUsers}
  Total Tenants: ${totalTenants}
  Total Plans: ${totalPlans}
  ═══════════════════════════════════════════════════════
    `);

    // Close database connection
    await mongoose.connection.close();
    console.log("✓ Database connection closed\n");

  } catch (error) {
    console.error("\n✗ Error seeding database:", error.message);
    if (error.code === 11000) {
      console.error("✗ Duplicate key error - likely email already exists!");
    }
    process.exit(1);
  }
};

// Export for use in other files
module.exports = seedSuperAdmin;

// Run the seed function if this file is executed directly
if (require.main === module) {
  seedSuperAdmin();
}