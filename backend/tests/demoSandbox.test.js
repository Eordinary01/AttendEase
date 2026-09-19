/**
 * Test Suite: Demo Sandbox Layer & Concurrency Lock Verification
 * Usage: node backend/tests/demoSandbox.test.js
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';

const assert = require('assert');
const express = require('express');
const request = require('supertest');
const cookieParser = require('cookie-parser');
const csrfProtection = require('../middleware/csrf');
const demoGuard = require('../middleware/demoGuard');
const demoService = require('../services/demoService');

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { claimDemo } = require('../controllers/demoController');

let passedTests = 0;
let totalTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runTests() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  console.log('\n========================================');
  console.log('  ATTENDEASE DEMO SANDBOX TEST SUITE   ');
  console.log('========================================\n');

  // Test Group 1: CSRF Exemptions
  console.log('Group 1: CSRF Route Exemption Verification');

  await test('1.1: POST /api/auth/parent-login is exempt from CSRF rejection', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(csrfProtection);
    app.post('/api/auth/parent-login', (req, res) => res.json({ ok: true }));

    const res = await request(app).post('/api/auth/parent-login').send({});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  await test('1.2: POST /api/demo/claim is exempt from CSRF rejection', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(csrfProtection);
    app.post('/api/demo/claim', (req, res) => res.json({ ok: true }));

    const res = await request(app).post('/api/demo/claim').send({ role: 'student' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
  });

  await test('1.3: Non-exempt mutating route without CSRF token is rejected with 403 CSRF_INVALID', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    // Simulate cookies present
    app.use((req, res, next) => {
      req.cookies = { accessToken: 'dummy' };
      next();
    });
    app.use(csrfProtection);
    app.post('/api/users/update', (req, res) => res.json({ ok: true }));

    const res = await request(app).post('/api/users/update').send({});
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'CSRF_INVALID');
  });

  // Test Group 2: Demo Slot Concurrency & Lifecycle
  console.log('\nGroup 2: Slot Locking, Concurrency, and Release');

  const testSessionA = 'session-user-alpha';
  const testSessionB = 'session-user-beta';

  await test('2.1: First visitor successfully claims student role slot', async () => {
    // Release in case occupied
    await demoService.releaseSlot('student', testSessionA);
    const result = await demoService.claimSlot('student', testSessionA, '127.0.0.1', 60);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.slot.role, 'student');
    assert.strictEqual(result.slot.sessionId, testSessionA);
  });

  await test('2.2: Second visitor attempting to claim occupied student role is blocked (SLOT_OCCUPIED)', async () => {
    const result = await demoService.claimSlot('student', testSessionB, '127.0.0.1', 60);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'SLOT_OCCUPIED');
    assert.ok(result.remainingSeconds > 0);
  });

  await test('2.3: Same visitor re-requesting their own active slot is allowed (re-entry)', async () => {
    const result = await demoService.claimSlot('student', testSessionA, '127.0.0.1', 60);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.slot.sessionId, testSessionA);
  });

  await test('2.4: Release slot with mismatched session ID fails to release', async () => {
    const releaseRes = await demoService.releaseSlot('student', 'wrong-session-xyz');
    assert.strictEqual(releaseRes.success, false);

    // Slot must still be occupied
    const status = await demoService.getSlotInfo('student');
    assert.strictEqual(status.isAvailable, false);
  });

  await test('2.5: Release slot with correct session ID releases the slot', async () => {
    const releaseRes = await demoService.releaseSlot('student', testSessionA);
    assert.strictEqual(releaseRes.success, true);

    const status = await demoService.getSlotInfo('student');
    assert.strictEqual(status.isAvailable, true);
  });

  await test('2.6: Second visitor can now claim the released student slot', async () => {
    const result = await demoService.claimSlot('student', testSessionB, '127.0.0.1', 60);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.slot.sessionId, testSessionB);

    // Clean up
    await demoService.releaseSlot('student', testSessionB);
  });

  // Test Group 3: Demo Guard Sandbox Policy
  console.log('\nGroup 3: Demo Guard Write Policy & State Preservation');

  await test('3.1: Non-demo user passes through demoGuard unaffected', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { demo: false, role: 'admin' };
      next();
    });
    app.use(demoGuard);
    app.post('/api/billing/subscribe', (req, res) => res.json({ realDbSaved: true }));

    const res = await request(app).post('/api/billing/subscribe').send({});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.realDbSaved, true);
  });

  await test('3.2: Demo user attempting billing/sensitive mutation is blocked with 403', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { demo: true, role: 'admin' };
      next();
    });
    app.use(demoGuard);
    app.post('/api/billing/subscribe', (req, res) => res.json({ realDbSaved: true }));

    const res = await request(app).post('/api/billing/subscribe').send({});
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.code, 'DEMO_ACTION_BLOCKED');
    assert.strictEqual(res.body.isDemoBlocked, true);
  });

  await test('3.3: Demo user submitting leaves/tickets is intercepted with simulated response', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { demo: true, role: 'student' };
      next();
    });
    app.use(demoGuard);
    app.post('/api/leaves/apply', (req, res) => res.json({ realDbSaved: true }));

    const res = await request(app).post('/api/leaves/apply').send({ reason: 'Sick leave' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isDemoSimulated, true);
    assert.strictEqual(res.body.realDbSaved, undefined); // Real handler never executed
  });

  await test('3.4: Demo user GET requests pass through normally for pristine reads', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.user = { demo: true, role: 'teacher' };
      next();
    });
    app.use(demoGuard);
    app.get('/api/subjects', (req, res) => res.json({ subjects: ['Math', 'CS'] }));

    const res = await request(app).get('/api/subjects');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.subjects, ['Math', 'CS']);
  });

  // Test Group 4: Phase 10 Credential Exposure & Cookie-Only Auth
  console.log('\nGroup 4: Phase 10 Credential Exposure & Cookie-Only Auth');

  await test('4.1: POST /api/demo/claim response body does NOT contain token, xsrfToken, or rawRefreshToken', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.post('/api/demo/claim', claimDemo);

    const testSessionClaim = 'session-phase10-check';
    await demoService.releaseSlot('student', testSessionClaim);

    const res = await request(app).post('/api/demo/claim').send({ role: 'student', sessionId: testSessionClaim });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.token, undefined, 'Response JSON must NOT contain token');
    assert.strictEqual(res.body.xsrfToken, undefined, 'Response JSON must NOT contain xsrfToken');
    assert.strictEqual(res.body.rawRefreshToken, undefined, 'Response JSON must NOT contain rawRefreshToken');
    await demoService.releaseSlot('student', testSessionClaim);
  });

  await test('4.2: POST /api/demo/claim sets secure httpOnly accessToken cookie in headers', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.post('/api/demo/claim', claimDemo);

    const testSessionClaim = 'session-phase10-cookie';
    await demoService.releaseSlot('student', testSessionClaim);

    const res = await request(app).post('/api/demo/claim').send({ role: 'student', sessionId: testSessionClaim });
    assert.strictEqual(res.status, 200);
    const cookies = res.headers['set-cookie'] || [];
    const hasAccessCookie = cookies.some(c => c.startsWith('accessToken=') && c.includes('HttpOnly'));
    assert.ok(hasAccessCookie, 'Response must set HttpOnly accessToken cookie');
    const hasXsrfCookie = cookies.some(c => c.startsWith('XSRF-TOKEN='));
    assert.ok(hasXsrfCookie, 'Response must set XSRF-TOKEN cookie');
    await demoService.releaseSlot('student', testSessionClaim);
  });

  await test('4.3: POST /api/demo/claim trims user payload to UI-safe fields (no Mongo _id)', async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.post('/api/demo/claim', claimDemo);

    const testSessionClaim = 'session-phase10-safe';
    await demoService.releaseSlot('student', testSessionClaim);

    const res = await request(app).post('/api/demo/claim').send({ role: 'student', sessionId: testSessionClaim });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.user, 'user object must be present');
    assert.strictEqual(res.body.user.id, undefined, 'user.id must NOT expose internal Mongo _id');
    assert.strictEqual(res.body.user.tenantId, undefined, 'user.tenantId must NOT expose internal Mongo _id');
    assert.ok(res.body.user.name, 'user.name must be present for display');
    assert.strictEqual(res.body.user.role, 'student');
    await demoService.releaseSlot('student', testSessionClaim);
  });

  console.log('\n========================================');
  console.log(`  SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED  `);
  console.log('========================================\n');

  await mongoose.disconnect();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runTests };
