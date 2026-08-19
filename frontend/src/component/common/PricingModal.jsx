// src/components/common/PricingModal.jsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import api from "../../utils/api";
import { logError } from "../../utils/logger";
import {
  X,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  Users,
  UserCog,
  GraduationCap,
  HardDrive,
  Star,
  Loader,
} from "lucide-react";
import { useTheme } from "../../contexts/ThemeContexts";
import {
  getResourceLabel,
  getRecommendedPlan,
} from "../../utils/billing";
import DowngradeWarningModal from "./DowngradeWarningModal";

/**
 * Reusable Pricing / Upgrade modal.
 *
 * Props:
 *  - isOpen, onClose
 *  - context: { resourceType, current, limit, message, requiredPlan } | null
 *      When triggered by a limit hit, this drives a tailored header banner.
 *  - currentPlanCode: "free" | "basic" | "professional" | "enterprise"
 *      Highlights the active plan with a "Current Plan" state.
 *  - onUpgrade(planCode, billingCycle): callback invoked when user selects a plan.
 *      (Left as a placeholder — wired to Razorpay in the next integration step.)
 *  - onPlanChanged(): optional callback fired after a successful plan change so the
 *      parent can re-fetch data without a hard page reload.
 */
const PricingModal = ({
  isOpen,
  onClose,
  context = null,
  currentPlanCode = null,
  onUpgrade,
  onPlanChanged,
}) => {
  const { colors } = useTheme();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [upgradingPlan, setUpgradingPlan] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [downgradeTargetPlan, setDowngradeTargetPlan] = useState(null);
  const [isDowngrading, setIsDowngrading] = useState(false);

  const PLAN_TIER_ORDER = useMemo(() => ["free", "basic", "professional", "enterprise"], []);
  const currentTierIndex = PLAN_TIER_ORDER.indexOf((currentPlanCode || "free").toLowerCase());

  const currentPlanObj = useMemo(() => {
    return (
      plans.find((p) => p.code.toLowerCase() === (currentPlanCode || "free").toLowerCase()) || {
        code: currentPlanCode || "free",
        name: (currentPlanCode || "free").charAt(0).toUpperCase() + (currentPlanCode || "free").slice(1),
        limits: {},
        modules: {},
      }
    );
  }, [plans, currentPlanCode]);

  const handleConfirmDowngrade = async () => {
    if (!downgradeTargetPlan) return;
    setIsDowngrading(true);
    try {
      await api.post('/billing/update-subscription', {
        planCode: downgradeTargetPlan.code,
        billingCycle
      });
      setSuccessMessage(`Subscription downgraded to ${downgradeTargetPlan.name} successfully.`);
      setDowngradeTargetPlan(null);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
        if (onPlanChanged) onPlanChanged();
      }, 1500);
    } catch (err) {
      logError("Downgrade Plan", err);
      setError("Failed to downgrade plan: " + (err.response?.data?.message || err.message));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsDowngrading(false);
    }
  };

  const razorpayLoaded = useRef(false);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        razorpayLoaded.current = true;
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        razorpayLoaded.current = true;
        resolve(true);
      };
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const themeColors = {
    primary: colors?.primary || "#6366f1",
    secondary: colors?.secondary || "#8b5cf6",
    light: colors?.primary ? `${colors.primary}15` : "#eef2ff",
  };

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/billing/plans');
      if (response.data.success) {
        setPlans(response.data.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
      setSuccessMessage(null);
    }
  }, [isOpen, fetchPlans]);

  const startRazorpayFlow = async (planCode) => {
    const loaded = await loadRazorpayScript();
    if (!loaded) throw new Error("Failed to load payment gateway script. Please try again.");

    const subRes = await api.post('/billing/create-subscription', { planCode, billingCycle });
    const { orderId, subscriptionId, amount, currency, key } = subRes.data.data;

    return new Promise((resolve, reject) => {
      const options = {
        key: key || process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: amount,
        currency: currency || "INR",
        name: "AttendEase",
        description: `${planCode.charAt(0).toUpperCase() + planCode.slice(1)} Plan (${billingCycle})`,
        handler: async (response) => {
          try {
            await api.post('/billing/verify-payment', {
              razorpayOrderId: response.razorpay_order_id || orderId,
              razorpaySubscriptionId: response.razorpay_subscription_id || subscriptionId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              planCode,
              billingCycle,
            });
            resolve(response);
          } catch (verifyErr) {
            logError("Verify Payment", verifyErr);
            reject(new Error(verifyErr.response?.data?.message || "Payment verification failed"));
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment cancelled by user")),
        },
      };

      if (orderId) {
        options.order_id = orderId;
      } else if (subscriptionId) {
        options.subscription_id = subscriptionId;
      }

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  };

  const handleSelectPlan = async (planCode) => {
    if (planCode === currentPlanCode) return;
    setUpgradingPlan(planCode);
    try {
      if (planCode === "free") {
        await api.post('/billing/update-subscription', { planCode, billingCycle });
      } else if (onUpgrade) {
        await onUpgrade(planCode, billingCycle);
      } else {
        await startRazorpayFlow(planCode);
      }
      setSuccessMessage(`Plan updated successfully!`);
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
        if (onPlanChanged) onPlanChanged();
      }, 1500);
    } catch (err) {
      logError("Update Plan", err);
      setError(err.message?.includes("cancelled") ? "Payment was cancelled." : "Payment failed: " + (err.response?.data?.message || err.message));
      setTimeout(() => setError(null), 5000);
    } finally {
      setUpgradingPlan(null);
    }
  };

  if (!isOpen) return null;

  const recommendedPlan =
    context?.requiredPlan ||
    getRecommendedPlan(currentPlanCode);

  const resourceLabel = context?.resourceType
    ? getResourceLabel(context.resourceType)
    : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 py-8 text-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0"
          onClick={onClose}
        />

        {/* Modal Panel */}
        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle max-w-6xl w-full relative">
          {/* Header */}
          <div
            className="px-6 py-5 border-b border-gray-100 flex items-start justify-between"
            style={{
              background: `linear-gradient(135deg, ${themeColors.primary}10, ${themeColors.secondary}10)`,
            }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles
                  className="w-5 h-5"
                  style={{ color: themeColors.primary }}
                />
                <h3 className="text-xl font-bold text-gray-900">
                  {context ? "Upgrade Your Plan" : "Choose Your Plan"}
                </h3>
              </div>
              <p className="text-sm text-gray-500">
                {context
                  ? "You've hit a limit on your current plan. Upgrade to continue."
                  : "Pick the plan that's right for your institution."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/60 rounded-full transition flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Limit hit banner */}
          {context && (
            <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">
                  {resourceLabel
                    ? `${resourceLabel} limit reached`
                    : "Plan limit reached"}
                  {context.current !== null &&
                    context.limit !== null &&
                    ` (${context.current}/${context.limit})`}
                </p>
                <p className="text-amber-700 mt-0.5">{context.message}</p>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-6">
            {/* Success banner */}
            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700 text-sm font-medium">
                <Check className="w-4 h-4 flex-shrink-0" />
                {successMessage}
              </div>
            )}
            {/* Error banner */}
            {!loading && error && !successMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {/* Billing cycle toggle */}
            {!loading && !error && !successMessage && plans.length > 0 && (
              <div className="flex justify-center mb-6">
                <div className="inline-flex bg-gray-100 rounded-full p-1">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition ${billingCycle === "monthly"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition flex items-center gap-1.5 ${billingCycle === "yearly"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                      }`}
                  >
                    Yearly
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                      Save ~15%
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
                <p className="text-gray-500 text-sm">Loading plans…</p>
              </div>
            )}

            {/* Error (initial load failure) — show retry prompt */}
            {!loading && error && plans.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
                  <AlertCircle className="w-7 h-7 text-red-500" />
                </div>
                <p className="text-gray-700 font-medium mb-1">
                  Couldn't load plans
                </p>
                <button
                  onClick={fetchPlans}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Plans grid */}
            {!loading && !error && !successMessage && plans.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {plans.map((plan) => {
                  const planOrderIndex = PLAN_TIER_ORDER.indexOf(plan.code.toLowerCase());
                  const isCurrent = plan.code.toLowerCase() === (currentPlanCode || "free").toLowerCase();
                  const isDowngrade = Boolean(currentPlanCode) && planOrderIndex < currentTierIndex;
                  const isUpgrade = !isCurrent && !isDowngrade;
                  const isRecommended = plan.code === recommendedPlan;
                  const price =
                    billingCycle === "yearly"
                      ? plan.pricing?.yearly
                      : plan.pricing?.monthly;

                  return (
                    <PlanCard
                      key={plan._id || plan.code}
                      plan={plan}
                      price={price}
                      billingCycle={billingCycle}
                      isCurrent={isCurrent}
                      isDowngrade={isDowngrade}
                      isUpgrade={isUpgrade}
                      isRecommended={isRecommended}
                      currentPlanCode={currentPlanCode}
                      themeColors={themeColors}
                      onSelect={() => {
                        if (isDowngrade) {
                          setDowngradeTargetPlan(plan);
                        } else if (isUpgrade) {
                          handleSelectPlan(plan.code);
                        }
                      }}
                      upgrading={upgradingPlan === plan.code}
                      upgradingAny={upgradingPlan !== null}
                    />
                  );
                })}
              </div>
            )}

            {!loading && !error && !successMessage && plans.length === 0 && (
              <div className="text-center py-16">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No plans are available right now.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-500">
              {currentPlanCode
                ? `Your current plan: ${currentPlanCode.charAt(0).toUpperCase() + currentPlanCode.slice(1)}`
                : "Prices shown in INR. Taxes may apply."}
            </p>
            <div className="flex gap-2">
              {context && context.subscriptionStatus === 'expired' && (
                <button
                  onClick={async () => {
                    try {
                      await api.post(`${process.env.REACT_APP_API_URL}/billing/continue-free`, {});
                      setSuccessMessage("Free tier resumed!");
                      setTimeout(() => {
                        setSuccessMessage(null);
                        onClose();
                        if (onPlanChanged) onPlanChanged();
                      }, 1500);
                    } catch (err) {
                      logError("Continue Free Tier", err);
                    }
                  }}
                  className="px-4 py-2 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-500 rounded-lg transition font-medium"
                >
                  Continue with Free Tier
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Downgrade Warning Modal */}
      <DowngradeWarningModal
        isOpen={downgradeTargetPlan !== null}
        onClose={() => setDowngradeTargetPlan(null)}
        currentPlan={currentPlanObj}
        targetPlan={downgradeTargetPlan}
        onConfirmDowngrade={handleConfirmDowngrade}
        isDowngrading={isDowngrading}
      />
    </div>
  );
};

// ===== Individual Plan Card =====
const formatPrice = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
};

const PlanCard = ({
  plan,
  price,
  billingCycle,
  isCurrent,
  isDowngrade,
  isUpgrade,
  isRecommended,
  currentPlanCode,
  themeColors,
  onSelect,
  upgrading,
  upgradingAny,
}) => {
  const isPopular = plan.isPopular;
  const highlight = isCurrent || isRecommended || isPopular;

  return (
    <div
      className={`relative rounded-2xl border-2 p-5 flex flex-col transition-all ${highlight
          ? "border-transparent shadow-lg"
          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
        }`}
      style={
        highlight
          ? {
            borderColor: themeColors.primary,
            boxShadow: `0 10px 25px -5px ${themeColors.primary}30`,
          }
          : undefined
      }
    >
      {/* Badges */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
        {isCurrent && (
          <span className="px-2.5 py-0.5 rounded-full bg-green-500 text-white text-xs font-semibold whitespace-nowrap shadow-sm">
            Current
          </span>
        )}
        {!isCurrent && isRecommended && (
          <span
            className="px-2.5 py-0.5 rounded-full text-white text-xs font-semibold whitespace-nowrap shadow-sm flex items-center gap-1"
            style={{ backgroundColor: themeColors.primary }}
          >
            <ArrowUpCircle className="w-3 h-3" /> Recommended
          </span>
        )}
        {!isCurrent && !isRecommended && isPopular && (
          <span className="px-2.5 py-0.5 rounded-full bg-yellow-500 text-white text-xs font-semibold whitespace-nowrap shadow-sm flex items-center gap-1">
            <Star className="w-3 h-3" /> Popular
          </span>
        )}
      </div>

      {/* Plan name + description */}
      <div className="mt-2">
        <h4 className="text-lg font-bold text-gray-900">{plan.name}</h4>
        {plan.description && (
          <p className="text-xs text-gray-500 mt-1 min-h-[2rem]">
            {plan.description}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="mt-4 mb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-gray-900">
            {price === 0 ? "Free" : formatPrice(price, plan.pricing?.currency || 'INR')}
          </span>
          {price !== 0 && (
            <span className="text-sm text-gray-500">
              /{billingCycle === "yearly" ? "year" : "month"}
            </span>
          )}
        </div>
        {billingCycle === "yearly" && price !== 0 && (
          <p className="text-xs text-gray-400 mt-1">
            ≈ {formatPrice(Math.round(price / 12), plan.pricing?.currency || 'INR')}/mo billed yearly
          </p>
        )}
      </div>

      {/* Limits */}
      <div className="space-y-2 mb-4 pb-4 border-b border-gray-100">
        <PlanLimitRow
          icon={<GraduationCap className="w-3.5 h-3.5" />}
          label="Students"
          value={plan.limits?.maxStudents ?? "—"}
        />
        <PlanLimitRow
          icon={<Users className="w-3.5 h-3.5" />}
          label="Teachers"
          value={plan.limits?.maxTeachers ?? "—"}
        />
        <PlanLimitRow
          icon={<UserCog className="w-3.5 h-3.5" />}
          label="Admins"
          value={plan.limits?.maxAdmins ?? "—"}
        />
        <PlanLimitRow
          icon={<HardDrive className="w-3.5 h-3.5" />}
          label="Storage"
          value={
            plan.limits?.maxStorageMB
              ? `${(plan.limits.maxStorageMB / 1024).toFixed(0)} GB`
              : "—"
          }
        />
      </div>

      {/* Feature list (from modules) */}
      <div className="space-y-1.5 mb-5 flex-1">
        {plan.modules &&
          Object.entries(plan.modules)
            .filter(([, enabled]) => enabled === true)
            .slice(0, 6)
            .map(([key]) => (
              <div key={key} className="flex items-center gap-2 text-xs text-gray-600">
                <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                <span className="capitalize">
                  {key.replace(/_/g, " ")}
                </span>
              </div>
            ))}
      </div>

      {/* Action */}
      <button
        onClick={onSelect}
        disabled={isCurrent || upgradingAny}
        className={`w-full py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${isCurrent
            ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
            : isDowngrade
              ? "bg-rose-50/80 text-rose-800 border border-rose-200 hover:bg-rose-100 active:scale-[0.98]"
              : "text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          }`}
        style={
          isCurrent || isDowngrade ? undefined : { backgroundColor: themeColors.primary }
        }
      >
        {upgrading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Processing…
          </>
        ) : isCurrent ? (
          "Current Plan"
        ) : isDowngrade ? (
          <>
            <ArrowDownCircle className="w-4 h-4 text-rose-600" /> Downgrade to {plan.name}
          </>
        ) : (
          <>
            <ArrowUpCircle className="w-4 h-4" /> Upgrade to {plan.name}
          </>
        )}
      </button>
    </div>
  );
};

const PlanLimitRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="flex items-center gap-1.5 text-gray-500">
      <span className="text-gray-400">{icon}</span>
      {label}
    </span>
    <span className="font-semibold text-gray-700">{value}</span>
  </div>
);

export default PricingModal;
