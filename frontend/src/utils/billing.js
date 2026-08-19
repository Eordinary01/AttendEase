// src/utils/billing.js
import { useState, useCallback } from "react";

/**
 * Inspects an axios/caught error response and determines whether it's a
 * plan-limit / feature-upgrade error returned by the backend guards.
 *
 * Backend returns one of these shapes (status 403 / 429):
 *   {
 *     success: false,
 *     upgradeRequired: true,
 *     message: "Students limit exceeded (50/50). Please upgrade your plan to add more.",
 *     resourceType: "student",            // for limitGuard
 *     current: 50, limit: 50,
 *     requiredPlan: "professional",       // for featureGuard
 *   }
 *
 * Returns an object describing the upgrade context, or null if this is
 * NOT an upgrade error (caller should handle normally).
 */
export const parseUpgradeError = (error) => {
  const data = error?.response?.data;
  if (!data) return null;

  // Explicit flag from backend guards
  if (data.upgradeRequired !== true) return null;

  return {
    isUpgradeRequired: true,
    resourceType: data.resourceType || null, // student | teacher | subject | admin | storage | api_calls | <feature>
    current: typeof data.current === "number" ? data.current : null,
    limit: typeof data.limit === "number" ? data.limit : null,
    requiredPlan: data.requiredPlan || null,
    feature: data.feature || null,
    subscriptionStatus: data.subscriptionStatus || null,
    message: data.message || "You've reached your plan limit. Upgrade to continue.",
  };
};

/**
 * Human-friendly label for a resource type used in the modal header.
 */
export const getResourceLabel = (resourceType) => {
  switch (resourceType) {
    case "student":
      return "Students";
    case "teacher":
      return "Teachers";
    case "subject":
      return "Subjects";
    case "admin":
      return "Admins";
    case "storage":
      return "Storage";
    case "api_calls":
      return "API Calls";
    default:
      return resourceType
        ? resourceType.charAt(0).toUpperCase() + resourceType.slice(1)
        : "Plan";
  }
};

/**
 * Recommend the next plan up from the current one based on the four
 * predefined tiers. Used to highlight a suggested upgrade in the UI.
 */
export const getRecommendedPlan = (currentPlanCode) => {
  const order = ["free", "basic", "professional", "enterprise"];
  const idx = order.indexOf(currentPlanCode);
  if (idx === -1 || idx === order.length - 1) return null;
  return order[idx + 1];
};

/**
 * React hook that manages a PricingModal's open/close state plus a helper
 * to auto-open the modal when an error is an upgrade error.
 *
 * Usage in a component:
 *   const { modalProps, openUpgrade, openUpgradeForError, setPlanCode } = useUpgradeModal();
 *
 *   // When tenant/usage data is fetched:
 *   setPlanCode(usage?.tenant?.subscription?.plan);
 *
 *   // In a catch block:
 *   catch (err) {
 *     if (!openUpgradeForError(err)) {
 *       setError(err.response?.data?.message || "Something went wrong");
 *     }
 *   }
 *
 *   // Proactively:
 *   <button onClick={() => openUpgrade()}>View Plans</button>
 *
 *   // Render the modal once (currentPlanCode is included in modalProps):
 *   <PricingModal {...modalProps} />
 */
export const useUpgradeModal = (initialPlanCode = null) => {
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [currentPlanCode, setCurrentPlanCode] = useState(initialPlanCode);

  const openUpgrade = useCallback((ctx = null) => {
    setContext(ctx);
    setIsOpen(true);
  }, []);

  const closeUpgrade = useCallback(() => {
    setIsOpen(false);
    setContext(null);
  }, []);

  /**
   * Opens the modal if `error` is an upgrade error.
   * Returns true if handled (modal opened), false otherwise.
   */
  const openUpgradeForError = useCallback(
    (error) => {
      const parsed = parseUpgradeError(error);
      if (!parsed) return false;
      setContext(parsed);
      setIsOpen(true);
      return true;
    },
    []
  );

  /**
   * Set the current plan code. Call this when tenant/usage data is fetched
   * so the modal always reflects the active plan (highlights "Current" badge,
   * drives recommended-plan logic, etc.).
   */
  const setPlanCode = useCallback((code) => {
    setCurrentPlanCode(code);
  }, []);

  const modalProps = {
    isOpen,
    onClose: closeUpgrade,
    context,
    currentPlanCode,
  };

  return { modalProps, openUpgrade, openUpgradeForError, closeUpgrade, currentPlanCode, setPlanCode };
};
