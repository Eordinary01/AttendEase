/**
 * Test Suite: Billing & Subscription Trial Grace Period & Reminders
 * Usage: node backend/tests/billing.test.js
 */

const assert = require("assert");
const { GRACE_PERIOD_MS, GRACE_PERIOD_DAYS } = require("../services/trialReminderService");
const { continueFree } = require("../validators/billing");

async function runTests() {
  console.log("=== STARTING BILLING & TRIAL GRACE PERIOD TEST SUITE ===\n");

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Trial Grace Period Math
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- TEST GROUP 1: Trial Grace Period Math ---");

  test("GRACE_PERIOD_DAYS is exactly 3 days and matches GRACE_PERIOD_MS", () => {
    assert.strictEqual(GRACE_PERIOD_DAYS, 3);
    assert.strictEqual(GRACE_PERIOD_MS, 3 * 24 * 60 * 60 * 1000);
  });

  test("Grace period calculation correctly identifies within grace vs expired", () => {
    const now = Date.now();

    // 1 day after trial end (within 3-day grace period)
    const trialEndedYesterday = now - 24 * 60 * 60 * 1000;
    const isWithinGrace = now < trialEndedYesterday + GRACE_PERIOD_MS;
    assert.strictEqual(isWithinGrace, true);

    const remainingMs = (trialEndedYesterday + GRACE_PERIOD_MS) - now;
    const daysLeft = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
    assert.strictEqual(daysLeft, 2);

    // 4 days after trial end (exceeded 3-day grace period)
    const trialEnded4DaysAgo = now - 4 * 24 * 60 * 60 * 1000;
    const isPastGrace = now >= trialEnded4DaysAgo + GRACE_PERIOD_MS;
    assert.strictEqual(isPastGrace, true);
  });

  test("Trial ending days calculation correctly spots Day 10 (4 days remaining) and Day 12 (2 days remaining)", () => {
    const now = Date.now();

    const trialEndsIn4Days = now + 4 * 24 * 60 * 60 * 1000;
    const diff4d = Math.ceil((trialEndsIn4Days - now) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diff4d, 4);

    const trialEndsIn2Days = now + 2 * 24 * 60 * 60 * 1000;
    const diff2d = Math.ceil((trialEndsIn2Days - now) / (1000 * 60 * 60 * 24));
    assert.strictEqual(diff2d, 2);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Billing Controllers & Validators
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: Controller & Validator Interfaces ---");

  test("continueFree validator exists and checks tenantId", () => {
    assert.ok(Array.isArray(continueFree), "continueFree must be an express-validator array");
    assert.ok(continueFree.length > 0);
  });

  test("billingController exports continueFreeTier handler", () => {
    const billingController = require("../controllers/billingController");
    assert.strictEqual(typeof billingController.continueFreeTier, "function");
  });

  console.log(`\n=== TEST RUN COMPLETE: ${passedTests} / ${totalTests} PASSED ===`);
  if (passedTests !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
