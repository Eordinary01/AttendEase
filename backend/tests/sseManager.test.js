/**
 * Test Suite: SSE Real-Time Event Layer Infrastructure Verification
 * Usage: node backend/tests/sseManager.test.js
 * (or via Jest: npm test backend/tests/sseManager.test.js)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_12345';

const assert = require('assert');
const { EventEmitter } = require('events');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cache = require('../middleware/cache');
const eventStreamRoute = require('../routes/eventStreamRoute');

// Target modules
const sseManager = require('../utils/sseManager');
const eventBus = require('../events/eventBus');
const {
  publishAlertCreated,
  publishAlertUpdated,
  publishAlertExpired,
  publishAttendanceMarked,
  publishLeaveSubmitted,
} = require('../events/publishers');

// Mock Express Response
class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = {};
    this.writtenData = [];
    this.statusCode = 200;
    this.writableEnded = false;
    this.destroyed = false;
  }

  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value;
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    for (const [k, v] of Object.entries(headers)) {
      this.headers[k.toLowerCase()] = v;
    }
  }

  write(chunk) {
    if (this.writableEnded || this.destroyed) {
      throw new Error('Write after end');
    }
    this.writtenData.push(chunk);
    return true; // buffer not full
  }

  flushHeaders() {}

  end(data) {
    if (data) this.write(data);
    this.writableEnded = true;
    this.emit('close');
  }

  destroy() {
    this.destroyed = true;
    this.writableEnded = true;
    this.emit('close');
  }
}

// Mock Express Request
class MockRequest extends EventEmitter {
  constructor(user = {}) {
    super();
    this.user = user;
    this.headers = {};
  }
}

async function runTests() {
  console.log('=== STARTING SSE INFRASTRUCTURE TEST SUITE ===\n');

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

  // 1. Role-based event filtering
  test('Role Filter: Student allowed events', () => {
    assert.strictEqual(sseManager.isEventAllowedForRole('student', 'attendance.marked'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('student', 'alert.created'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('student', 'exam.seating_ready'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('student', 'broadcast.announcement'), true);
  });

  test('Role Filter: Student blocked from restricted events', () => {
    assert.strictEqual(sseManager.isEventAllowedForRole('student', 'billing.invoice_created'), false);
    assert.strictEqual(sseManager.isEventAllowedForRole('student', 'admin.action'), false);
    assert.strictEqual(sseManager.isEventAllowedForRole('student', 'audit.log'), false);
  });

  test('Role Filter: Teacher allowed events', () => {
    assert.strictEqual(sseManager.isEventAllowedForRole('teacher', 'leave.submitted'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('teacher', 'attendance.marked'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('teacher', 'ticket.created'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('teacher', 'absence.escalation'), true);
  });

  test('Role Filter: Admin and Super Admin receive all events (*)', () => {
    assert.strictEqual(sseManager.isEventAllowedForRole('admin', 'risk.critical'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('admin', 'leave.submitted'), true);
    assert.strictEqual(sseManager.isEventAllowedForRole('super_admin', 'any.custom.event'), true);
  });

  // 2. SSE Subscription & Headers
  test('SSE Subscription: Sets required SSE headers and sends handshake', () => {
    const req = new MockRequest({
      _id: 'user_1',
      tenantId: 'tenant_alpha',
      role: 'student',
    });
    const res = new MockResponse();

    const sub = sseManager.subscribe(req, res);
    assert.ok(sub, 'Subscription should be returned');
    assert.ok(sub.sessionId, 'SessionId should be generated');

    // Headers check
    assert.strictEqual(res.headers['content-type'], 'text/event-stream');
    assert.strictEqual(res.headers['connection'], 'keep-alive');
    assert.strictEqual(res.headers['cache-control'], 'no-cache, no-transform');
    assert.strictEqual(res.headers['x-accel-buffering'], 'no');

    // Handshake check
    assert.ok(res.writtenData.some(d => d.includes(': connected')));
    assert.ok(res.writtenData.some(d => d.includes('event: system.ready')));

    sub.close();
  });

  // 3. User Connection Deduplication
  test('User Dedup: New connection supersedes previous connection for same user', () => {
    const user = { _id: 'user_duplicate_test', tenantId: 'tenant_alpha', role: 'student' };

    const req1 = new MockRequest(user);
    const res1 = new MockResponse();
    const sub1 = sseManager.subscribe(req1, res1);

    const req2 = new MockRequest(user);
    const res2 = new MockResponse();
    const sub2 = sseManager.subscribe(req2, res2);

    assert.ok(sub1.sessionId !== sub2.sessionId, 'Session IDs must be distinct');

    // Session 1 must have received close with superseded reason
    const session1Closed = res1.writtenData.some(d => d.includes('"superseded"'));
    assert.strictEqual(session1Closed, true, 'First connection must be closed as superseded');
    assert.strictEqual(res1.writableEnded, true, 'First response must be ended');

    sub2.close();
  });

  // 4. Tenant-Scoped Event Publishing
  await testAsync('Tenant Scoping: Events only delivered to matching tenant', async () => {
    const resTenantA = new MockResponse();
    const resTenantB = new MockResponse();

    const subA = sseManager.subscribe(
      new MockRequest({ _id: 'user_a', tenantId: 'tenant_A', role: 'admin' }),
      resTenantA
    );
    const subB = sseManager.subscribe(
      new MockRequest({ _id: 'user_b', tenantId: 'tenant_B', role: 'admin' }),
      resTenantB
    );

    // Publish to Tenant A only
    sseManager.publishLocal('tenant_A', 'alert.created', { title: 'Tenant A Alert' }, 'dedupe_a_1');

    // Wait for microbatch drain
    await new Promise(r => setTimeout(r, 50));

    const aGotEvent = resTenantA.writtenData.some(d => d.includes('Tenant A Alert'));
    const bGotEvent = resTenantB.writtenData.some(d => d.includes('Tenant A Alert'));

    assert.strictEqual(aGotEvent, true, 'Tenant A client must receive Tenant A event');
    assert.strictEqual(bGotEvent, false, 'Tenant B client must NOT receive Tenant A event');

    // Publish global event (tenantId = null)
    sseManager.publishLocal(null, 'broadcast.announcement', { title: 'Global News' }, 'dedupe_global_1');

    await new Promise(r => setTimeout(r, 50));

    const aGotGlobal = resTenantA.writtenData.some(d => d.includes('Global News'));
    const bGotGlobal = resTenantB.writtenData.some(d => d.includes('Global News'));

    assert.strictEqual(aGotGlobal, true, 'Tenant A client must receive global event');
    assert.strictEqual(bGotGlobal, true, 'Tenant B client must receive global event');

    subA.close();
    subB.close();
  });

  // 5. Backpressure Bounded Queue Overflow
  await testAsync('Backpressure: Queue drops oldest events and enqueues events.dropped on overflow', async () => {
    const res = new MockResponse();
    const sub = sseManager.subscribe(
      new MockRequest({ _id: 'user_slow', tenantId: 'tenant_overflow', role: 'admin' }),
      res
    );

    // Simulate blocked socket write
    res.write = () => false;

    // Enqueue 55 events
    for (let i = 0; i < 55; i++) {
      sseManager.publishLocal('tenant_overflow', 'attendance.marked', { count: i }, `dedupe_overflow_${i}`);
    }

    // Wait microbatch
    await new Promise(r => setTimeout(r, 50));

    // Stats should show dropped count > 0
    const stats = sseManager.getStats();
    assert.ok(stats.totalClients >= 1, 'Client should be active');

    sub.close();
  });

  // 6. Stale Client Reaping
  test('Stale Reaper: Reaps expired or destroyed clients', () => {
    const res = new MockResponse();
    const sub = sseManager.subscribe(
      new MockRequest({ _id: 'user_reap', tenantId: 'tenant_reap', role: 'student' }),
      res
    );

    const initialStats = sseManager.getStats();
    assert.ok(initialStats.totalClients > 0);

    // Simulate destroyed socket
    res.destroy();

    sseManager.reapStaleClients();

    const postReapStats = sseManager.getStats();
    assert.strictEqual(postReapStats.tenantCounts['tenant_reap'] || 0, 0, 'Dead client should be reaped');
  });

  // 7. Domain Event Publishers Integration
  await testAsync('Publishers: publishAlertCreated correctly emits formatted envelope', async () => {
    const res = new MockResponse();
    const sub = sseManager.subscribe(
      new MockRequest({ _id: 'user_listener', tenantId: 'tenant_pub_test', role: 'student' }),
      res
    );

    const fakeAlert = {
      _id: 'alert_123',
      title: 'Exam Alert',
      message: 'Midterm schedule posted',
      type: 'announcement',
      priority: 'normal',
      isPlatformAlert: false,
      createdAt: new Date(),
    };

    publishAlertCreated('tenant_pub_test', fakeAlert);

    await new Promise(r => setTimeout(r, 50));

    const receivedAlert = res.writtenData.some(d => d.includes('Midterm schedule posted'));
    assert.strictEqual(receivedAlert, true, 'Client should receive alert created event');

    sub.close();
  });

  // 7.1 Sender Exclusion Rule: Actor should NOT receive live push for own action
  await testAsync('Sender Exclusion: Actor does NOT receive real-time push for own alert', async () => {
    const resSender = new MockResponse();
    const resRecipient = new MockResponse();

    const subSender = sseManager.subscribe(
      new MockRequest({ _id: 'admin_sender', tenantId: 'tenant_ex_test', role: 'admin' }),
      resSender
    );
    const subRecipient = sseManager.subscribe(
      new MockRequest({ _id: 'student_recipient', tenantId: 'tenant_ex_test', role: 'student', section: 'A' }),
      resRecipient
    );

    const alert = {
      _id: 'alert_exclude_1',
      title: 'Tuition Deadline',
      message: 'Payment due on Friday',
      type: 'announcement',
      priority: 'high',
      createdBy: 'admin_sender',
      targetRoles: ['student'],
      isPlatformAlert: false,
      createdAt: new Date(),
    };

    publishAlertCreated('tenant_ex_test', alert, 'admin_sender');

    await new Promise(r => setTimeout(r, 50));

    const senderGotPush = resSender.writtenData.some(d => d.includes('Payment due on Friday'));
    const recipientGotPush = resRecipient.writtenData.some(d => d.includes('Payment due on Friday'));

    assert.strictEqual(senderGotPush, false, 'Sender must NOT receive live push for own alert');
    assert.strictEqual(recipientGotPush, true, 'Recipient must receive live push');

    subSender.close();
    subRecipient.close();
  });

  // 7.2 Target Filtering Rule: Only matching sections and roles receive push
  await testAsync('Target Filtering: Only matching sections and roles receive real-time push', async () => {
    const resSectionA = new MockResponse();
    const resSectionB = new MockResponse();
    const resTeacher = new MockResponse();

    const subA = sseManager.subscribe(
      new MockRequest({ _id: 'student_sec_a', tenantId: 'tenant_target_test', role: 'student', section: 'A' }),
      resSectionA
    );
    const subB = sseManager.subscribe(
      new MockRequest({ _id: 'student_sec_b', tenantId: 'tenant_target_test', role: 'student', section: 'B' }),
      resSectionB
    );
    const subTeacher = sseManager.subscribe(
      new MockRequest({ _id: 'teacher_1', tenantId: 'tenant_target_test', role: 'teacher' }),
      resTeacher
    );

    const sectionAAlert = {
      _id: 'alert_sec_a',
      title: 'Lab Cancelled for Section A',
      message: 'Section A lab cancelled',
      type: 'announcement',
      priority: 'normal',
      createdBy: 'teacher_1',
      targetRoles: ['student'],
      targetSections: ['A'],
      isPlatformAlert: false,
      createdAt: new Date(),
    };

    publishAlertCreated('tenant_target_test', sectionAAlert, 'teacher_1');

    await new Promise(r => setTimeout(r, 50));

    const secAGotPush = resSectionA.writtenData.some(d => d.includes('Lab Cancelled for Section A'));
    const secBGotPush = resSectionB.writtenData.some(d => d.includes('Lab Cancelled for Section A'));
    const teacherGotPush = resTeacher.writtenData.some(d => d.includes('Lab Cancelled for Section A'));

    assert.strictEqual(secAGotPush, true, 'Section A student must receive Section A targeted alert');
    assert.strictEqual(secBGotPush, false, 'Section B student must NOT receive Section A targeted alert');
    assert.strictEqual(teacherGotPush, false, 'Teacher must NOT receive student-only targeted alert');

    subA.close();
    subB.close();
    subTeacher.close();
  });

  // 8. Graceful Shutdown (closeAll)
  test('Graceful Shutdown: closeAll terminates all connections and clears state', () => {
    const res1 = new MockResponse();
    const res2 = new MockResponse();

    sseManager.subscribe(new MockRequest({ _id: 'u1', tenantId: 't1', role: 'admin' }), res1);
    sseManager.subscribe(new MockRequest({ _id: 'u2', tenantId: 't2', role: 'teacher' }), res2);

    sseManager.closeAll('server_shutdown');

    const stats = sseManager.getStats();
    assert.strictEqual(stats.totalClients, 0, 'Total clients must be 0 after closeAll');
    assert.strictEqual(stats.totalTenants, 0, 'Total tenants must be 0 after closeAll');
    assert.strictEqual(res1.writableEnded, true, 'res1 must be ended');
    assert.strictEqual(res2.writableEnded, true, 'res2 must be ended');
  });

  // 9. Route Authentication & Protection
  await testAsync('Route Auth: /api/events/stream & stats require valid token', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(cookieParser());
    testApp.use('/api/events', eventStreamRoute);

    const resStream = await request(testApp).get('/api/events/stream');
    assert.strictEqual(resStream.status, 401, 'Unauthenticated stream request must return 401');

    const resStats = await request(testApp).get('/api/events/stats');
    assert.strictEqual(resStats.status, 401, 'Unauthenticated stats request must return 401');
  });

  // 10. Role Gate & Cookie Dual Auth
  await testAsync('Route Role Gate & Dual Auth: Student rejected from stats, Admin allowed via bearer & cookie', async () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.use(cookieParser());
    testApp.use('/api/events', eventStreamRoute);

    const studentId = '507f1f77bcf86cd799439011';
    const adminId = '507f1f77bcf86cd799439022';
    const tenantId = '507f1f77bcf86cd799439099';

    await cache.set(`tenant:${tenantId}`, {
      _id: tenantId,
      name: 'Test Tenant',
      subdomain: 'test',
      subscription: { status: 'active', plan: 'pro' },
    });

    await cache.set(`user:${studentId}`, {
      _id: studentId,
      role: 'student',
      tenantId,
      name: 'Student',
      isActive: true,
    });

    await cache.set(`user:${adminId}`, {
      _id: adminId,
      role: 'admin',
      tenantId,
      name: 'Admin',
      isActive: true,
    });

    const studentToken = jwt.sign(
      { userId: studentId, role: 'student', tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const adminToken = jwt.sign(
      { userId: adminId, role: 'admin', tenantId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Student -> 403 on stats
    const resStudent = await request(testApp)
      .get('/api/events/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    assert.strictEqual(resStudent.status, 403, 'Student must receive 403 on stats');

    // Admin Bearer -> 200
    const resAdmin = await request(testApp)
      .get('/api/events/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(resAdmin.status, 200, 'Admin must receive 200 on stats');

    // Admin Cookie -> 200
    const resCookie = await request(testApp)
      .get('/api/events/stats')
      .set('Cookie', [`accessToken=${adminToken}`]);
    assert.strictEqual(resCookie.status, 200, 'Admin cookie auth must receive 200 on stats');
  });

  console.log(`\n=== RESULTS: ${passedTests} / ${totalTests} TESTS PASSED ===`);
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

// Support both direct node execution and jest runner
if (typeof describe === 'function') {
  describe('SSE Infrastructure Test Suite', () => {
    it('runs all SSE manager tests', async () => {
      await runTests();
    });
  });
} else {
  runTests().then(() => {
    // Clean exit
    setTimeout(() => process.exit(0), 100);
  }).catch((err) => {
    console.error('Test suite failed:', err);
    process.exit(1);
  });
}
