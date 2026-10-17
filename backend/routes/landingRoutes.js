// routes/landingRoutes.js
const express = require('express');
const router = express.Router();
const { optionalTenant } = require('../middleware/tenantResolver');
const Plan = require('../models/Plan');
const Lead = require("../models/Lead");
const logger = require("../utils/logger");

// Apply optional tenant resolution (for subdomain detection)
router.use(optionalTenant);

/**
 * GET /api/landing/
 * Landing page info - Public
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to ERP System',
    version: '2.0.0',
    features: [
      'Multi-tenant Support',
      'Attendance Management',
      'Exam Management',
      'Fee Management',
      'Library Management',
      'Parent Portal',
      'Analytics Dashboard',
      'Mobile App Support'
    ]
  });
});

/**
 * GET /api/landing/pricing
 * Get pricing plans for public display
 */
router.get('/pricing', async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .select('-razorpay -createdAt -updatedAt');

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Error fetching plans:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pricing plans'
    });
  }
});

/**
 * GET /api/landing/features
 * Get all features organized by module
 */
router.get('/features', (req, res) => {
  const features = {
    core: [
      { name: 'Student Management', description: 'Manage student profiles, enrollments, and records' },
      { name: 'Teacher Management', description: 'Teacher profiles, assignments, and schedules' },
      { name: 'Subject Management', description: 'Create and manage subjects, syllabi' },
      { name: 'Attendance Tracking', description: 'Real-time attendance with reports' }
    ],
    academic: [
      { name: 'Exam Management', description: 'Schedule exams, results, and analytics' },
      { name: 'Gradebook', description: 'Track grades and academic progress' },
      { name: 'Timetable', description: 'Class schedules and resource allocation' }
    ],
    finance: [
      { name: 'Fee Management', description: 'Collect and track fee payments' },
      { name: 'Payroll', description: 'Staff salary management' },
      { name: 'Expense Tracking', description: 'Track institutional expenses' }
    ],
    communication: [
      { name: 'Announcements', description: 'Send notifications to students and parents' },
      { name: 'Parent Portal', description: 'Parents can track child progress' },
      { name: 'Mobile App', description: 'Access on the go' }
    ],
    analytics: [
      { name: 'Dashboard', description: 'Real-time insights and analytics' },
      { name: 'Reports', description: 'Customizable reports and exports' },
      { name: 'Predictive Analytics', description: 'Student performance predictions' }
    ]
  };

  res.json({
    success: true,
    data: features
  });
});

/**
 * GET /api/landing/tenant-info
 * Get tenant info by subdomain (for login page)
 */
router.get('/tenant-info', async (req, res) => {
  try {
    const { subdomain } = req.query;
    const host = req.headers.host;
    
    let tenant = null;
    
    if (subdomain) {
      tenant = await Tenant.findOne({ 
        $or: [
          { subdomain: subdomain.toLowerCase() },
          { domain: subdomain.toLowerCase() }
        ],
        isActive: true 
      }).select('name subdomain branding subscription.plan');
    } else if (req.tenant) {
      tenant = req.tenant;
    }
    
    if (!tenant) {
      return res.json({
        success: true,
        hasTenant: false,
        message: 'No tenant found'
      });
    }

    const Plan = require('../models/Plan');
    const planCode = tenant.subscription?.plan || 'free';
    const plan = await Plan.findOne({ code: planCode }).lean();
    const planAllowsCustomBranding = plan?.modules?.customBranding ?? (['professional', 'enterprise'].includes(planCode));
    
    res.json({
      success: true,
      hasTenant: true,
      tenant: {
        id: tenant._id,
        name: tenant.branding?.institutionName || tenant.name,
        subdomain: tenant.subdomain,
        branding: tenant.branding || {},
        plan: planCode,
        hasCustomBranding: Boolean(planAllowsCustomBranding)
      }
    });
  } catch (error) {
    logger.error('Error fetching tenant info:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tenant information'
    });
  }
});

/**
 * POST /api/landing/contact and POST /api/landing/lead
 * Public prospective lead / inquiry submission
 */
router.post(['/contact', '/lead'], async (req, res) => {
  const { name, email, phone, message, institutionName, type, studentCount } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Name and email are required',
    });
  }
  
  try {
    const lead = await Lead.create({
      type: type === 'demo' ? 'demo' : 'contact',
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : undefined,
      institutionName: institutionName ? institutionName.trim() : 'General Inquiry',
      studentCount: studentCount ? String(studentCount) : undefined,
      message: message ? message.trim() : undefined,
      status: 'new',
    });
    
    logger.info('Inbound prospective lead created', { leadId: lead._id, type: lead.type });
    
    res.json({
      success: true,
      message: type === 'demo'
        ? 'Your demo request has been received. Our team will contact you shortly.'
        : 'Thank you for contacting us! We will get back to you soon.',
      data: { id: lead._id },
    });
  } catch (error) {
    logger.error('Error creating contact/lead', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to submit inquiry. Please try again.',
    });
  }
});

module.exports = router;