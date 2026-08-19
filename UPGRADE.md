# AttendEase Upgrade Plan

> Phase: User Model Cleanup + Attendance Sync + Response Filtering
> Created: 2026-08-13

---

## Phase 1: User Model Cleanup

### 1.1 Remove Dead Fields from `backend/models/User.js`

| Field | Line | Reason |
|-------|------|--------|
| `isSuperAdmin` | 32-35 | Redundant with `role === "super_admin"` — entire codebase checks `role`, never this boolean |
| `registrationNumber` | 99 | Never read/written by any controller, route, or frontend component |
| `hostelStudent` | 100 | Never read/written by any controller, route, or frontend component |
| `resetPasswordToken` | 104 | Superseded by `passwordResetToken` (line 106) — dead code |
| `resetPasswordExpires` | 105 | Superseded by `passwordResetExpires` (line 107) — dead code |
| `emailVerificationToken` | 109 | No email verification flow exists — vestigial code |

**Also remove:**
- `isSuperAdmin` index at line 156: `userSchema.index({ isSuperAdmin: 1 });`

**Update references in other files:**
- `backend/seedAdmin.js` — remove any `isSuperAdmin: true` from seed data
- `backend/controllers/authController.js:108` — remove `isSuperAdmin: user.role === 'super_admin'` from JWT payload (already covered by `role` field)
- `backend/middleware/auth.js` — remove any `isSuperAdmin` references in token decoding/verification

### 1.2 Fix Duplicate Field

Remove `admissionYear` at line 98 (keep line 130 which has `default: null`):
```js
// REMOVE line 98:
admissionYear: Number,

// KEEP line 130:
admissionYear: { type: Number, default: null },
```

### 1.3 Add Missing Schema Field

`loginCount` is used in `authController.js:99,218` and `auth.js:169` but not declared in the schema. MongoDB stores it as an implicit field. Add it explicitly:

```js
loginCount: { type: Number, default: 0 },
```

Place it near `lastLoginAt` / `lastLoginIP` (around line 96).

### 1.4 Clean Up Vestigial `emailVerified`

Currently always set to `true` on creation, never checked to gate access. Change default to `true`:
```js
emailVerified: { type: Boolean, default: true },
```

---

## Phase 2: Attendance Sync System

### 2.1 Current State (Broken)

The sync chain is broken — `User.attendance` and `User.subjectAttendance` are **never updated** after attendance is marked:

```
markAttendance controller
  → addStatRecalcJob (Bull queue / setImmediate fallback)
    → updateStudentAttendanceStats
      → Updates Attendance.studentStats (running totals on each Attendance record)
      → Does NOT call user.updateAttendanceSummary()
      → User.attendance stays at default {totalClasses:0, presentCount:0, ...} forever
```

The `User.updateAttendanceSummary()` method exists (User.js:159-211) but is never called by any controller after marking attendance.

### 2.2 Fix: Call `updateAttendanceSummary()` After Marking

**File: `backend/controllers/attendanceController.js`**

In `markAttendance` function, after the queue job dispatch block (after line 251), add:

```js
// Sync User denormalized attendance fields
for (const studentId of processedStudentIds) {
  try {
    const student = await User.findById(studentId);
    if (student && typeof student.updateAttendanceSummary === 'function') {
      await student.updateAttendanceSummary();
    }
  } catch (syncErr) {
    logger.error(`Failed to sync User.attendance for student ${studentId}`, { error: syncErr.message });
  }
}
```

### 2.3 Optimize `updateAttendanceSummary()`

**File: `backend/models/User.js`**

Replace the current implementation (lines 159-211) with an aggregation-based version that doesn't fetch all records into memory:

```js
userSchema.methods.updateAttendanceSummary = async function () {
  const Attendance = mongoose.model("Attendance");
  const matchStage = { studentId: this._id, tenantId: this.tenantId };

  // Overall stats
  const [overall] = await Attendance.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalClasses: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
      },
    },
  ]);

  // Per-subject stats
  const subjectAgg = await Attendance.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$subjectId",
        subjectName: { $first: "$subject.subjectName" },
        subjectCode: { $first: "$subject.subjectCode" },
        totalClasses: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
        lastAttended: { $max: "$date" },
      },
    },
    {
      $addFields: {
        percentage: {
          $cond: [
            { $eq: ["$totalClasses", 0] }, 0,
            { $multiply: [{ $divide: ["$presentCount", "$totalClasses"] }, 100] },
          ],
        },
      },
    },
  ]);

  if (overall) {
    this.attendance = {
      totalClasses: overall.totalClasses,
      presentCount: overall.presentCount,
      absentCount: overall.absentCount,
      leaveCount: overall.leaveCount,
      overallPercentage:
        overall.totalClasses > 0
          ? (overall.presentCount / overall.totalClasses) * 100
          : 0,
    };
  }

  this.subjectAttendance = subjectAgg.map((s) => ({
    subjectId: s._id,
    subjectName: s.subjectName,
    subjectCode: s.subjectCode,
    totalClasses: s.totalClasses,
    presentCount: s.presentCount,
    absentCount: s.absentCount,
    leaveCount: s.leaveCount,
    percentage: s.percentage,
    lastAttended: s.lastAttended,
  }));

  await this.save();
};
```

### 2.4 Sync on Attendance Update

**File: `backend/controllers/attendanceController.js`**

In `updateAttendanceRecord` (after line 966 `updateStudentAttendanceStats`), add:

```js
// Sync User model
try {
  const student = await User.findById(attendance.studentId);
  if (student) await student.updateAttendanceSummary();
} catch (e) {
  logger.error("Failed to sync User.attendance after update", { error: e.message });
}
```

### 2.5 Sync on Attendance Delete

In `deleteAttendanceRecord` (after the record is deleted), add:

```js
// Sync User model
try {
  const student = await User.findById(deletedRecord.studentId);
  if (student) await student.updateAttendanceSummary();
} catch (e) {
  logger.error("Failed to sync User.attendance after delete", { error: e.message });
}
```

### 2.6 Sync on Ticket Verification (Mark Present)

In the ticket controller where a teacher verifies an absence ticket and marks attendance, also trigger `user.updateAttendanceSummary()` after the attendance record is created.

---

## Phase 3: Complete Attendance History Endpoint

### 3.1 New Endpoint: `GET /api/attendance/history`

**File: `backend/controllers/attendanceController.js`** — Add new controller function

```js
const getAttendanceHistory = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const role = req.user.role;
    const {
      studentId,
      subjectId,
      section,
      fromDate,
      toDate,
      status,
      page = 1,
      limit = 50,
    } = req.query;

    let query = { tenantId };

    // Role-based filtering
    if (role === "student") {
      query.studentId = req.user._id;
    } else if (role === "teacher") {
      // Teachers see only their assigned sections
      const assignedSections = [
        ...new Set(
          (req.user.assignedSubjects || []).map((a) => a.section).filter(Boolean)
        ),
      ];
      if (assignedSections.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          stats: { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0, percentage: 0 },
          pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        });
      }
      query.section = { $in: assignedSections };
      if (section && assignedSections.includes(section.toUpperCase())) {
        query.section = section.toUpperCase();
      }
    } else if (role === "parent") {
      // Parent views their linked child's attendance
      if (studentId) {
        query.studentId = studentId;
      } else {
        // Find linked student via parentEmail
        const linkedStudent = await User.findOne({
          parentEmail: req.user.email,
          tenantId,
          role: "student",
        }).select("_id");
        if (!linkedStudent) {
          return res.status(200).json({
            success: true,
            data: [],
            stats: { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0, percentage: 0 },
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
          });
        }
        query.studentId = linkedStudent._id;
      }
    }
    // admin / super_admin: no student filter (sees all in tenant)

    // Optional filters
    if (studentId && ["admin", "super_admin"].includes(role)) {
      query.studentId = studentId;
    }
    if (subjectId) query.subjectId = subjectId;
    if (section && role === "admin") query.section = section.toUpperCase();
    if (status && ["present", "absent", "leave"].includes(status)) {
      query.status = status;
    }
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (p - 1) * l;

    const [records, total] = await Promise.all([
      Attendance.find(query)
        .populate("subjectId", "subjectCode subjectName")
        .populate("teacherId", "name")
        .sort({ date: -1 })
        .skip(skip)
        .limit(l)
        .lean(),
      Attendance.countDocuments(query),
    ]);

    // Aggregate stats for the filtered query (not paginated)
    const [statsAgg] = await Attendance.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalClasses: { $sum: 1 },
          presentCount: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absentCount: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          leaveCount: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
        },
      },
    ]);

    const stats = statsAgg || { totalClasses: 0, presentCount: 0, absentCount: 0, leaveCount: 0 };
    stats.percentage = stats.totalClasses > 0
      ? Number(((stats.presentCount / stats.totalClasses) * 100).toFixed(2))
      : 0;

    const formattedRecords = records.map((r) => ({
      id: r._id,
      date: r.date,
      day: r.day,
      startTime: r.startTime,
      endTime: r.endTime,
      room: r.room,
      subject: {
        id: r.subjectId?._id,
        code: r.subjectId?.subjectCode || r.subject?.subjectCode,
        name: r.subjectId?.subjectName || r.subject?.subjectName,
      },
      teacher: {
        id: r.teacherId?._id,
        name: r.teacherId?.name,
      },
      status: r.status,
      remarks: r.remarks,
      section: r.section,
      semester: r.semester,
      classSessionId: r.classSessionId,
    }));

    return res.status(200).json({
      success: true,
      data: formattedRecords,
      stats,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l),
        hasNextPage: p * l < total,
        hasPrevPage: p > 1,
      },
    });
  } catch (error) {
    logger.error("Error fetching attendance history", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Error fetching attendance history",
      error: error.message,
    });
  }
};
```

### 3.2 Register the Route

**File: `backend/routes/attendanceRoute.js`**

Add after the `/stats` route (around line 125):

```js
/**
 * GET /api/attendance/history
 * Full attendance history for all roles (student/teacher/parent/admin)
 * Query: ?studentId=&subjectId=&section=&fromDate=&toDate=&status=&page=&limit=
 */
attendanceRoute.get(
  "/history",
  authenticateToken,
  authorizeRoles(["student", "teacher", "admin", "super_admin", "parent"]),
  featureGuard("attendance"),
  getAttendanceHistory
);
```

Add `getAttendanceHistory` to the imports at the top of the file.

---

## Phase 4: API Response Filtering

### 4.1 Create Response Formatter Utility

**File: `backend/utils/responseFormatter.js`** (New)

```js
/**
 * Role-based field selection for User objects in API responses.
 * Ensures students don't see teacher-specific fields, etc.
 */

const ROLE_FIELDS = {
  super_admin: [
    "_id", "name", "email", "role", "tenantId", "isActive",
    "lastLoginAt", "lastLoginIP", "twoFactorEnabled",
    "tokenVersion", "emailVerified", "createdAt", "loginCount",
  ],
  admin: [
    "_id", "name", "email", "role", "tenantId", "isActive",
    "lastLoginAt", "lastLoginIP", "twoFactorEnabled",
    "profileComplete", "isFirstLogin", "createdByAdmin",
    "tokenVersion", "emailVerified", "createdAt", "loginCount",
  ],
  teacher: [
    "_id", "name", "email", "role", "tenantId", "isActive",
    "rollNo", "assignedSubjects", "qualification", "specialization",
    "joiningDate", "customRoles", "phone", "address",
    "isFirstLogin", "createdByAdmin", "lastLoginAt", "lastLoginIP",
    "twoFactorEnabled", "tokenVersion", "emailVerified", "createdAt",
    "loginCount",
  ],
  student: [
    "_id", "name", "email", "role", "tenantId", "isActive",
    "section", "rollNo", "courseId", "courseName", "branch",
    "semester", "admissionYear", "academicYear", "totalSemesters",
    "holdPromotion", "academicStatus", "parentName", "parentPhone",
    "parentEmail", "attendance", "subjectAttendance", "phone",
    "address", "createdByAdmin", "lastLoginAt", "lastLoginIP",
    "twoFactorEnabled", "tokenVersion", "emailVerified", "createdAt",
    "loginCount",
  ],
  parent: [
    "_id", "name", "email", "role", "tenantId", "isActive",
    "lastLoginAt", "lastLoginIP", "twoFactorEnabled",
    "tokenVersion", "emailVerified", "createdAt",
  ],
};

function filterUserByRole(user, role) {
  if (!user || typeof user.toObject === "function") {
    user = typeof user.toObject === "function" ? user.toObject() : { ...user };
  }
  const fields = ROLE_FIELDS[role] || ["_id", "name", "email", "role"];
  const filtered = {};
  fields.forEach((field) => {
    if (user[field] !== undefined) {
      filtered[field] = user[field];
    }
  });
  filtered._id = user._id;
  return filtered;
}

function filterUsersByRole(users, role) {
  return users.map((u) => filterUserByRole(u, role));
}

module.exports = { filterUserByRole, filterUsersByRole, ROLE_FIELDS };
```

### 4.2 Create Auto-Filter Middleware

**File: `backend/middleware/responseFilter.js`** (New)

```js
const { filterUserByRole, filterUsersByRole } = require("../utils/responseFormatter");

/**
 * Middleware that intercepts res.json() and filters User objects
 * based on the requesting user's role.
 */
const autoFilterUserResponses = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (data) => {
    if (!data || !req.user) return originalJson(data);

    const role = req.user.role;

    // Filter single user object: { user: {...} }
    if (data.user && typeof data.user === "object" && !Array.isArray(data.user) && data.user.email) {
      data.user = filterUserByRole(data.user, role);
    }

    // Filter arrays of user objects
    const arrayKeys = ["users", "students", "teachers", "admins"];
    arrayKeys.forEach((key) => {
      if (Array.isArray(data[key]) && data[key].length > 0 && data[key][0]?.email) {
        data[key] = filterUsersByRole(data[key], role);
      }
    });

    // Filter "data" arrays that contain user objects (heuristic: has email field)
    if (Array.isArray(data.data) && data.data.length > 0 && data.data[0]?.email) {
      data.data = filterUsersByRole(data.data, role);
    }

    return originalJson(data);
  };

  next();
};

module.exports = { autoFilterUserResponses };
```

### 4.3 Register Middleware

**File: `backend/index.js`**

Import and apply after `authenticateToken`:

```js
const { autoFilterUserResponses } = require("./middleware/responseFilter");

// Apply after auth middleware, before routes
app.use("/api", authenticateToken, autoFilterUserResponses);
```

Or alternatively, apply per-route-group after their respective auth middleware. The global approach is simpler.

---

## Phase 5: Frontend — Attendance History

### 5.1 New Component: `AttendanceHistory.jsx`

**File: `frontend/src/component/AttendanceHistory/index.jsx`** (New)

A shared component used by all roles:

```jsx
// Props:
//   role: "student" | "teacher" | "parent" | "admin"
//   studentId?: string  (for parent viewing child, admin viewing any student)
//   showStudentSelector?: boolean  (admin only — dropdown to pick student)
//   compact?: boolean  (for embedding in dashboards — fewer stats)
```

**Features:**
- Date range picker (from / to)
- Subject filter dropdown (fetches from `/subjects/all`)
- Status filter: All / Present / Absent / Leave
- Paginated table with columns:
  - Date (formatted)
  - Day (Monday, Tuesday...)
  - Time (startTime – endTime)
  - Subject (code + name)
  - Teacher name
  - Room
  - Status (color-coded Badge)
  - Remarks (if any)
- Summary stat cards at top:
  - Total Classes
  - Present (count + %)
  - Absent (count + %)
  - Leave (count + %)
- CSV export button

**API call:** `GET /api/attendance/history?studentId=&subjectId=&fromDate=&toDate=&status=&page=&limit=`

### 5.2 Update StudentDashboard

**File: `frontend/src/component/Dashboard/index.jsx`**

Add an "Attendance History" tab alongside existing tabs (Overview, Analytics, Tickets):
- Renders `<AttendanceHistory role="student" />`
- Student sees only their own records (enforced by backend)

### 5.3 Update ParentDashboard

**File: `frontend/src/component/ParentDashboard/index.jsx`**

Add an "Attendance History" section:
- Renders `<AttendanceHistory role="parent" />`
- Parent sees their linked child's records (enforced by backend via parentEmail match)

### 5.4 Update AdminDashboard

**File: `frontend/src/component/Admin/AdminDashboard.jsx`**

Add an attendance overview section:
- Call existing `GET /api/attendance/admin/dashboard/stats` endpoint
- Display stat cards: Today's attendance rate, Overall attendance rate, Low-attendance students count
- Add a "Low Attendance Students" mini-table (top 10)
- Quick action link: "View Full Attendance" → `/attendance-history`

### 5.5 Update ReportsManager

**File: `frontend/src/component/Admin/ReportsManager.jsx`**

Add "Attendance History" as a tab or section alongside the existing report table:
- Renders `<AttendanceHistory role="admin" showStudentSelector />`
- Admin can filter by student, subject, date range, status

### 5.6 Add Nav Items to AppShell

**File: `frontend/src/component/common/AppShell.jsx`**

Update `roleNav`:

**Admin sidebar** — Add under Academics group:
```js
{
  label: "Attendance",
  path: "/attendance-history",
  icon: ClipboardCheck,
  // No module gate — attendance is always available
}
```

**Student sidebar** — Add under Overview group:
```js
{
  label: "Attendance",
  path: "/attendance-history",
  icon: ClipboardCheck,
}
```

**Parent sidebar** — Add under Overview group:
```js
{
  label: "Attendance",
  path: "/attendance-history",
  icon: ClipboardCheck,
}
```

### 5.7 Add Routes in App.js

**File: `frontend/src/App.js`**

Add new route:
```jsx
<Route
  path="/attendance-history"
  element={
    <Protected>
      <Shell>
        <AttendanceHistory />
      </Shell>
    </Protected>
  }
/>
```

The `AttendanceHistory` component reads `userRole` from context and adjusts behavior accordingly (student sees own, parent sees child, admin sees all with student selector).

---

## Phase 6: Implementation Order

| Step | Task | Files | Est. Time |
|------|------|-------|-----------|
| 1 | Remove dead fields from User model | `User.js`, `seedAdmin.js`, `authController.js`, `auth.js` | 30 min |
| 2 | Fix duplicate `admissionYear`, add `loginCount` | `User.js` | 15 min |
| 3 | Optimize `updateAttendanceSummary()` | `User.js` | 30 min |
| 4 | Fix Attendance → User sync in markAttendance | `attendanceController.js` | 30 min |
| 5 | Add sync on attendance update/delete | `attendanceController.js` | 30 min |
| 6 | Create `GET /attendance/history` endpoint | `attendanceController.js`, `attendanceRoute.js` | 1 hour |
| 7 | Create `responseFormatter.js` + `responseFilter.js` | New files | 45 min |
| 8 | Register response filter middleware | `index.js` | 15 min |
| 9 | Create `AttendanceHistory.jsx` component | New file | 2 hours |
| 10 | Update StudentDashboard | `Dashboard/index.jsx` | 30 min |
| 11 | Update ParentDashboard | `ParentDashboard/index.jsx` | 30 min |
| 12 | Update AdminDashboard | `Admin/AdminDashboard.jsx` | 1 hour |
| 13 | Update ReportsManager | `Admin/ReportsManager.jsx` | 30 min |
| 14 | Add nav items + routes | `AppShell.jsx`, `App.js` | 30 min |
| 15 | Testing & verification | All | 2 hours |

**Total estimated time: ~10 hours**

---

## Phase 7: Testing Checklist

### Model Cleanup
- [ ] Dead fields removed from User schema — no import/reference errors
- [ ] `isSuperAdmin` removed from seedAdmin.js
- [ ] `isSuperAdmin` removed from JWT payload in authController.js
- [ ] `loginCount` increments on each login (check via `GET /auth/sessions`)
- [ ] Duplicate `admissionYear` resolved — students still have correct admission year

### Attendance Sync
- [ ] After teacher marks attendance, `User.attendance` is updated for each student
- [ ] After teacher marks attendance, `User.subjectAttendance[]` is updated per subject
- [ ] After teacher updates an attendance record, `User.attendance` re-syncs
- [ ] After teacher deletes an attendance record, `User.attendance` re-syncs
- [ ] `User.attendance.overallPercentage` matches computed value from Attendance collection

### Attendance History Endpoint
- [ ] `GET /attendance/history` returns paginated records for students (own only)
- [ ] `GET /attendance/history` returns records for teachers (assigned sections only)
- [ ] `GET /attendance/history` returns records for parents (linked child only)
- [ ] `GET /attendance/history` returns all records for admins (full tenant)
- [ ] Filters work: studentId, subjectId, section, fromDate, toDate, status
- [ ] Response includes: date, day, startTime, endTime, room, subject, teacher, status, remarks

### Response Filtering
- [ ] Student API responses don't contain `assignedSubjects`, `qualification`, etc.
- [ ] Teacher API responses don't contain `courseId`, `parentName`, etc.
- [ ] Parent API responses contain only basic profile fields
- [ ] Admin/SuperAdmin responses contain all fields
- [ ] No breaking changes to existing frontend components

### Frontend
- [ ] AttendanceHistory component renders for student role (own data only)
- [ ] AttendanceHistory component renders for parent role (child data)
- [ ] AttendanceHistory component renders for admin role (with student selector)
- [ ] Date range filter works
- [ ] Subject filter works
- [ ] Status filter works
- [ ] Pagination works
- [ ] CSV export works
- [ ] StudentDashboard shows Attendance History tab
- [ ] ParentDashboard shows Attendance History section
- [ ] AdminDashboard shows attendance stats overview
- [ ] Sidebar nav items appear for correct roles
- [ ] `npm run build` passes with 0 errors
- [ ] ESLint reports 0 errors

---

## Notes

- **No backwards compatibility needed** — all existing data will be deleted and replaced with a large test dataset
- **`loginCount`** is used in code but not declared in the User schema — MongoDB stores it implicitly; we add it explicitly for clarity
- **Dual storage** (parent contact fields on both User and Enrollment) is kept as-is for now
- **Attendance model's `studentStats`** field is updated by the Bull queue; `User.attendance` is updated by the new sync code — both stay in sync
