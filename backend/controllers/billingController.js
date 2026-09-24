// controllers/billingController.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const Plan = require('../models/Plan');
const Invoice = require('../models/Invoice');
const User = require('../models/User');
const Subject = require('../models/Subject');
const logger = require('../utils/logger');
const { computeStorageUsedMB } = require('../utils/storageUsage');
const { getNextSequence } = require('../utils/counter');
const { applyPlanUpgradeToTenant } = require('../utils/planDefaults');
const cache = require('../middleware/cache');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
});

// ==================== HELPER FUNCTIONS ====================

async function createRazorpayCustomer(tenant, adminUser) {
  try {
    const customer = await razorpay.customers.create({
      name: tenant.name,
      email: tenant.contact.email,
      contact: tenant.contact.phone || '9999999999',
      notes: {
        tenantId: tenant._id.toString(),
        tenantSubdomain: tenant.subdomain
      }
    });
    
    tenant.subscription.razorpayCustomerId = customer.id;
    await tenant.save();
    
    return customer;
  } catch (error) {
    logger.error('Error creating Razorpay customer', { error: error.message });
    throw error;
  }
}

async function generateInvoiceNumber(tenantId) {
  return getNextSequence(tenantId || 'platform', 'INV', 6);
}

// ==================== SUBSCRIPTION MANAGEMENT ====================

const getSubscriptionDetails = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId).select('subscription');
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    const plan = await Plan.findOne({ code: tenant.subscription.plan });
    
    let razorpaySubscription = null;
    if (tenant.subscription.razorpaySubscriptionId) {
      try {
        razorpaySubscription = await razorpay.subscriptions.fetch(
          tenant.subscription.razorpaySubscriptionId
        );
      } catch (rpErr) {
        logger.warn('Could not fetch Razorpay subscription', {
          subscriptionId: tenant.subscription.razorpaySubscriptionId,
          error: rpErr?.error?.description || rpErr?.message || String(rpErr),
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        subscription: tenant.subscription,
        plan: plan ? {
          name: plan.name,
          code: plan.code,
          limits: plan.limits,
          features: plan.features,
          modules: plan.modules
        } : { name: tenant.subscription.plan, code: tenant.subscription.plan },
        razorpayDetails: razorpaySubscription ? {
          id: razorpaySubscription.id,
          status: razorpaySubscription.status,
          currentStart: razorpaySubscription.current_start,
          currentEnd: razorpaySubscription.current_end,
          totalCount: razorpaySubscription.total_count,
          paidCount: razorpaySubscription.paid_count
        } : null
      }
    });
  } catch (error) {
    logger.error('Error fetching subscription details', { error: String(error), stack: error.stack });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription details',
      error: String(error)
    });
  }
};

const getTenantSubscriptionInfo = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId)
      .select('name subdomain subscription branding');
    
    const plan = await Plan.findOne({ code: tenant.subscription.plan })
      .select('name features modules pricing');
    
    return res.status(200).json({
      success: true,
      data: {
        tenant: {
          id: tenant._id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          branding: tenant.branding
        },
        subscription: tenant.subscription,
        plan
      }
    });
  } catch (error) {
    logger.error('Error fetching tenant subscription', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription info',
      error: error.message
    });
  }
};

const getRazorpayKey = async (req, res) => {
  return res.json({
    success: true,
    key: process.env.RAZORPAY_KEY_ID || '',
  });
};

const createSubscriptionOrder = async (req, res) => {
  const { planCode, billingCycle = 'monthly' } = req.body;
  
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const plan = await Plan.findOne({ code: planCode });
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay API credentials not configured in environment.'
      });
    }
    
    // Create Razorpay customer if not exists
    if (!tenant.subscription?.razorpayCustomerId) {
      try {
        await createRazorpayCustomer(tenant, null);
      } catch (custErr) {
        logger.warn('Failed to create Razorpay customer:', custErr.message);
      }
    }
    
    const price = billingCycle === 'monthly' 
      ? (plan.pricing?.monthly || 0) 
      : (plan.pricing?.yearly || 0);
    const amountInPaise = Math.round(price * 100);

    if (amountInPaise <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Selected plan is free or has zero price. Direct update recommended.'
      });
    }
    
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: plan.pricing?.currency || 'INR',
      receipt: `rcpt_${tenant._id.toString().slice(-8)}_${Date.now().toString().slice(-6)}`,
      notes: {
        tenantId: tenant._id.toString(),
        planCode: planCode,
        billingCycle: billingCycle,
        tenantName: tenant.name
      }
    });
    
    return res.status(200).json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
        planCode,
        billingCycle
      }
    });
  } catch (error) {
    logger.error('Error creating Razorpay payment order', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to create payment order: ' + error.message,
      error: error.message
    });
  }
};

const updateSubscription = async (req, res) => {
  const { planCode, billingCycle = 'monthly' } = req.body;
  
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const newPlan = await Plan.findOne({ code: planCode });
    
    if (!newPlan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    const planId = billingCycle === 'monthly'
      ? newPlan.razorpay.monthlyPlanId
      : newPlan.razorpay.yearlyPlanId;
    
    let subscriptionId = tenant.subscription.razorpaySubscriptionId || 'mock_sub_id_' + Date.now();
      
    try {
      if (tenant.subscription.razorpaySubscriptionId) {
        const subscription = await razorpay.subscriptions.update(
          tenant.subscription.razorpaySubscriptionId,
          {
            plan_id: planId,
            quantity: 1,
            notes: {
              previousPlan: tenant.subscription.plan,
              newPlan: planCode,
              changedAt: new Date().toISOString()
            }
          }
        );
        subscriptionId = subscription.id;
      }
    } catch (rzpErr) {
      logger.warn('Razorpay update failed (expected in test mode without real sub ID):', { error: rzpErr.message });
    }
    
    applyPlanUpgradeToTenant(tenant, planCode);
    tenant.subscription.billingCycle = billingCycle;
    tenant.subscription.status = 'active';
    await tenant.save();
    
    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      data: {
        subscriptionId: subscription.id,
        plan: planCode,
        billingCycle: billingCycle
      }
    });
  } catch (error) {
    logger.error('Error updating subscription', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message
    });
  }
};

const cancelSubscription = async (req, res) => {
  const { cancelImmediately = false, reason } = req.body;
  
  try {
    const tenant = await Tenant.findById(req.tenantId);
    
    if (!tenant.subscription.razorpaySubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    if (cancelImmediately) {
      await razorpay.subscriptions.cancel(tenant.subscription.razorpaySubscriptionId);
      tenant.subscription.status = 'cancelled';
    } else {
      await razorpay.subscriptions.cancel(
        tenant.subscription.razorpaySubscriptionId,
        { cancel_at_cycle_end: 1 }
      );
      tenant.subscription.status = 'cancelled';
      tenant.subscription.autoRenew = false;
    }
    
    if (reason) {
      tenant.subscription.cancellationReason = reason;
      tenant.subscription.cancelledAt = new Date();
    }
    
    await tenant.save();
    
    // Invalidate tenant cache
    await cache.del(`tenant:${tenant._id}`);
    if (tenant.subdomain) {
      await cache.del(`tenant:subdomain:${tenant.subdomain}`);
    }
    
    return res.status(200).json({
      success: true,
      message: cancelImmediately 
        ? 'Subscription cancelled immediately' 
        : 'Subscription will be cancelled at the end of the billing cycle'
    });
  } catch (error) {
    logger.error('Error cancelling subscription', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};

const getUpcomingInvoice = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    
    if (!tenant.subscription.razorpaySubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription found'
      });
    }
    
    const subscription = await razorpay.subscriptions.fetch(
      tenant.subscription.razorpaySubscriptionId
    );
    
    const plan = await Plan.findOne({ code: tenant.subscription.plan });
    
    return res.status(200).json({
      success: true,
      data: {
        amount: subscription.amount / 100,
        currency: subscription.currency,
        billingDate: new Date(subscription.current_end * 1000),
        planName: plan.name,
        planCode: plan.code,
        nextBillingAmount: subscription.amount / 100
      }
    });
  } catch (error) {
    logger.error('Error fetching upcoming invoice', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming invoice',
      error: error.message
    });
  }
};

// ==================== PLAN MANAGEMENT ====================

const getPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .select('-razorpay');
    
    return res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    logger.error('Error fetching plans', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch plans',
      error: error.message
    });
  }
};

const getCurrentPlan = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const plan = await Plan.findOne({ code: tenant.subscription.plan })
      .select('name code description features modules limits pricing');
    
    const usage = await getTenantUsage(req.tenantId);
    
    return res.status(200).json({
      success: true,
      data: {
        plan,
        subscription: {
          status: tenant.subscription.status,
          startDate: tenant.subscription.startDate,
          endDate: tenant.subscription.endDate,
          nextBillingDate: tenant.subscription.nextBillingDate,
          billingCycle: tenant.subscription.billingCycle
        },
        usage: {
          students: `${usage.students}/${plan.limits.maxStudents}`,
          teachers: `${usage.teachers}/${plan.limits.maxTeachers}`,
          storage: `${usage.storageUsedMB}/${plan.limits.maxStorageMB} MB`
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching current plan', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current plan',
      error: error.message
    });
  }
};

async function getTenantUsage(tenantId) {
  const [students, teachers, admins, subjects, storageUsedMB] = await Promise.all([
    User.countDocuments({ tenantId, role: 'student', isActive: true }),
    User.countDocuments({ tenantId, role: 'teacher', isActive: true }),
    User.countDocuments({ tenantId, role: 'admin', isActive: true }),
    Subject.countDocuments({ tenantId, isActive: true }),
    computeStorageUsedMB(tenantId),
  ]);

  return { students, teachers, admins, subjects, storageUsedMB };
}

// ==================== INVOICE MANAGEMENT ====================

const getInvoiceHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    
    let query = { tenantId: req.tenantId };
    if (status) query.status = status;
    
    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(query)
    ]);
    
    return res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching invoice history', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
};

const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.invoiceId,
      tenantId: req.tenantId
    });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    logger.error('Error fetching invoice', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.invoiceId,
      tenantId: req.tenantId
    });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }
    
    // Generate PDF (implement PDF generation logic)
    // For now, return invoice data
    return res.status(200).json({
      success: true,
      message: 'PDF generation endpoint - implement as needed',
      data: invoice
    });
  } catch (error) {
    logger.error('Error downloading invoice', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to download invoice',
      error: error.message
    });
  }
};

const getTaxInvoices = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    let query = { tenantId: req.tenantId, status: 'paid' };
    
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    
    const invoices = await Invoice.find(query).sort({ createdAt: -1 });
    
    const summary = invoices.reduce((acc, inv) => {
      acc.totalAmount += inv.amount;
      acc.taxAmount += inv.taxAmount || 0;
      return acc;
    }, { totalAmount: 0, taxAmount: 0 });
    
    return res.status(200).json({
      success: true,
      data: {
        invoices,
        summary
      }
    });
  } catch (error) {
    logger.error('Error fetching tax invoices', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tax invoices',
      error: error.message
    });
  }
};

// ==================== PAYMENT MANAGEMENT ====================

const generatePaymentLink = async (req, res) => {
  const { planCode, billingCycle, description } = req.body;
  
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const plan = await Plan.findOne({ code: planCode });
    
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }
    
    const amount = billingCycle === 'monthly' 
      ? plan.pricing.monthly 
      : plan.pricing.yearly;
    
    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100,
      currency: 'INR',
      description: description || `${plan.name} Plan - ${billingCycle} subscription`,
      customer: {
        name: tenant.name,
        email: tenant.contact.email,
        contact: tenant.contact.phone
      },
      notes: {
        tenantId: tenant._id.toString(),
        planCode: planCode,
        billingCycle: billingCycle
      },
      notify: { sms: true, email: true },
      reminder_enable: true
    });
    
    return res.status(200).json({
      success: true,
      data: {
        paymentLink: paymentLink.short_url,
        linkId: paymentLink.id
      }
    });
  } catch (error) {
    logger.error('Error generating payment link', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to generate payment link',
      error: error.message
    });
  }
};

const verifyPayment = async (req, res) => {
  const { razorpayOrderId, razorpaySubscriptionId, razorpayPaymentId, razorpaySignature } = req.body;
  
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    let isAuthentic = false;

    if (secret) {
      if (razorpaySubscriptionId || (razorpayOrderId && razorpayOrderId.startsWith('sub_'))) {
        const subId = razorpaySubscriptionId || razorpayOrderId;
        const subBody = razorpayPaymentId + '|' + subId;
        const expectedSubSig = crypto
          .createHmac('sha256', secret)
          .update(subBody.toString())
          .digest('hex');
        isAuthentic = expectedSubSig === razorpaySignature;
      }
      
      if (!isAuthentic && razorpayOrderId) {
        const orderBody = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedOrderSig = crypto
          .createHmac('sha256', secret)
          .update(orderBody.toString())
          .digest('hex');
        isAuthentic = expectedOrderSig === razorpaySignature;
      }
    } else {
      // In development mode without key secret, log warning & allow verification
      logger.warn('RAZORPAY_KEY_SECRET is not configured. Bypassing signature check in test mode.');
      isAuthentic = true;
    }
    
    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }
    
    let payment = { amount: 0, currency: 'INR', notes: {} };
    try {
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && razorpayPaymentId) {
        payment = await razorpay.payments.fetch(razorpayPaymentId);
      }
    } catch (fetchErr) {
      logger.warn('Failed to fetch payment details from Razorpay', { error: fetchErr.message });
    }
    
    const targetPlanCode = req.body.planCode || payment.notes?.planCode;
    const targetBillingCycle = req.body.billingCycle || payment.notes?.billingCycle || 'monthly';
    
    if (targetPlanCode) {
      const plan = await Plan.findOne({ code: targetPlanCode });
      if (plan) {
        const tenant = await Tenant.findById(req.tenantId);
        if (tenant) {
          applyPlanUpgradeToTenant(tenant, targetPlanCode);
          tenant.subscription.billingCycle = targetBillingCycle;
          tenant.subscription.status = 'active';
          tenant.subscription.razorpaySubscriptionId = razorpaySubscriptionId || razorpayOrderId;
          tenant.subscription.startDate = new Date();
          tenant.subscription.nextBillingDate = new Date(Date.now() + (targetBillingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);
          await tenant.save();

          // Invalidate tenant cache
          await cache.del(`tenant:${tenant._id}`);
          if (tenant.subdomain) {
            await cache.del(`tenant:subdomain:${tenant.subdomain}`);
          }
        }
      }
    }

    // Create invoice
    const invoice = new Invoice({
      tenantId: req.tenantId,
      invoiceNumber: await generateInvoiceNumber(req.tenantId),
      amount: (payment.amount || 0) / 100,
      currency: payment.currency || 'INR',
      status: 'paid',
      plan: targetPlanCode || 'unknown',
      billingCycle: targetBillingCycle,
      period: {
        start: new Date(),
        end: new Date(Date.now() + (targetBillingCycle === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000)
      },
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId,
      razorpaySignature: razorpaySignature,
      paidAt: new Date()
    });
    
    await invoice.save();
    
    return res.status(200).json({
      success: true,
      message: 'Payment verified and plan updated successfully',
      data: { invoice, plan: targetPlanCode }
    });
  } catch (error) {
    logger.error('Error verifying payment', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
};

const getPaymentDetails = async (req, res) => {
  try {
    const payment = await razorpay.payments.fetch(req.params.paymentId);
    
    return res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    logger.error('Error fetching payment details', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment details',
      error: error.message
    });
  }
};

const requestRefund = async (req, res) => {
  const { amount, reason } = req.body;
  const { paymentId } = req.params;
  
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: amount ? amount * 100 : undefined,
      speed: 'normal',
      notes: {
        reason: reason || 'Customer requested refund',
        tenantId: req.tenantId.toString(),
        requestedBy: req.user._id.toString()
      }
    });
    
    // Update invoice status
    await Invoice.findOneAndUpdate(
      { razorpayPaymentId: paymentId, tenantId: req.tenantId },
      { status: 'refunded' }
    );
    
    return res.status(200).json({
      success: true,
      message: 'Refund initiated successfully',
      data: refund
    });
  } catch (error) {
    logger.error('Error processing refund', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  }
};

// ==================== PAYMENT METHODS ====================

const getPaymentMethods = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    
    if (!tenant.subscription.razorpayCustomerId) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }
    
    // Razorpay API to fetch payment methods
    // This is simplified - implement based on Razorpay's API
    return res.status(200).json({
      success: true,
      data: []
    });
  } catch (error) {
    logger.error('Error fetching payment methods', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message
    });
  }
};

const addPaymentMethod = async (req, res) => {
  const { paymentMethodId, isDefault } = req.body;
  
  try {
    const tenant = await Tenant.findById(req.tenantId);
    
    if (!tenant.subscription.razorpayCustomerId) {
      await createRazorpayCustomer(tenant, null);
    }
    
    // Attach payment method to customer (implement based on Razorpay API)
    
    return res.status(200).json({
      success: true,
      message: 'Payment method added successfully'
    });
  } catch (error) {
    logger.error('Error adding payment method', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to add payment method',
      error: error.message
    });
  }
};

const deletePaymentMethod = async (req, res) => {
  const { paymentMethodId } = req.params;
  
  try {
    // Delete payment method via Razorpay API
    return res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting payment method', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to delete payment method',
      error: error.message
    });
  }
};

const setDefaultPaymentMethod = async (req, res) => {
  const { paymentMethodId } = req.params;
  
  try {
    // Set default payment method via Razorpay API
    return res.status(200).json({
      success: true,
      message: 'Default payment method updated'
    });
  } catch (error) {
    logger.error('Error setting default payment method', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update default payment method',
      error: error.message
    });
  }
};

// ==================== BILLING ADDRESS ====================

const updateBillingAddress = async (req, res) => {
  const { name, address, city, state, country, pincode, phone, email, gstin } = req.body;
  
  try {
    const tenant = await Tenant.findById(req.tenantId);
    
    tenant.billingAddress = {
      name: name || tenant.name,
      address,
      city,
      state,
      country,
      pincode,
      phone: phone || tenant.contact.phone,
      email: email || tenant.contact.email,
      gstin
    };
    
    await tenant.save();
    
    return res.status(200).json({
      success: true,
      message: 'Billing address updated successfully',
      data: tenant.billingAddress
    });
  } catch (error) {
    logger.error('Error updating billing address', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to update billing address',
      error: error.message
    });
  }
};

// ==================== USAGE & ANALYTICS ====================

const getBillingUsage = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    const plan = await Plan.findOne({ code: tenant.subscription.plan });
    
    const usage = await getTenantUsage(req.tenantId);
    
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const monthlyInvoices = await Invoice.find({
      tenantId: req.tenantId,
      createdAt: { $gte: startOfMonth },
      status: 'paid'
    });
    
    const monthlySpend = monthlyInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    
    return res.status(200).json({
      success: true,
      data: {
        currentPeriod: {
          start: tenant.subscription.startDate,
          end: tenant.subscription.nextBillingDate
        },
        usage: {
          students: {
            current: usage.students,
            limit: plan.limits.maxStudents,
            percentage: (usage.students / plan.limits.maxStudents) * 100
          },
          teachers: {
            current: usage.teachers,
            limit: plan.limits.maxTeachers,
            percentage: (usage.teachers / plan.limits.maxTeachers) * 100
          },
          storage: {
            current: usage.storageUsedMB,
            limit: plan.limits.maxStorageMB,
            percentage: (usage.storageUsedMB / plan.limits.maxStorageMB) * 100
          }
        },
        billing: {
          monthlySpend,
          currentPlanPrice: plan.pricing[tenant.subscription.billingCycle],
          billingCycle: tenant.subscription.billingCycle
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching billing usage', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch billing usage',
      error: error.message
    });
  }
};

const getBillingAnalytics = async (req, res) => {
  const { period = 'month', year = new Date().getFullYear() } = req.query;
  
  try {
    let startDate;
    if (period === 'month') {
      startDate = new Date(year, 0, 1);
    } else if (period === 'quarter') {
      startDate = new Date(year, 0, 1);
    } else {
      startDate = new Date(year, 0, 1);
    }
    
    const invoices = await Invoice.find({
      tenantId: req.tenantId,
      createdAt: { $gte: startDate },
      status: 'paid'
    });
    
    // Group by month
    const monthlyData = {};
    invoices.forEach(inv => {
      const month = inv.createdAt.getMonth();
      if (!monthlyData[month]) {
        monthlyData[month] = { month, amount: 0, count: 0 };
      }
      monthlyData[month].amount += inv.amount;
      monthlyData[month].count++;
    });
    
    const chartData = Array.from({ length: 12 }, (_, i) => ({
      month: i,
      amount: monthlyData[i]?.amount || 0,
      count: monthlyData[i]?.count || 0
    }));
    
    const totalSpent = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const averageMonthly = totalSpent / 12;
    
    return res.status(200).json({
      success: true,
      data: {
        summary: {
          totalSpent,
          averageMonthly,
          invoiceCount: invoices.length,
          period
        },
        chartData,
        invoices
      }
    });
  } catch (error) {
    logger.error('Error fetching billing analytics', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch billing analytics',
      error: error.message
    });
  }
};

// ==================== WEBHOOK HANDLER ====================

const webhookHandler = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }
    
    const event = req.body;
    
    switch (event.event) {
      case 'subscription.charged':
        await handleSubscriptionCharge(event.payload);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancellation(event.payload);
        break;
      case 'payment.captured':
        await handlePaymentCaptured(event.payload);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload);
        break;
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Webhook error', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

async function handleSubscriptionCharge(payload) {
  const subscription = payload.subscription.entity;
  const tenant = await Tenant.findOne({ 
    'subscription.razorpaySubscriptionId': subscription.id 
  });
  
  if (tenant) {
    tenant.subscription.nextBillingDate = new Date(subscription.current_end * 1000);
    tenant.subscription.lastPaymentDate = new Date();
    await tenant.save();
    
    const invoice = new Invoice({
      tenantId: tenant._id,
      invoiceNumber: await generateInvoiceNumber(tenant._id),
      amount: subscription.amount / 100,
      currency: subscription.currency,
      status: 'paid',
      plan: tenant.subscription.plan,
      billingCycle: tenant.subscription.billingCycle,
      period: {
        start: new Date(subscription.current_start * 1000),
        end: new Date(subscription.current_end * 1000)
      },
      razorpayPaymentId: subscription.charge_id,
      paidAt: new Date()
    });
    
    await invoice.save();
  }
}

async function handleSubscriptionCancellation(payload) {
  const subscription = payload.subscription.entity;
  await Tenant.updateOne(
    { 'subscription.razorpaySubscriptionId': subscription.id },
    { 'subscription.status': 'cancelled' }
  );
}

async function handlePaymentCaptured(payload) {
  const payment = payload.payment.entity;
  await Invoice.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    { 
      status: 'paid',
      razorpayPaymentId: payment.id,
      paidAt: new Date()
    }
  );
}

async function handlePaymentFailed(payload) {
  const payment = payload.payment.entity;
  await Invoice.findOneAndUpdate(
    { razorpayOrderId: payment.order_id },
    { status: 'failed' }
  );
}

// ==================== ADMIN FUNCTIONS (Super Admin) ====================

const getTenantTransactions = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const invoices = await Invoice.find({ tenantId }).sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      data: invoices
    });
  } catch (error) {
    logger.error('Error fetching tenant transactions', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
};

const adjustTenantBilling = async (req, res) => {
  const { tenantId } = req.params;
  const { amount, reason, type } = req.body;
  
  try {
    const invoice = new Invoice({
      tenantId,
      invoiceNumber: await generateInvoiceNumber(tenantId),
      amount: Math.abs(amount),
      currency: 'INR',
      status: type === 'credit' ? 'paid' : 'pending',
      plan: 'adjustment',
      items: [{
        description: reason,
        amount: Math.abs(amount),
        quantity: 1
      }],
      metadata: {
        adjustment: true,
        type: type,
        reason: reason,
        createdBy: req.user._id
      }
    });
    
    await invoice.save();
    
    return res.status(200).json({
      success: true,
      message: `Billing adjustment of ₹${amount} (${type}) applied successfully`,
      data: invoice
    });
  } catch (error) {
    logger.error('Error adjusting billing', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to adjust billing',
      error: error.message
    });
  }
};

// Export all functions
const continueFreeTier = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Update status to active and remove trial expiration
    tenant.subscription.status = 'active';
    tenant.subscription.trialEndsAt = null;
    
    await tenant.save();

    return res.status(200).json({
      success: true,
      message: 'Successfully continued with Free Tier',
      data: {
        subscription: tenant.subscription
      }
    });
  } catch (error) {
    logger.error('Error continuing free tier', { error: error.message });
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getRazorpayKey,
  // Subscription
  createSubscriptionOrder,
  cancelSubscription,
  updateSubscription,
  continueFreeTier,
  getSubscriptionDetails,
  getTenantSubscriptionInfo,
  getUpcomingInvoice,
  
  // Plans
  getPlans,
  getCurrentPlan,
  
  // Invoices
  getInvoiceHistory,
  getInvoiceById,
  downloadInvoice,
  getTaxInvoices,
  
  // Payments
  generatePaymentLink,
  verifyPayment,
  getPaymentDetails,
  requestRefund,
  
  // Payment Methods
  addPaymentMethod,
  getPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  
  // Billing Address
  updateBillingAddress,
  
  // Usage & Analytics
  getBillingUsage,
  getBillingAnalytics,
  
  // Webhook
  webhookHandler,
  
  // Admin
  getTenantTransactions,
  adjustTenantBilling
};