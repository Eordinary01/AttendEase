import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Lock, Loader2 } from "lucide-react";
import api from "../../utils/api";
import PricingModal from "./PricingModal";
import { useUpgradeModal } from "../../utils/billing";

let cachedPlanData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const moduleLabels = {
  examManagement: "Exam Management",
  financeManagement: "Fee Management",
  libraryManagement: "Library Management",
  hrManagement: "HR Management",
  parentPortal: "Parent Portal",
  analytics: "Analytics",
  customBranding: "Custom Branding",
  dataExport: "Data Export",
  bulkOperations: "Bulk Operations",
  academicStructure: "Academic Structure",
  whiteLabel: "White Label",
  apiAccess: "API Access",
  timetable: "Timetable Management",
  timetableManagement: "Timetable Management",
  customRoles: "Custom Roles & RBAC",
  roleManagement: "Custom Roles & RBAC",
  prioritySupport: "Priority Support",
  dedicatedSupport: "Dedicated Support",
};

const PlanGate = ({ requiredModule, children }) => {
  const [planModules, setPlanModules] = useState(null);
  const [loading, setLoading] = useState(true);
  const { modalProps, openUpgrade, setPlanCode } = useUpgradeModal();

  const role = localStorage.getItem("role");

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const now = Date.now();
      if (cachedPlanData && (now - cacheTimestamp) < CACHE_TTL) {
        setPlanModules(cachedPlanData.modules);
        setPlanCode(cachedPlanData.planCode);
        return;
      }

      const res = await api.get("/tenant/usage");
      if (res.data.success) {
        const modules = res.data.data?.plan?.modules || {};
        const planCode = res.data.data?.tenant?.subscription?.plan || null;
        setPlanModules(modules);
        setPlanCode(planCode);
        cachedPlanData = { modules, planCode };
        cacheTimestamp = now;
      }
    } catch (err) {
      setPlanModules({});
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (role === "super_admin") {
    return children;
  }

  if (planModules && !planModules[requiredModule]) {
    const label = moduleLabels[requiredModule] || requiredModule;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50/50 flex items-center justify-center"
      >
        <div className="max-w-md mx-auto px-6 py-12 text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">{label}</h2>
          <p className="text-gray-500 mb-6">
            This feature is not included in your current plan. Upgrade to unlock it.
          </p>
          <button
            onClick={() =>
              openUpgrade({
                resourceType: requiredModule,
                message: `Upgrade to unlock ${label}.`,
              })
            }
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition text-sm font-medium shadow-lg shadow-indigo-200"
          >
            <Crown className="w-5 h-5" /> Upgrade to Unlock
          </button>
          <PricingModal
            {...modalProps}
            onPlanChanged={() => {
              cachedPlanData = null;
              cacheTimestamp = 0;
              checkAccess();
            }}
          />
        </div>
      </motion.div>
    );
  }

  return children;
};

export default PlanGate;
