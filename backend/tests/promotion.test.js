/**
 * Test Suite: Automated Semester Promotion Service & Helpers
 * Usage: node backend/tests/promotion.test.js
 */

const assert = require("assert");
const {
  computeExpectedSemester,
  resolveTotalSemesters,
} = require("../services/promotionService");
const { enqueuePromotionBatch, getJobStatus } = require("../queue");

async function runTests() {
  console.log("=== STARTING SEMESTER PROMOTION TEST SUITE ===\n");

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

  async function testAsync(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: Academic Calendar & Semester Math
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- TEST GROUP 1: Academic Calendar & Semester Calculation ---");

  test("computeExpectedSemester: returns null when admissionYear is missing/invalid", () => {
    assert.strictEqual(computeExpectedSemester(null, 5, 2), null);
    assert.strictEqual(computeExpectedSemester(undefined, 5, 2), null);
    assert.strictEqual(computeExpectedSemester("invalid", 5, 2), null);
    assert.strictEqual(computeExpectedSemester("", 5, 2), null);
  });

  test("computeExpectedSemester: calculates correct semester for past admission years", () => {
    // Current date: September 2026 (month 8, 0-indexed)
    // Admission in 2024, start month May (5, 0-indexed: May is 5)
    // 2026*12 + 8 = 24320. 2024*12 + 5 = 24293. elapsed = 27 months.
    // 27 / 6 months per sem = 4.5 -> 1 + 4 = 5th semester.
    const fixedNow = new Date(2026, 8, 20);
    const sem = computeExpectedSemester(2024, 5, 2, fixedNow);
    assert.strictEqual(sem, 5, `Expected semester 5, got ${sem}`);
  });

  test("computeExpectedSemester: handles freshman semester before second semester begins", () => {
    // Current date: July 2026 (month 6, 0-indexed)
    // Admission in 2026, start month May (5). elapsed = (2026*12 + 6) - (2026*12 + 5) = 1 month.
    // 1 / 6 = 0 -> 1 + 0 = 1st semester.
    const fixedNow = new Date(2026, 6, 1);
    const sem = computeExpectedSemester(2026, 5, 2, fixedNow);
    assert.strictEqual(sem, 1, `Expected semester 1, got ${sem}`);
  });

  test("computeExpectedSemester: clamps future admission date to semester 1", () => {
    // Current date: April 2026 (before academic start month May 2026)
    const fixedNow = new Date(2026, 3, 1);
    const sem = computeExpectedSemester(2026, 5, 2, fixedNow);
    assert.strictEqual(sem, 1, `Expected semester 1, got ${sem}`);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Total Semesters Resolution
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: Total Semesters Resolution ---");

  test("resolveTotalSemesters: prioritizes explicit student.totalSemesters", () => {
    const student = { totalSemesters: 8, courseId: "course1" };
    const courseMap = new Map();
    assert.strictEqual(resolveTotalSemesters(student, courseMap), 8);
  });

  test("resolveTotalSemesters: resolves from branch when available", () => {
    const student = { courseId: "c1", branch: "CSE" };
    const courseMap = new Map([
      [
        "c1",
        {
          branches: [
            { name: "CSE", totalSemesters: 8 },
            { name: "Diploma", totalSemesters: 6 },
          ],
        },
      ],
    ]);
    assert.strictEqual(resolveTotalSemesters(student, courseMap), 8);
  });

  test("resolveTotalSemesters: falls back to course durationYears * semestersPerYear", () => {
    const student = { courseId: "c2", branch: "General" };
    const courseMap = new Map([
      [
        "c2",
        {
          durationYears: 3,
          semestersPerYear: 2,
          branches: [],
        },
      ],
    ]);
    assert.strictEqual(resolveTotalSemesters(student, courseMap), 6);
  });

  test("resolveTotalSemesters: returns null if course not found", () => {
    const student = { courseId: "unknown" };
    const courseMap = new Map();
    assert.strictEqual(resolveTotalSemesters(student, courseMap), null);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Queue Graceful Fallback
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Queue Fallback When Redis is Not Connected ---");

  await testAsync("enqueuePromotionBatch: falls back cleanly when Redis is not available", async () => {
    // In local dev without REDIS_URL, it returns skipped: true
    const res = await enqueuePromotionBatch("tenant_fake", ["student1"]);
    assert.strictEqual(typeof res, "object");
    if (!process.env.REDIS_URL) {
      assert.strictEqual(res.skipped, true);
      assert.strictEqual(res.jobId, null);
    }
  });

  await testAsync("getJobStatus: returns null gracefully if queue is not active or job does not exist", async () => {
    const status = await getJobStatus("non_existent_job");
    assert.strictEqual(status, null);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Controller Deduplication & Course Resolution Gaps
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 4: Controller Deduplication & Gap Protections ---");

  test("academicController.getExpectedSemester matches promotionService.computeExpectedSemester", () => {
    const { getExpectedSemester } = require("../controllers/academicController");
    assert.strictEqual(getExpectedSemester, computeExpectedSemester);
    assert.strictEqual(getExpectedSemester(2024, 5, 2, new Date(2026, 8, 20)), 5);
  });

  test("resolveTotalSemesters: student with missing courseId returns totalSemesters if explicitly set, else null", () => {
    const studentWithTotal = { courseId: null, totalSemesters: 6 };
    const courseMap = new Map();
    assert.strictEqual(resolveTotalSemesters(studentWithTotal, courseMap), 6);

    const studentWithoutTotal = { courseId: null, totalSemesters: null };
    assert.strictEqual(resolveTotalSemesters(studentWithoutTotal, courseMap), null);
  });

  test("SemesterPromotion model schema contains all required audit fields", () => {
    const SemesterPromotion = require("../models/SemesterPromotion");
    const schema = SemesterPromotion.schema.paths;
    assert.ok(schema.tenantId, "tenantId must exist");
    assert.ok(schema.type, "type must exist");
    assert.ok(schema.promotedCount, "promotedCount must exist");
    assert.ok(schema.graduatedCount, "graduatedCount must exist");
    assert.ok(schema.eligibleCount, "eligibleCount must exist");
    assert.ok(schema.skippedCount, "skippedCount must exist");
    assert.ok(schema.failedCount, "failedCount must exist");
    assert.ok(schema.status, "status must exist");
    assert.ok(schema.executedAt, "executedAt must exist");
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
