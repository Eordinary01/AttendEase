const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: String,

    pricing: {
      monthly: { type: Number, required: true },
      yearly: { type: Number, required: true },
      currency: { type: String, default: "INR" },
    },

    razorpay: {
      monthlyPlanId: String,
      yearlyPlanId: String,
      productId: String,
    },

    limits: {
      maxStudents: Number,
      maxTeachers: Number,
      maxAdmins: Number,
      maxStorageMB: Number,
      maxAPIcallsPerDay: { type: Number, default: 10000 },
    },

    features: [
      {
        code: String,
        name: String,
        description: String,
        included: Boolean,
      },
    ],

    modules: {
      attendance: { type: Boolean, default: true },
      biometricAttendance: { type: Boolean, default: false },
      faceAttendance: { type: Boolean, default: false },
      examManagement: { type: Boolean, default: false },
      examStructure: { type: Boolean, default: false },
      examSeating: { type: Boolean, default: false },
      financeManagement: { type: Boolean, default: false },
      libraryManagement: { type: Boolean, default: false },
      hrManagement: { type: Boolean, default: false },
      parentPortal: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      customBranding: { type: Boolean, default: false },
      dataExport: { type: Boolean, default: false },
      bulkOperations: { type: Boolean, default: false },
      academicStructure: Boolean,
      whiteLabel: { type: Boolean, default: false },
      timetable: { type: Boolean, default: false },
      timetableManagement: { type: Boolean, default: false },
      customRoles: { type: Boolean, default: false },
      roleManagement: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      dedicatedSupport: { type: Boolean, default: false },
    },

    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isPopular: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Predefined plans
const defaultPlans = [
  {
    code: "free",
    name: "Free",
    pricing: { monthly: 0, yearly: 0 },
    limits: {
      maxStudents: 50,
      maxTeachers: 5,
      maxAdmins: 1,
      maxStorageMB: 1024,
    },
  },
  {
    code: "basic",
    name: "Basic",
    pricing: { monthly: 49, yearly: 499 },
    limits: {
      maxStudents: 200,
      maxTeachers: 20,
      maxAdmins: 3,
      maxStorageMB: 10240,
    },
  },
  {
    code: "professional",
    name: "Professional",
    pricing: { monthly: 149, yearly: 1499 },
    limits: {
      maxStudents: 1000,
      maxTeachers: 100,
      maxAdmins: 10,
      maxStorageMB: 51200,
    },
  },
  {
    code: "enterprise",
    name: "Enterprise",
    pricing: { monthly: 499, yearly: 4999 },
    limits: {
      maxStudents: 10000,
      maxTeachers: 1000,
      maxAdmins: 50,
      maxStorageMB: 512000,
    },
  },
];

planSchema.methods.getRazorpayPlanId = function (billingCycle) {
  if (billingCycle === "monthly") {
    return this.razorpay.monthlyPlanId;
  } else if (billingCycle === "yearly") {
    return this.razorpay.yearlyPlanId;
  }
  return null;
};

module.exports = mongoose.model("Plan", planSchema);
