/**
 * Idempotent Seed Service for AttendEase Demo Sandbox
 * Creates/updates the dedicated demo tenant and accounts for:
 * 1. Demo Student
 * 2. Demo Teacher
 * 3. Demo Admin
 * 4. Demo Parent (linked to Demo Student)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Plan = require('../models/Plan');
const logger = require('../utils/logger');

async function seedDemoTenant() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set in environment.');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  logger.info('--- Seeding Demo Sandbox Tenant & Users ---');

  // 1. Ensure Enterprise plan exists in DB
  let enterprisePlan = await Plan.findOne({ code: 'enterprise' });
  if (!enterprisePlan) {
    enterprisePlan = await Plan.create({
      name: 'Enterprise Plan',
      code: 'enterprise',
      description: 'Full featured enterprise tier for demo sandbox',
      pricing: { monthly: 9999, yearly: 99999, currency: 'INR' },
      limits: {
        maxStudents: 10000,
        maxTeachers: 500,
        maxAdmins: 50,
        maxStorageMB: 51200,
        maxAPIcallsPerDay: 50000,
      },
      modules: {
        attendance: true,
        biometricAttendance: true,
        faceAttendance: true,
        examManagement: true,
        examStructure: true,
        examSeating: true,
        financeManagement: true,
        libraryManagement: true,
        hrManagement: true,
        parentPortal: true,
        analytics: true,
        apiAccess: true,
        customBranding: true,
        dataExport: true,
        bulkOperations: true,
        academicStructure: true,
        timetable: true,
        timetableManagement: true,
        customRoles: true,
        roleManagement: true,
        prioritySupport: true,
      },
    });
    logger.info('Created enterprise plan for demo');
  }

  // 2. Find or create demo tenant
  let demoTenant = await Tenant.findOne({
    $or: [{ subdomain: 'demo' }, { isDemo: true }]
  });

  const demoTenantData = {
    name: 'AttendEase Demo Academy',
    subdomain: 'demo',
    isDemo: true,
    isSandbox: true,
    contact: {
      email: 'demo@attendease.internal',
      phone: '9876543210',
      address: '100 Innovation Parkway',
      city: 'Tech Valley',
      state: 'Karnataka',
      country: 'India',
      pincode: '560100',
    },
    subscription: {
      plan: 'enterprise',
      status: 'active',
      startDate: new Date('2025-01-01'),
      endDate: new Date('2035-01-01'),
      trialEndsAt: new Date('2035-01-01'),
      billingCycle: 'yearly',
      autoRenew: true,
    },
    limits: enterprisePlan.limits,
    branding: {
      institutionName: 'AttendEase Demo Academy',
      primaryColor: '#6366f1',
      secondaryColor: '#8b5cf6',
      accentColor: '#10b981',
      welcomeMessage: 'Welcome to the AttendEase Demo Sandbox. Explore student, teacher, admin, and parent flows safely.',
    },
    collegeMetadata: {
      institutionType: 'autonomous',
      naacGrade: 'A++',
      nirfEligible: true,
      aicteApproved: true,
    },
    settings: {
      enableParentPortal: true,
      enableOnlinePayments: true,
      language: 'en',
      timezone: 'Asia/Kolkata',
      semesterStructure: {
        semestersPerYear: 2,
        autoPromote: true,
        academicStartMonth: 5,
      },
    },
    isActive: true,
  };

  if (!demoTenant) {
    demoTenant = await Tenant.create(demoTenantData);
    logger.info('Created new demo tenant: ' + demoTenant._id);
  } else {
    Object.assign(demoTenant, demoTenantData);
    await demoTenant.save();
    logger.info('Updated existing demo tenant: ' + demoTenant._id);
  }

  // 3. Common hashed dummy password for demo accounts
  const dummyPasswordHash = await bcrypt.hash('DemoPass@12345!', 10);

  // 4. Demo Admin User (create before subjects so demoAdmin._id is available)
  let demoAdmin = await User.findOne({ tenantId: demoTenant._id, role: 'admin' });
  const adminData = {
    name: 'Dr. Sarah Connor (Demo Admin)',
    email: 'admin.demo@attendease.internal',
    password: dummyPasswordHash,
    role: 'admin',
    tenantId: demoTenant._id,
    rollNo: 'ADM-DEMO-01',
    emailVerified: true,
    profileComplete: true,
    createdByAdmin: false,
    isFirstLogin: false,
    isActive: true,
  };
  if (!demoAdmin) {
    demoAdmin = await User.create(adminData);
    logger.info('Created demo admin: ' + demoAdmin.email);
  } else {
    Object.assign(demoAdmin, adminData);
    await demoAdmin.save();
  }

  // 5. Demo Subjects
  const subjectDefs = [
    { subjectName: 'Mathematics & Linear Algebra', subjectCode: 'MATH101', credits: 4, semester: '3' },
    { subjectName: 'Computer Architecture & Systems', subjectCode: 'CS201', credits: 4, semester: '3' },
    { subjectName: 'Object-Oriented Programming & Data Structures', subjectCode: 'CS202', credits: 4, semester: '3' },
    { subjectName: 'Physics for Modern Computing', subjectCode: 'PHY101', credits: 3, semester: '3' },
  ];

  const subjects = [];
  for (const s of subjectDefs) {
    let sub = await Subject.findOne({ tenantId: demoTenant._id, subjectCode: s.subjectCode });
    if (!sub) {
      sub = await Subject.create({
        ...s,
        tenantId: demoTenant._id,
        courseCode: 'CS',
        createdBy: demoAdmin._id,
        isActive: true,
      });
    }
    subjects.push(sub);
  }

  // 6. Demo Teacher User
  let demoTeacher = await User.findOne({ tenantId: demoTenant._id, role: 'teacher' });
  const teacherData = {
    name: 'Prof. Alan Turing (Demo Teacher)',
    email: 'teacher.demo@attendease.internal',
    password: dummyPasswordHash,
    role: 'teacher',
    tenantId: demoTenant._id,
    rollNo: 'TCH-DEMO-01',
    section: 'A',
    specialization: 'Theoretical Computer Science',
    qualification: 'Ph.D. Computer Science',
    assignedSubjects: subjects.map(sub => ({
      subjectId: sub._id,
      subjectName: sub.subjectName,
      section: 'A',
      assignedDate: new Date('2025-01-01'),
    })),
    emailVerified: true,
    profileComplete: true,
    createdByAdmin: true,
    isFirstLogin: false,
    isActive: true,
  };
  if (!demoTeacher) {
    demoTeacher = await User.create(teacherData);
    logger.info('Created demo teacher: ' + demoTeacher.email);
  } else {
    Object.assign(demoTeacher, teacherData);
    await demoTeacher.save();
  }

  // 7. Demo Student User (which also provides Parent linkage)
  let demoStudent = await User.findOne({ tenantId: demoTenant._id, role: 'student' });
  const studentData = {
    name: 'Alex Mercer (Demo Student)',
    email: 'student.demo@attendease.internal',
    password: dummyPasswordHash,
    role: 'student',
    tenantId: demoTenant._id,
    rollNo: 'STU-DEMO-01',
    section: 'A',
    parentName: 'Eleanor Mercer (Demo Parent)',
    parentEmail: 'parent.demo@attendease.internal',
    parentPhone: '9876543210',
    attendance: {
      totalClasses: 48,
      presentCount: 44,
      absentCount: 3,
      leaveCount: 1,
      overallPercentage: 91.6,
    },
    subjectAttendance: subjects.map(sub => ({
      subjectId: sub._id,
      subjectName: sub.subjectName,
      subjectCode: sub.subjectCode,
      totalClasses: 12,
      presentCount: 11,
      absentCount: 1,
      leaveCount: 0,
      percentage: 91.6,
      lastAttended: new Date(),
    })),
    emailVerified: true,
    profileComplete: true,
    createdByAdmin: true,
    isFirstLogin: false,
    isActive: true,
  };
  if (!demoStudent) {
    demoStudent = await User.create(studentData);
    logger.info('Created demo student: ' + demoStudent.email);
  } else {
    Object.assign(demoStudent, studentData);
    await demoStudent.save();
  }

  // Update demo tenant stats
  demoTenant.stats = {
    totalStudents: 1,
    totalTeachers: 1,
    totalAdmins: 1,
    totalSubjects: subjects.length,
    storageUsedMB: 5,
  };
  await demoTenant.save();

  logger.info('--- Demo Sandbox Seed Complete! ---');
  return {
    tenantId: demoTenant._id,
    subdomain: demoTenant.subdomain,
    adminId: demoAdmin._id,
    teacherId: demoTeacher._id,
    studentId: demoStudent._id,
    parentEmail: demoStudent.parentEmail,
  };
}

if (require.main === module) {
  seedDemoTenant()
    .then((res) => {
      console.log('Seed successful:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seedDemoTenant };
