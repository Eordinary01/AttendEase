const Plan = require("../models/Plan");
const logger = require("../utils/logger");

const createPlan = async (req, res) => {
  try {
    const { name, code, description, pricing, limits, features, modules, sortOrder, isPopular, isActive } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Name and code are required" });
    }

    const existing = await Plan.findOne({ code });
    if (existing) {
      return res.status(409).json({ success: false, message: "Plan with this code already exists" });
    }

    const plan = await Plan.create({
      name, code: code.toLowerCase(), description,
      pricing: { monthly: pricing?.monthly || 0, yearly: pricing?.yearly || 0, currency: pricing?.currency || "INR" },
      limits: {
        maxStudents: limits?.maxStudents || 50, maxTeachers: limits?.maxTeachers || 5,
        maxAdmins: limits?.maxAdmins || 1, maxStorageMB: limits?.maxStorageMB || 100,
        maxAPIcallsPerDay: limits?.maxAPIcallsPerDay || 10000,
      },
      features: features || [],
      modules: {
        attendance: true,
        examManagement: modules?.examManagement || false,
        financeManagement: modules?.financeManagement || false,
        libraryManagement: modules?.libraryManagement || false,
        hrManagement: modules?.hrManagement || false,
        parentPortal: modules?.parentPortal || false,
        analytics: modules?.analytics || false,
        apiAccess: modules?.apiAccess || false,
        customBranding: modules?.customBranding || false,
        dataExport: modules?.dataExport || false,
        bulkOperations: modules?.bulkOperations || false,
        whiteLabel: modules?.whiteLabel || false,
        prioritySupport: modules?.prioritySupport || false,
        dedicatedSupport: modules?.dedicatedSupport || false,
      },
      sortOrder: sortOrder || 0,
      isPopular: isPopular || false,
      isActive: isActive !== undefined ? isActive : true,
    });

    return res.status(201).json({ success: true, data: plan });
  } catch (error) {
    logger.error("Error creating plan", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to create plan" });
  }
};

const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    const { name, description, pricing, limits, features, modules, sortOrder, isPopular, isActive } = req.body;

    if (name !== undefined) plan.name = name;
    if (description !== undefined) plan.description = description;
    if (pricing) {
      if (pricing.monthly !== undefined) plan.pricing.monthly = pricing.monthly;
      if (pricing.yearly !== undefined) plan.pricing.yearly = pricing.yearly;
      if (pricing.currency !== undefined) plan.pricing.currency = pricing.currency;
    }
    if (limits) {
      if (limits.maxStudents !== undefined) plan.limits.maxStudents = limits.maxStudents;
      if (limits.maxTeachers !== undefined) plan.limits.maxTeachers = limits.maxTeachers;
      if (limits.maxAdmins !== undefined) plan.limits.maxAdmins = limits.maxAdmins;
      if (limits.maxStorageMB !== undefined) plan.limits.maxStorageMB = limits.maxStorageMB;
      if (limits.maxAPIcallsPerDay !== undefined) plan.limits.maxAPIcallsPerDay = limits.maxAPIcallsPerDay;
    }
    if (features !== undefined) plan.features = features;
    if (modules) {
      Object.keys(modules).forEach(key => {
        if (modules[key] !== undefined && plan.modules[key] !== undefined) {
          plan.modules[key] = modules[key];
        }
      });
    }
    if (sortOrder !== undefined) plan.sortOrder = sortOrder;
    if (isPopular !== undefined) plan.isPopular = isPopular;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();
    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    logger.error("Error updating plan", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to update plan" });
  }
};

const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });

    plan.isActive = false;
    await plan.save();

    return res.status(200).json({ success: true, message: "Plan deactivated" });
  } catch (error) {
    logger.error("Error deleting plan", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to delete plan" });
  }
};

const getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id).lean();
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found" });
    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    logger.error("Error fetching plan", { error: error.message });
    return res.status(500).json({ success: false, message: "Failed to fetch plan" });
  }
};

module.exports = { createPlan, updatePlan, deletePlan, getPlanById };
