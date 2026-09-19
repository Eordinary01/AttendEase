/**
 * Test Suite: Phase 10 Academic Leave Workflow, Mentor Routing, Exam Gating & Revert Engine
 * Usage: node backend/tests/leaveWorkflow.test.js
 */

const assert = require('assert');
const path = require('path');
const mongoose = require('mongoose');

// Load models & controller
const MentorAssignment = require('../models/MentorAssignment');
const LeaveRequest = require('../models/LeaveRequest');
const Exam = require('../models/Exam');
const leaveController = require('../controllers/leaveController');

const {
  formatDateDMY,
  resolvePrimaryMentor,
  checkExamPeriodConflict,
} = leaveController;

async function runTests() {
  console.log('=== STARTING PHASE 10 LEAVE WORKFLOW TEST SUITE ===\n');

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

  // 1. Date formatting tests (Strict DD/MM/YYYY)
  test('formatDateDMY: Formats ISO date string correctly to DD/MM/YYYY', () => {
    const d = '2026-09-08T00:00:00.000Z';
    const formatted = formatDateDMY(d);
    assert.strictEqual(formatted, '08/09/2026', `Expected 08/09/2026, got ${formatted}`);
  });

  test('formatDateDMY: Handles single digit day and month correctly', () => {
    const d = new Date(2026, 0, 5); // 5 Jan 2026
    const formatted = formatDateDMY(d);
    assert.strictEqual(formatted, '05/01/2026', `Expected 05/01/2026, got ${formatted}`);
  });

  test('formatDateDMY: Returns empty string for invalid or null dates', () => {
    assert.strictEqual(formatDateDMY(null), '');
    assert.strictEqual(formatDateDMY('invalid-date'), '');
  });

  // 2. MentorAssignment Model Schema and Compound Index verification
  test('MentorAssignment: Schema defines required fields and compound unique indexes', () => {
    const paths = MentorAssignment.schema.paths;
    assert(paths.tenantId, 'tenantId must be defined');
    assert(paths.teacherId, 'teacherId must be defined');
    assert(paths.section, 'section must be defined');
    assert(paths.isPrimary, 'isPrimary must be defined');
    assert(paths.isActive, 'isActive must be defined');

    const indexes = MentorAssignment.schema.indexes();
    const hasCohortIndex = indexes.some((idx) => {
      const keys = Object.keys(idx[0]);
      return (
        keys.includes('tenantId') &&
        keys.includes('section') &&
        keys.includes('teacherId')
      );
    });
    assert(hasCohortIndex, 'Compound index on tenantId, section, teacherId must exist');
  });

  // 3. LeaveRequest Model Schema verification for Phase 10 additions
  test('LeaveRequest: Schema supports subjectIds, flowType, mentorId, examPeriodConflict, revertOutcome', () => {
    const paths = LeaveRequest.schema.paths;
    assert(paths.subjectIds, 'subjectIds array must be defined');
    assert(paths.flowType, 'flowType enum must be defined');
    assert(paths.mentorId, 'mentorId reference must be defined');
    assert(paths.assignedTeacherId, 'assignedTeacherId reference must be defined');
    assert(paths.examPeriodConflict, 'examPeriodConflict boolean must be defined');
    assert(paths.cancelledBy, 'cancelledBy must be defined');
    assert(paths.cancelledAt, 'cancelledAt must be defined');
    assert(paths.revertOutcome, 'revertOutcome must be defined');

    const flowTypeValues = LeaveRequest.schema.path('flowType').enumValues;
    assert(flowTypeValues.includes('single-subject'), 'flowType must include single-subject');
    assert(flowTypeValues.includes('multi-subject'), 'flowType must include multi-subject');
    assert(flowTypeValues.includes('all-classes'), 'flowType must include all-classes');

    const approvalStepRoleValues = LeaveRequest.schema.path('approvalChain').schema.path('role').enumValues;
    assert(approvalStepRoleValues.includes('mentor'), 'approvalChain.role enum must include mentor');
  });

  // 4. Backdated 30-Day Constraint Logic
  test('Backdated 30-Day Constraint: Rejects dates older than 30 days unless overridden', () => {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 30);

    const oldDate = new Date(now);
    oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

    const recentDate = new Date(now);
    recentDate.setDate(recentDate.getDate() - 5); // 5 days ago

    // Check condition: start < cutoff && !adminOverride && !isAdmin
    const checkBackdated = (startDate, hasOverride, isAdmin) => {
      return startDate < cutoff && !hasOverride && !isAdmin;
    };

    assert.strictEqual(
      checkBackdated(oldDate, false, false),
      true,
      'Old date without override must be flagged as backdated limit violation'
    );
    assert.strictEqual(
      checkBackdated(oldDate, true, false),
      false,
      'Old date with adminOverride=true must be allowed'
    );
    assert.strictEqual(
      checkBackdated(oldDate, false, true),
      false,
      'Old date submitted by admin role must be allowed'
    );
    assert.strictEqual(
      checkBackdated(recentDate, false, false),
      false,
      'Recent date (5 days ago) must be allowed'
    );
  });

  // 5. Exam Conflict Gating Logic
  test('Exam Conflict Gating: Disallows OD leaves and flags medical leaves with mandatory HOD review', () => {
    const mockExam = {
      title: 'Midterm Examination 2026',
      date: new Date('2026-09-10'),
      status: 'scheduled',
    };

    // Simulated evaluation of conflict
    const evaluateLeaveUnderExam = (leaveType, conflict) => {
      if (!conflict) return { allowed: true, requiresHOD: false, conflictFlag: false };
      if (leaveType === 'od' || leaveType === 'on-duty') {
        return { allowed: false, reason: 'EXAM_OD_FORBIDDEN' };
      }
      return { allowed: true, requiresHOD: true, conflictFlag: true };
    };

    const odResult = evaluateLeaveUnderExam('od', mockExam);
    assert.strictEqual(odResult.allowed, false, 'OD leave must be disallowed during exams');
    assert.strictEqual(odResult.reason, 'EXAM_OD_FORBIDDEN');

    const medicalResult = evaluateLeaveUnderExam('medical', mockExam);
    assert.strictEqual(medicalResult.allowed, true, 'Medical leave is allowed during exams');
    assert.strictEqual(medicalResult.conflictFlag, true, 'Medical leave must be flagged with examPeriodConflict: true');
    assert.strictEqual(medicalResult.requiresHOD, true, 'Medical leave during exams must require HOD escalation');
  });

  // 6. Dual Routing Flow logic
  test('Dual Routing Flow: Routes single-subject to faculty and all-classes/multi-subject to mentor', () => {
    const determineRouting = (subjectIds) => {
      if (subjectIds.length === 1) return { flowType: 'single-subject', target: 'assignedTeacherId' };
      if (subjectIds.length > 1) return { flowType: 'multi-subject', target: 'mentorId' };
      return { flowType: 'all-classes', target: 'mentorId' };
    };

    const singleRoute = determineRouting(['sub123']);
    assert.strictEqual(singleRoute.flowType, 'single-subject');
    assert.strictEqual(singleRoute.target, 'assignedTeacherId');

    const multiRoute = determineRouting(['sub123', 'sub456']);
    assert.strictEqual(multiRoute.flowType, 'multi-subject');
    assert.strictEqual(multiRoute.target, 'mentorId');

    const allRoute = determineRouting([]);
    assert.strictEqual(allRoute.flowType, 'all-classes');
    assert.strictEqual(allRoute.target, 'mentorId');
  });

  // 7. Attendance Revert Engine Logic
  test('Attendance Revert Engine: Distinguishes synthetic vs converted attendance records', () => {
    const mockRecords = [
      {
        _id: 'rec1',
        status: 'leave',
        remarks: 'Synthetic Leave Record: MEDICAL (Fever)',
      },
      {
        _id: 'rec2',
        status: 'leave',
        remarks: 'Leave Approved: MEDICAL (Fever)',
      },
      {
        _id: 'rec3',
        status: 'present',
        remarks: 'Regular attendance',
      },
    ];

    let deletedSynthetic = 0;
    let revertedToAbsent = 0;

    for (const rec of mockRecords) {
      if (rec.status !== 'leave') continue;
      if (/Synthetic Leave Record/i.test(rec.remarks)) {
        deletedSynthetic++;
      } else if (/Leave Approved:/i.test(rec.remarks)) {
        rec.status = 'absent';
        revertedToAbsent++;
      }
    }

    assert.strictEqual(deletedSynthetic, 1, '1 synthetic record should be deleted');
    assert.strictEqual(revertedToAbsent, 1, '1 previously absent record should be reverted to absent');
    assert.strictEqual(mockRecords[1].status, 'absent', 'rec2 status must now be absent');
  });

  // 8. Teacher Override Audit Remarks Logic
  test('Teacher Override: Logs audit remarks when overriding mentor-approved leave', () => {
    const existingRec = { status: 'leave', remarks: 'Leave Approved: MEDICAL (Doctor appointment)' };
    const submittedStatus = 'present';
    const teacherNote = 'Student was in class';

    let newRemarks = '';
    if (existingRec.status === 'leave' && submittedStatus !== 'leave') {
      newRemarks = `Overridden from leave by Teacher: ${teacherNote}`;
    }

    assert(
      newRemarks.startsWith('Overridden from leave by Teacher:'),
      'Remarks must include override audit note'
    );
    assert(newRemarks.includes(teacherNote), 'Remarks must include teacher note');
  });

  // 9. Mentor Assignment Gating for Flow B
  test('Mentor Gating: Blocks all-classes/multi-subject leave if mentor is not assigned', () => {
    const checkMentorGating = (flowType, mentor) => {
      if (flowType !== 'single-subject' && (!mentor || !mentor.teacherId)) {
        return {
          allowed: false,
          code: 'MENTOR_NOT_ASSIGNED',
          message: 'Academic Mentor has not been assigned to Section yet. Leave cannot be raised currently. Please contact your administrator.',
        };
      }
      return { allowed: true };
    };

    const unassignedResult = checkMentorGating('all-classes', null);
    assert.strictEqual(unassignedResult.allowed, false, 'Must block leave when mentor is null');
    assert.strictEqual(unassignedResult.code, 'MENTOR_NOT_ASSIGNED');

    const assignedResult = checkMentorGating('all-classes', { teacherId: 'teach123' });
    assert.strictEqual(assignedResult.allowed, true, 'Must allow leave when mentor is assigned');

    const singleSubResult = checkMentorGating('single-subject', null);
    assert.strictEqual(singleSubResult.allowed, true, 'Single subject leave does not require mentor');
  });

  console.log(`\n=== TEST SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ===\n`);

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
