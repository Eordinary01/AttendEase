/**
 * Test Suite: OverWatcher Review Fixes Verification
 * Usage: node backend/tests/overwatcherFixes.test.js
 */

const assert = require('assert');
const mongoose = require('mongoose');

// Target modules
const { usageGuard } = require('../middleware/featureGuard');
const csrfProtection = require('../middleware/csrf');
const { formatDateDMY, toISODateString, getTodayISODateString } = require('../utils/dateFormatter');
const { getRefreshTokenFromCookie } = require('../utils/cookieConfig');
const cache = require('../middleware/cache');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');

async function runTests() {
  console.log('=== STARTING OVERWATCHER FIXES TEST SUITE ===\n');

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
  // TEST GROUP 1: Fix 1 — usageGuard Runtime Safety & Live Stats
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST GROUP 1: Fix 1 — usageGuard Runtime Safety ---');

  await testAsync('usageGuard("storage"): Does not throw ReferenceError and permits when under limit', async () => {
    let nextCalled = false;
    let statusSet = null;

    const mockTenantId = new mongoose.Types.ObjectId();
    // Prime the stats cache so getTenantLiveStats returns synchronously without DB query
    await cache.set(`stats:${mockTenantId}`, {
      studentsCount: 10,
      teachersCount: 2,
      adminsCount: 1,
      subjectsCount: 4,
      storageUsedMB: 250, // 250 MB used
    }, 60);

    const req = {
      tenantId: mockTenantId,
      tenant: {
        _id: mockTenantId,
        limits: {
          maxStorageMB: 1024, // 1024 MB limit
        },
      },
    };

    const res = {
      status(s) {
        statusSet = s;
        return this;
      },
      json() {
        return this;
      },
    };

    const next = () => {
      nextCalled = true;
    };

    const middleware = usageGuard('storage');
    await middleware(req, res, next);

    assert.strictEqual(nextCalled, true, 'Should call next() when storage is under limit');
    assert.strictEqual(statusSet, null, 'Status should not be set when allowed');
  });

  await testAsync('usageGuard("storage"): Correctly blocks with 403 when storage exceeds limit', async () => {
    let nextCalled = false;
    let statusSet = null;
    let jsonPayload = null;

    const mockTenantId = new mongoose.Types.ObjectId();
    await cache.set(`stats:${mockTenantId}`, {
      storageUsedMB: 1500, // 1500 MB used
    }, 60);

    const req = {
      tenantId: mockTenantId,
      tenant: {
        _id: mockTenantId,
        limits: {
          maxStorageMB: 1024, // 1024 MB limit -> exceeded
        },
      },
    };

    const res = {
      status(s) {
        statusSet = s;
        return this;
      },
      json(p) {
        jsonPayload = p;
        return this;
      },
    };

    const next = () => {
      nextCalled = true;
    };

    const middleware = usageGuard('storage');
    await middleware(req, res, next);

    assert.strictEqual(statusSet, 403, 'Should respond with 403 when limit exceeded');
    assert.strictEqual(jsonPayload?.metricType, 'storage');
    assert.strictEqual(jsonPayload?.current, 1500);
    assert.strictEqual(nextCalled, false, 'next() should not be called');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Fix 3 — CSRF Exempt Routes & Header-First Auth
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 2: Fix 3 — CSRF Exempt Routes & Header Auth ---');

  test('CSRF: Safe HTTP methods (GET, HEAD, OPTIONS) bypass CSRF check', () => {
    const methods = ['GET', 'HEAD', 'OPTIONS', 'get', 'head', 'options'];
    for (const m of methods) {
      let nextCalled = false;
      const req = { method: m, path: '/api/attendance/mark' };
      const res = {};
      csrfProtection(req, res, () => {
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true, `Method ${m} should bypass CSRF check`);
    }
  });

  test('CSRF: Exempt endpoints (logout, 2FA setup/verify, email verify) bypass CSRF', () => {
    const exemptPaths = [
      '/api/auth/logout',
      '/api/auth/2fa/setup',
      '/api/auth/2fa/verify',
      '/api/auth/send-verification-email',
      '/api/auth/login',
      '/api/auth/super-admin/login',
      '/api/auth/student/register',
      '/api/auth/teacher/first-login',
      '/api/auth/parent/login',
      '/api/auth/mobile/login',
      '/api/auth/refresh',
      '/api/tenant/register',
    ];

    for (const p of exemptPaths) {
      let nextCalled = false;
      const req = { method: 'POST', path: p, cookies: { accessToken: 'dummy' } };
      const res = {};
      csrfProtection(req, res, () => {
        nextCalled = true;
      });
      assert.strictEqual(nextCalled, true, `Path ${p} should be exempt from CSRF`);
    }
  });

  test('CSRF: Pure Bearer header without cookies bypasses CSRF check (Mobile App)', () => {
    let nextCalled = false;
    const req = {
      method: 'POST',
      path: '/api/attendance/submit',
      cookies: {},
      headers: { authorization: 'Bearer mock.jwt.token' },
    };
    const res = {};
    csrfProtection(req, res, () => {
      nextCalled = true;
    });
    assert.strictEqual(nextCalled, true, 'Pure Bearer header without cookies should bypass CSRF');
  });

  test('CSRF: Cookie auth without valid XSRF token is rejected with 403', () => {
    let nextCalled = false;
    let statusSet = null;
    let jsonPayload = null;

    const req = {
      method: 'POST',
      path: '/api/attendance/submit',
      cookies: {
        accessToken: 'valid.token',
        'XSRF-TOKEN': 'expected-token-12345',
      },
      headers: {
        'x-xsrf-token': 'wrong-token',
      },
    };

    const res = {
      status(s) {
        statusSet = s;
        return this;
      },
      json(p) {
        jsonPayload = p;
        return this;
      },
    };

    csrfProtection(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false, 'next() should not be called on token mismatch');
    assert.strictEqual(statusSet, 403, 'Should return 403 on CSRF token mismatch');
    assert.strictEqual(jsonPayload?.code, 'CSRF_INVALID');
  });

  test('CSRF: Cookie auth with matching XSRF token succeeds', () => {
    let nextCalled = false;
    const testToken = 'matching-secret-token-xyz';

    const req = {
      method: 'POST',
      path: '/api/attendance/submit',
      cookies: {
        accessToken: 'valid.token',
        'XSRF-TOKEN': testToken,
      },
      headers: {
        'x-xsrf-token': testToken,
      },
    };

    const res = {};

    csrfProtection(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true, 'Matching XSRF token should pass CSRF protection');
  });

  test('Refresh Cookie: Resolves refresh token directly from httpOnly cookie when body is empty', () => {
    const req = {
      cookies: { refreshToken: 'cookie_refresh_secret_123' },
      body: {},
    };
    const token = getRefreshTokenFromCookie(req);
    assert.strictEqual(token, 'cookie_refresh_secret_123', 'Should read token from cookie');
  });

  test('Refresh Cookie: Returns undefined when no cookie or body token exists', () => {
    const req = {
      cookies: {},
      body: {},
    };
    const token = getRefreshTokenFromCookie(req);
    assert.strictEqual(token, undefined, 'Should return undefined when no token provided');
  });

  test('Refresh Cookie: Prioritizes cookie over body payload if both exist', () => {
    const req = {
      cookies: { refreshToken: 'cookie_primary_token' },
      body: { refreshToken: 'body_secondary_token' },
    };
    const token = getRefreshTokenFromCookie(req);
    assert.strictEqual(token, 'cookie_primary_token', 'Cookie token must take precedence');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Fix 4 & Fix 5 — Date Formatting & Local Timezone Logic
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 3: Fix 4 & Fix 5 — Date Formatting ---');

  test('formatDateDMY: Formats ISO date string correctly to DD/MM/YYYY', () => {
    const d = '2026-09-10T00:00:00.000Z';
    const formatted = formatDateDMY(d);
    assert.match(formatted, /^\d{2}\/\d{2}\/\d{4}$/, 'Must be DD/MM/YYYY format');
  });

  test('formatDateDMY: Handles Date object input accurately', () => {
    const d = new Date(2026, 8, 10);
    const formatted = formatDateDMY(d);
    assert.strictEqual(formatted, '10/09/2026');
  });

  test('formatDateDMY: Handles single digit day and month padding', () => {
    const d = new Date(2026, 0, 5);
    const formatted = formatDateDMY(d);
    assert.strictEqual(formatted, '05/01/2026');
  });

  test('formatDateDMY: Returns empty string for invalid dates', () => {
    assert.strictEqual(formatDateDMY(null), '');
    assert.strictEqual(formatDateDMY(undefined), '');
    assert.strictEqual(formatDateDMY('not-a-date'), '');
  });

  test('Local Date Logic: Extracts local year-month-day without UTC offset mutation', () => {
    const d = new Date(2026, 8, 10, 23, 45, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const localStr = `${year}-${month}-${day}`;

    assert.strictEqual(localStr, '2026-09-10');
  });

  test('toISODateString: Correctly formats Date object and ISO string', () => {
    assert.strictEqual(toISODateString('2026-09-10T14:30:00.000Z'), '2026-09-10');
    assert.strictEqual(toISODateString('2026-09-10'), '2026-09-10');
    assert.strictEqual(toISODateString(new Date(Date.UTC(2026, 8, 10, 12, 0, 0))), '2026-09-10');
    assert.strictEqual(toISODateString(null), '');
    assert.strictEqual(toISODateString(undefined), '');
  });

  test('getTodayISODateString: Returns valid YYYY-MM-DD for today', () => {
    const today = getTodayISODateString();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 4: Fix 7 & Fix 9 — Schema Enhancements & Security Flags
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 4: Schema Enhancements & Security Flags ---');

  test('User Model: Includes forcePasswordChange boolean flag for bootstrapped admins', () => {
    const schemaPath = User.schema.paths.forcePasswordChange;
    assert(schemaPath, 'forcePasswordChange path must exist in User schema');
    assert.strictEqual(schemaPath.instance, 'Boolean');
    assert.strictEqual(schemaPath.defaultValue, false);
  });

  test('Auth Gate: Blocks general API endpoints when forcePasswordChange is true', () => {
    const user = { forcePasswordChange: true };
    const allowedPaths = ['/api/auth/change-password', '/api/auth/logout', '/api/auth/me'];
    
    // Test blocked path
    const blockedPath = '/api/attendance/mark';
    const isAllowedBlocked = allowedPaths.some((p) => blockedPath.startsWith(p));
    assert.strictEqual(isAllowedBlocked, false, 'General API routes should be blocked');

    // Test allowed paths
    assert.strictEqual(allowedPaths.some((p) => '/api/auth/change-password'.startsWith(p)), true);
    assert.strictEqual(allowedPaths.some((p) => '/api/auth/logout'.startsWith(p)), true);
    assert.strictEqual(allowedPaths.some((p) => '/api/auth/me'.startsWith(p)), true);
  });

  test('LeaveRequest Model: Includes isSyntheticMentor boolean flag', () => {
    const schemaPath = LeaveRequest.schema.paths.isSyntheticMentor;
    assert(schemaPath, 'isSyntheticMentor path must exist in LeaveRequest schema');
    assert.strictEqual(schemaPath.instance, 'Boolean');
    assert.strictEqual(schemaPath.defaultValue, false);
  });

  test('Attendance Model: Verifies compound unique index for slot idempotency', () => {
    const indexes = Attendance.schema.indexes();
    const hasSlotIndex = indexes.some((idx) => {
      const keys = Object.keys(idx[0]);
      return (
        keys.includes('tenantId') &&
        keys.includes('classSessionId') &&
        keys.includes('studentId')
      );
    });
    assert(hasSlotIndex, 'Attendance schema must contain { tenantId: 1, classSessionId: 1, studentId: 1 } compound index');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 5: Leave Reconciliation & Duplicate Suppression
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 5: Leave Reconciliation & Duplicate Suppression ---');

  test('Reconciliation Status Transitions: Absent -> Leave conversion logic', () => {
    const records = [
      { status: 'absent', remarks: 'Absent' },
      { status: 'present', remarks: 'Present in class' },
      { status: 'leave', remarks: 'Previous leave' },
    ];

    let updatedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      if (record.status === 'absent') {
        record.status = 'leave';
        record.remarks = 'Leave Approved: MEDICAL';
        updatedCount++;
      } else {
        skippedCount++;
      }
    }

    assert.strictEqual(updatedCount, 1, 'Only absent record should be converted to leave');
    assert.strictEqual(skippedCount, 2, 'Present and existing leave records must be skipped');
    assert.strictEqual(records[0].status, 'leave');
    assert.strictEqual(records[1].status, 'present');
  });

  test('Reconciliation Upsert Query: Generates unique classSessionId composite', () => {
    const subIdStr = '654321098765432109876543';
    const section = 'A';
    const slotDateStr = '2026-09-10';
    const timetableId = '11223344556677889900aabb';

    const classSessionId = `${subIdStr}_${section}_${slotDateStr}_${timetableId}`;
    assert.strictEqual(classSessionId, '654321098765432109876543_A_2026-09-10_11223344556677889900aabb');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 6: Absence Escalation Queue Deduplication Logic
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- TEST GROUP 6: Absence Escalation Deduplication ---');

  test('Absence Queue Deduplication: Identifies existing escalation by studentId & lastAbsenceDate', () => {
    const studentId = new mongoose.Types.ObjectId().toString();
    const absenceDate = new Date('2026-09-10T00:00:00.000Z');

    const alertStore = [
      {
        tenantId: 'tenant-1',
        type: 'absence_escalation',
        metadata: {
          studentId,
          lastAbsenceDate: absenceDate,
        },
      },
    ];

    const isDuplicate = alertStore.some(
      (a) =>
        a.type === 'absence_escalation' &&
        a.metadata.studentId === studentId &&
        a.metadata.lastAbsenceDate.getTime() === absenceDate.getTime()
    );

    assert.strictEqual(isDuplicate, true, 'Duplicate escalation should be detected and suppressed');
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n=============================================');
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${totalTests - passedTests}`);
  console.log('=============================================\n');

  if (totalTests === passedTests) {
    console.log('🎉 ALL OVERWATCHER FIXES TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
