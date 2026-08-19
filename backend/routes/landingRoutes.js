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
    
    res.json({
      success: true,
      hasTenant: true,
      tenant: {
        id: tenant._id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        branding: tenant.branding,
        plan: tenant.subscription?.plan
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
 * POST /api/landing/contact
 * Contact form submission (public)
 */
router.post('/contact', async (req, res) => {
  const { name, email, phone, message, institutionName } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and message are required'
    });
  }
  
  try {
    const lead = await Lead.create({
      type: 'contact',
      name,
      email,
      phone,
      institutionName,
      message,
      status: 'new',
    });
    
    console.log('Contact lead created:', lead._id);
    
    res.json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
    });
  } catch (error) {
    logger.error('Error creating contact lead', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form',
    });
  }
});

/**
 * POST /api/landing/demo-request
 * Request a demo
 */
router.post('/demo-request', async (req, res) => {
  const { name, email, phone, institutionName, studentCount } = req.body;
  
  if (!name || !email || !institutionName) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and institution name are required'
    });
  }
  
  try {
    const lead = await Lead.create({
      type: 'demo',
      name,
      email,
      phone,
      institutionName,
      studentCount,
      status: 'new',
    });
    
    console.log('Demo lead created:', lead._id);
    
    res.json({
      success: true,
      message: 'Demo request received! We will contact you within 24 hours.',
    });
  } catch (error) {
    logger.error('Error creating demo lead', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to submit demo request',
    });
  }
});

module.exports = router;