const mongoose = require('mongoose');
const logger = require('../utils/logger');

const tenantSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true, lowercase: true },
  domain: { type: String, unique: true, sparse: true },
  
  // Contact Info
  contact: {
    email: { type: String, required: true },
    phone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    pincode: String
  },
  
  // Subscription
  subscription: {
    plan: { 
      type: String, 
      enum: ['free', 'basic', 'professional', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'expired', 'trial'],
      default: 'trial'
    },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    // Razorpay specific
    razorpayCustomerId: String,
    razorpaySubscriptionId: String,
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    autoRenew: { type: Boolean, default: true },
    lastPaymentId: String,
    lastPaymentDate: Date,
    nextBillingDate: Date
  },
  
  // Limits (cached from Plan for performance)
  limits: {
    maxStudents: { type: Number, default: 50 },
    maxTeachers: { type: Number, default: 5 },
    maxAdmins: { type: Number, default: 1 },
    maxStorageMB: { type: Number, default: 1024 },
    features: [String]
  },
  
  // Branding
  branding: {
    logo: String,
    primaryColor: { type: String, default: '#6366f1' },
    secondaryColor: { type: String, default: '#8b5cf6' },
    accentColor: { type: String, default: '#6366f1' },
    institutionName: String,
    welcomeMessage: String,
    customMessage: String,
    bannerImage: String,
    favicon: String,
  },

  // College Compliance & Accreditation (Item 12)
  collegeMetadata: {
    institutionType: { type: String, enum: ['govt', 'private', 'autonomous', 'deemed', 'other'], default: 'private' },
    ugcCode: { type: String, trim: true, default: '' },
    naacGrade: { type: String, trim: true, default: '' },
    nirfEligible: { type: Boolean, default: false },
    aicteApproved: { type: Boolean, default: false },
  },
  
  // Settings
  settings: {
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    academicYearStart: Date,
    academicYearEnd: Date,
    enableParentPortal: { type: Boolean, default: false },
    enableOnlinePayments: { type: Boolean, default: false },
    lateFeePerDay: { type: Number, default: 1000 }, // INR per day after due date
    // Per-tenant feature flags (Item #13)
    featureFlags: { type: Map, of: Boolean, default: () => new Map() },
    // Academic structure / semester rules
    semesterStructure: {
      semestersPerYear: { type: Number, default: 2, enum: [1, 2] }, // 1 year = N semesters (default 2)
      autoPromote: { type: Boolean, default: true },               // auto-compute next semester on date rollover
      academicStartMonth: { type: Number, default: 5 },            // 0=Jan .. 5=Jun .. 11=Dec
    },
    // Exam structure (Enterprise only) — configurable exam types + shifts
    examStructure: {
      examTypes: [{
        name: { type: String, required: true },
        code: { type: String, required: true },
        defaultDuration: { type: Number, default: 75 },
        defaultMaxMarks: { type: Number, default: null },
        isActive: { type: Boolean, default: true },
      }],
      shifts: [{
        name: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        isActive: { type: Boolean, default: true },
      }],
    },
    // Exam periods — manually defined by admin
    examPeriods: [{
      name: { type: String, required: true },
      examTypeCode: { type: String },
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      isActive: { type: Boolean, default: true },
    }],
  },
  
  // Stats (denormalized for quick access)
  stats: {
    totalStudents: { type: Number, default: 0 },
    totalTeachers: { type: Number, default: 0 },
    totalAdmins: { type: Number, default: 0 },
    totalSubjects: { type: Number, default: 0 },
    storageUsedMB: { type: Number, default: 0 }
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isActive: { type: Boolean, default: true },
  deletedAt: Date
  
}, { timestamps: true });

// Indexes
tenantSchema.index({ subdomain: 1 });
tenantSchema.index({ domain: 1 });
tenantSchema.index({ 'subscription.status': 1 });
tenantSchema.index({ 'subscription.endDate': 1 });

// ========== ADD THE updateStats METHOD ==========
/**
 * Update tenant statistics by counting documents from related collections
 * This denormalizes counts for performance optimization
 */
tenantSchema.methods.updateStats = async function() {
  try {
    logger.debug(`Updating stats for tenant: ${this.name}`);
    
    // Import models dynamically to avoid circular dependencies
    const User = mongoose.model('User');
    
    // Get counts for different roles
    const [studentCount, teacherCount, adminCount] = await Promise.all([
      User.countDocuments({ 
        tenantId: this._id, 
        role: 'student',
        isActive: { $ne: false }
      }),
      User.countDocuments({ 
        tenantId: this._id, 
        role: 'teacher',
        isActive: { $ne: false }
      }),
      User.countDocuments({ 
        tenantId: this._id, 
        role: 'admin',
        isActive: { $ne: false }
      })
    ]);
    
    // Update stats
    this.stats.totalStudents = studentCount;
    this.stats.totalTeachers = teacherCount;
    this.stats.totalAdmins = adminCount;
    
    // If you have Subject or Course model, update those too
    try {
      const Subject = mongoose.model('Subject');
      const subjectCount = await Subject.countDocuments({ 
        tenantId: this._id,
        isActive: { $ne: false }
      });
      this.stats.totalSubjects = subjectCount;
    } catch (err) {
      // Subject model might not exist yet, skip gracefully
      logger.debug('Subject model not found, skipping subject count');
    }
    
    // Update the updatedAt timestamp
    this.updatedAt = new Date();
    
    // Save the tenant document
    await this.save();
    
    logger.debug(`Stats updated for tenant ${this.name}`, {
      students: studentCount,
      teachers: teacherCount,
      admins: adminCount
    });
    
    return this;
  } catch (error) {
    logger.error(`Error updating stats for tenant ${this._id}`, { error: error.message });
    throw error;
  }
};

tenantSchema.statics.updateAllStats = async function() {
  try {
    const tenants = await this.find({ isActive: true });
    logger.info(`Updating stats for ${tenants.length} tenants`);
    const results = await Promise.all(tenants.map(tenant => tenant.updateStats()));
    logger.info(`Stats updated for ${results.length} tenants`);
    return results;
  } catch (error) {
    logger.error('Error updating all tenant stats', { error: error.message });
    throw error;
  }
};
tenantSchema.pre('save', function(next) {
  // Ensure stats object exists
  if (!this.stats) {
    this.stats = {
      totalStudents: 0,
      totalTeachers: 0,
      totalAdmins: 0,
      totalSubjects: 0,
      storageUsedMB: 0
    };
  }
  
  // Ensure limits object exists with defaults
  if (!this.limits) {
    this.limits = {
      maxStudents: 50,
      maxTeachers: 5,
      maxAdmins: 1,
      maxStorageMB: 1024,
      features: []
    };
  }
  
  next();
});

// ========== ADD POST-SAVE HOOK FOR INITIAL STATS UPDATE ==========
tenantSchema.post('save', async function(doc, next) {
  // If this is a new tenant, initialize stats
  if (doc.isNew) {
    try {
      logger.debug(`New tenant created, initializing stats for: ${doc.name}`);
      await doc.updateStats();
    } catch (error) {
      logger.error('Error initializing tenant stats', { error: error.message });
    }
  }
  next();
});

module.exports = mongoose.model('Tenant', tenantSchema);