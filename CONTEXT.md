# AttendEase — Project Context

> Last updated: 2026-08-05 (Phase 5 + Invigilator feature complete)

This file is the fast on-ramp for anyone (human or AI) working on AttendEase. It covers what the product is, how it's built, and the conventions that matter for adding features — without a full repo scan.

---

## About / What It Is

AttendEase is a **multi-tenant SaaS platform for educational institutions** (schools, colleges, institutes). It replaces scattered spreadsheets and paper workflows with one system that manages attendance, timetables, academic structure (courses/branches/semesters), exams & grades, fees & payments, enrollments, custom staff roles, and tenant-level plans/billing.

The repo is a monolith with two apps:

- **Backend** — Node.js + Express REST API backed by MongoDB (Mongoose). JWT auth with role-based access, permission-level RBAC, plan-based feature gating, rate limiting, file uploads, and Razorpay billing.
- **Frontend** — React 18 SPA (Create React App) with Tailwind + a shared UI kit, a persistent role-aware app shell, tenant-branded design tokens, and plan/permission-aware navigation.

### User roles
- **Super Admin** — cross-tenant: tenants, plans, support dashboard, monitoring.
- **Tenant Admin** — their institution: teachers, subjects, students, timetable, attendance, exams, fees, academic structure, custom roles, settings, billing.
- **Teacher** — assigned subjects/sections: mark attendance, view timetable, manage their own role duties/alerts.
- **Student** — attendance overview, subjects, fee portal, exam schedule/results.
- **Parent** — view their children's attendance and alerts.

---

### Role-Feature Matrix

| Feature / Module | Super Admin | Tenant Admin | Teacher | Student | Parent |
|---|:---:|:---:|:---:|:---:|:---:|
| Tenant & Plan Management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Platform Analytics & Logs | ✅ | ❌ | ❌ | ❌ | ❌ |
| Academic Structure & Settings | ✅ (Support) | ✅ | ❌ | ❌ | ❌ |
| Manage Teachers & Subjects | ✅ (Support) | ✅ | ❌ | ❌ | ❌ |
| Timetable Creation | ✅ (Support) | ✅ | ❌ | ❌ | ❌ |
| Mark Attendance | ✅ (Support) | ✅ | ✅ | ❌ | ❌ |
| View Own Attendance | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exams & Grade Entry | ✅ (Support) | ✅ | ✅ (Assigned) | ❌ | ❌ |
| View Exam Schedule/Results | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fee Management | ✅ (Support) | ✅ | ❌ | ❌ | ❌ |
| Student Self-Pay Fees | ✅ | ✅ | ❌ | ✅ | ✅ |
| Custom Role & Permission CRUD | ✅ (Support) | ✅ | ❌ | ❌ | ❌ |
| Announcements & Alerts | ✅ (Support) | ✅ | ✅ (Broadcaster) | 👁️ (View) | 👁️ (View) |

---

### Middleware & Authorization System Developer Guide

1. **`authenticateToken`**:
   - Decodes JWT, validates active user session.
   - Populates `req.user`, `req.tenant`, and auto-scopes `req.query.tenantId` for non-super-admins.
   - **Must be applied first** on all protected routes.

2. **`authorizeRoles('admin', 'teacher')`**:
   - Validates user role against allowed list.
   - **`super_admin` automatically passes** all `authorizeRoles` checks (support mode).

3. **`adminAuth`**:
   - Standard guard for tenant admin routes. Allows both `admin` and `super_admin`.

4. **`superAdminAuth`**:
   - Platform guard strictly enforcing `req.user.role === 'super_admin'`.

5. **`requirePermission('module:action')`**:
   - Granular permission check reading custom role permissions from `req.user.customRoles`.

6. **`featureGuard('module_name')`**:
   - Plan-level feature flag guard returning `403 { upgradeRequired: true }` if tenant plan lacks module.

---

## Repo Layout

```
attendease_/
├── backend/                  # Node.js + Express API
│   ├── controllers/          # Business logic (one file per resource)
│   ├── middleware/           # auth, permission, featureGuard, rateLimiter, multer, tenantScope, validate, responseFilter, ...
│   ├── models/               # Mongoose schemas (User, Tenant, Plan, Attendance, Timetable, etc.)
│   ├── routes/               # API endpoint definitions (one file per resource)
│   ├── validators/           # express-validator schemas
│   ├── docs/                 # OpenAPI 3.0 spec (openapi.yaml)
│   ├── queues/               # Redis Bull queues
│   ├── utils/                # responseFormatter, planDefaults, logger, email, razorpay, ...
│   ├── index.js              # Server entry point (port 8011)
│   └── seedAdmin.js          # Super-admin seeding script
│
└── frontend/                 # React 18 SPA
    └── src/
        ├── component/        # Pages & shared components
        │   ├── common/ui/    # Shared UI kit (Button, Card, Modal, Table, Badge, PageHeader, ...)
        │   ├── common/       # AppShell, PlanGate, PricingModal, ErrorBoundary
        │   ├── AttendanceHistory/ # Shared attendance history view
        │   ├── Admin/        # Tenant-admin pages
        │   ├── SuperAdmin/   # Cross-tenant pages
        │   ├── Landing/      # Public marketing pages
        │   └── ...           # teacherDashboard, ParentDashboard, Dashboard, profile, etc.
        ├── contexts/         # PermissionsContext, ThemeContexts, ToastContext
        ├── hooks/            # useThemeColors (shared theme hook)
        ├── utils/            # api.js, billing.js, loginPath.js, theme.js, logger.js
        ├── App.js            # Routing + Protected/Shell wrappers + ErrorBoundary + ToastProvider
        └── index.js
```

---

## Tech Stack

**Backend**: Express 4 · MongoDB + Mongoose · JWT (`jsonwebtoken`) · `bcryptjs` · Redis Bull + `ioredis` (queues) · Razorpay · Nodemailer · Helmet · `express-rate-limit` · CORS · Multer · `csv-parser` · `speakeasy` + `qrcode` (2FA) · `express-validator` (request validation).

**Frontend**: React 18 · React Router v6 · Tailwind CSS · Styled Components · Framer Motion · Headless UI · Radix Select · Lucide + Heroicons + React Icons · Recharts · React Table · date-fns · React Datepicker/Calendar · Axios · `xlsx` (bulk import/export) · `@testing-library/react` + `jest` + `msw` (testing).

---

## Domain Model (Mongo collections)

| Model | Purpose |
|-------|---------|
| `User` | All users (admin/teacher/student/parent). Fields: role, `assignedSubjects[]`, `assignedRoles[]`, `courseId/courseName/branch/semester`, academic status, `tokenVersion` (session invalidation), 2FA secret. |
| `Tenant` | Institution/org. `settings.semesterStructure`, `settings.examStructure` (examTypes + shifts), `settings.examPeriods`, `branding.logo/favicon`, `subscription.plan`. |
| `Plan` | Pricing plans; `modules{}` + `limits{}`. **`utils/planDefaults.js` is the source of truth** (see conventions). |
| `Course` | Academic programs (`code`, `branches[]`, `durationYears`, `semestersPerYear`). Now includes `feeStructure` (enabled, totalFee, feePeriod: semester|year, description). |
| `Subject` | Subjects under a course; `courseId/courseCode/branch/semester`, `isActive`. |
| `Timetable` | Scheduled classes; denormalized `section/courseCode/courseId/branch/semester`, day/startTime/endTime/room, teacher + subject refs, `isNoClass`. |
| `Attendance` | Per-student records; denormalized `timetableId/day/startTime/endTime/room` from the scheduled slot. |
| `Enrollment` | Student ↔ subject/section enrollment (subjects carry `teacherId`). |
| `Exam` / `ExamResult` | Exams + per-student grades. Exam model includes `courseId`, `branch`, `semester`, `shift` (I-IV), `duration`, `examTypeCode`, `examPeriodId`, `invigilators` (array of User refs, max 2). |
| `Fee` / `Transaction` | Student fees, receipts, payments, waivers. Fee model now includes `courseId`, `section`, `semester`. Fee types simplified to `tuition|transport|hostel|other`. |
| `CustomRole` | Tenant-defined roles; **permissions stored in `permissions` field**. |
| `Calendar` | Schedule/event entries. |
| `Alert` / `Ticket` | Notifications; attendance tickets (reasons/mark actions). |
| `SupportTicket` | Expired-tenant reactivation / support flow. |
| `Invoice` | Billing invoices per plan cycle. |
| `APILog` | API logging/monitoring. |

---

## API Surface (routes/ → resource)

`authRoutes` (login/register/2FA/sessions) · `adminRoute` (teachers, assignments, uploads) · `subjectRoute` · `studentRoutes` · `attendanceRoute` · `timetableRoutes` · `examRoutes` · `feeRoutes` · `academicRoutes` (`/api/academic`, courses + promotion) · `roleRoutes` · `tenantRoutes` (settings, branding, usage) · `billingRoutes` (subscriptions, payments, invoices) · `planRoutes` (super-admin plan CRUD) · `supportRoutes` · `reportsRoutes` · `parentRoutes` · `calendarRoute` · `alertRoute` · `ticketRoute` · `landingRoutes` (public) · `userRoute`/`user.js`.

---

## Key Conventions (read before adding features)

### Backend
- **Tenant scoping**: every query filters by `tenantId`. `authenticateToken` sets `req.user` and `req.tenant` (plan may be a full Tenant doc or a flattened `req.tenant.plan` — code must tolerate both). **As of Phase 1, `authenticateToken` auto-injects `req.query.tenantId` for non-super-admins**, so downstream controllers can rely on `req.query.tenantId` being present. Super admins are never scoped (their `req.query.tenantId` is not set).
- **Authz stack**: `authenticateToken` → `adminAuth`/`teacherAuth`/`superAdminAuth`/`authorizeRoles([...])` → `requirePermission("res:action")` / `requireAnyPermission` (`middleware/permission.js`). **CustomRole permissions live in `role.permissions` (not `permissionList`)** — middleware reads `permissions`.
- **Plan gating**: `featureGuard("module_key")` returns **403 `{upgradeRequired:true}`** when the tenant's plan lacks the module. Wire the frontend to open the upgrade modal via `openUpgradeForError` on 403.
  - `featureGuard` normalizes snake_case ↔ camelCase (`bulk_operations` ↔ `bulkOperations`).
  - **`utils/planDefaults.js` is the source of truth for `modules`/`limits`.** Do NOT add schema defaults for module flags — Mongoose materializes unset paths as `undefined/false`, which would override planDefaults; `getEffectiveModules` only lets explicit `!== undefined/null` DB values win.
- **Request validation**: `express-validator` schemas in `validators/` + `middleware/validate.js` wrapper. All POST/PUT routes now validate input before controller logic.
- **Feature guards**: All gated modules (attendance, exams, fees, timetable, academic, calendar, alerts, reports, parent portal) now have backend `featureGuard` applied (Phase 2).
- **Security headers**: Helmet configured with CSP (prod), HSTS (prod), X-Content-Type-Options, Referrer-Policy, X-Frame-Options, X-XSS-Protection.
- **Bulk endpoints** (exams, timetable, courses) share one pattern: body `{ <bodyKey>: [...] }`, per-row errors returned as `400 { message, errors:[{index,error}] }` **before any insert** (reject-all), then `Model.insertMany(valid, {ordered:false})` → 201, duplicate key → 409. Gated by `featureGuard("bulk_operations")` + role/permission guards.
- **Bulk name→id resolution**: `resolveBulkReferences` (timetable) / per-controller equivalents resolve `subjectId/teacherId/courseId` from names/codes when IDs are blank. Keep this server-side tolerant (e.g., branches as object-array, JSON string, or plain string array).
- **Timetable**: section is *derived* from the teacher→subject assignment (`resolveSection`), never required from the client; `validateEntry` is section-aware. Conflict checks (`findConflicts`, intra-batch) are course-aware (same section + different course ≠ clash). Attendance (`markAttendance`) requires a scheduled Timetable slot and stores `timetableId`.
- **Exam system**: Exams use a **Date×Shift grid** (like Timetable's Day×Time). Exams are scoped by `tenantId`, `section`, `date`, and `shift` (I-IV). Conflict detection mirrors timetable: same section + same date + overlapping time = conflict. Auto-fills `startTime`/`endTime`/`duration` from the tenant's shift definitions. `maxMarks` defaults from exam type definitions. The `examStructure` module (enterprise-only) controls exam types, shifts, and periods stored in `Tenant.settings.examStructure` + `Tenant.settings.examPeriods`. `utils/planDefaults.js` is source of truth: `examStructure: false` (free/basic/professional), `true` (enterprise). Invigilator assignment: max 2 per exam; conflict detection prevents same teacher at overlapping times; teacher exam duty view via `GET /exams/my-duty`.
- **Teacher payloads**: `/admin/teachers` returns `assignmentsBySection` (object keyed by section, **NOT array**); the teacher path uses `/subjects/all` → `assignedSubjects.subjects`.
- **Rate limiting** per route; super-admin monitors via `APILog` + `monitoringController`. Auth endpoints have dedicated limiters (`loginLimiter`, `authLimiter`).
- **Structured logging**: All controllers use `const logger = require("../utils/logger")` with `logger.error("message", { error: error.message })`. No `console.error` remains in controllers.

### Frontend
- **Design tokens**: `tailwind.config.js` maps `primary/secondary/surface/background/ink/line` from `rgb(var(--color-x))` (alpha-capable). `ThemeContexts.jsx` writes RGB-triplet CSS vars from tenant branding. Pages use `bg-primary`, `text-ink`, `border-line`, etc. — never hard-coded hex.
- **Shared UI kit** (`src/component/common/ui/`): `Button`, `Card`, `Modal`, `Table`, `Badge`, `Input`/`Select`, `StatCard`, `EmptyState`, `PageHeader`, `Skeleton`, `Pagination`, `BulkImportModal`.
- **App shell**: `AppShell.jsx` = role-aware sidebar (grouped nav, plan-gated modules, tenant name/logo) + sticky topbar. `App.js` wraps routes with `Protected` (waits for permissions to load before deciding — prevents silent redirects) + `Shell`. Route/nav gating uses `Protected` + `PlanGate` + `PermissionsContext.can()`.
- **Bulk import**: `BulkImportModal` is file-upload-only (CSV/XLSX) and driven by props: `endpoint`, `bodyKey`, `columns` (format-guide table), `example`, `exportData`, `preValidate(rows)`, and `defaults` (auto-fills blank rows/sample with the current filter context).
- **Billing/upgrade UX**: `src/utils/billing.js` (`useUpgradeModal`) — `openUpgrade`, `openUpgradeForError`; `PricingModal` handles plan change with `onPlanChanged` re-fetch (no `window.location.reload()`).
- **HTTP**: `src/utils/api.js` (axios, JWT header). Errors surface via `err.response?.data.message`.
- **Shared theme utils**: `src/utils/theme.js` exports `hexToRgbTriplet`, `adjustColor`, `extractThemeColors`. Use these instead of duplicating color helpers in components.
- **useThemeColors hook**: `src/hooks/useThemeColors.js` wraps `ThemeContext` + theme utils. Returns `{ primary, secondary, dark, light, surface, primaryRgb, secondaryRgb, adjustColor, hexToRgbTriplet }`.
- **Structured logging**: `src/utils/logger.js` exports `logError(context, error)`. Use instead of raw `console.error`. In production only errors are logged; in dev all levels are available.
- **Error boundary**: `src/component/common/ErrorBoundary.jsx` wraps the entire app (catches render crashes). Shows a friendly fallback with "Try Again" / "Go to Dashboard".
- **Toast notifications**: `src/contexts/ToastContext.jsx` provides `useToast()` with `success()`, `error()`, `warning()`, `info()`. Use for user-facing feedback instead of local error state.

### Quality gates
- Backend: `node --check` on edited files; server runs `node index.js` (no nodemon) on port 8011.
- Frontend: `npm run build` must pass and `npx eslint` must report **0 errors** (warnings only).
- No automated test suite exists; live verification is done via admin JWTs against `http://localhost:8011/api`.

---

## API Documentation

OpenAPI 3.0 spec lives at `backend/docs/openapi.yaml`. It covers all 209 endpoints across 21 route groups with request/response schemas, auth requirements, and tag grouping. Use Swagger UI or Redocly to render it locally.

---

## Feature Inventory (implemented)

| Area | What exists |
|------|-------------|
| **Auth & accounts** | JWT login, register, 2FA (speakeasy+QR), password change, session list + "logout all" via `tokenVersion`. |
| **Multi-tenancy & billing** | Tenant CRUD, plans + module/limit gating, subscription/invoice flow (Razorpay wiring in progress), plan-usage dashboard, upgrade modal. |
| **Academic structure** | Courses → branches → semesters, student promotion preview + promote/graduate, academic semester rules. |
| **Teachers & subjects** | Teacher CRUD (hard delete w/ cascade), subject CRUD, teacher↔subject↔section assignments. |
| **Students & enrollments** | Student CRUD, section/course/branch context, CSV enrollment upload. |
| **Timetable** | Weekly grid per section/course/semester, manual + bulk add, auto section derivation, conflict/assignment validation, shared-section course picker, No Class slots. |
| **Attendance** | Mark attendance from scheduled timetable slots, attendance overview tables/detail modals, CSV export. |
| **Exams** | Date×Shift grid view, exam schedule CRUD + bulk, conflict detection, grade submission, student result views, configurable exam structure (types/shifts/periods) gated to enterprise plans, invigilator assignment (max 2) with conflict detection, teacher exam duty view. |
| **Fees** | Fee CRUD per section, collect/waive, receipts, transaction log, student fee portal, course-based fee generation (auto-creates tuition records from course fee structure). |
| **Custom roles & permissions** | Role CRUD + assignment, permission-gated routes/nav, teacher role/duties card. |
| **Settings & branding** | Feature toggles (plan-aware), usage tab, tenant branding (logo/favicon + CSS tokens), security (2FA/sessions). |
| **Support** | Support tickets, expired-tenant reactivation flow. |
| **Portals** | SuperAdmin, Admin, Teacher, Student, Parent dashboards; public landing pages. |

---

## Known TODOs / Next Steps

| Area | What To Do |
|------|-----------|
| **Phase 3 — Backend Tests** | Jest + Supertest + MongoMemoryServer for all controllers and middleware |
| **Student / Parent Portal** | Gate portal access behind plan check at route level |
| **Razorpay Payment Flow** | Wire `createSubscriptionOrder` → Razorpay checkout → `verifyPayment` end-to-end |
| **Student password reset** | Students default to `Student@123`; surface a reset flow in the UI if needed |

---

## Running Locally

```
# Backend (port 8011)
cd backend
# ensure .env has MONGO_URI (+ JWT_SECRET, Razorpay keys)
node index.js

# Frontend (dev server, proxies /api to backend)
cd frontend
npm start

# Prod build check
npm run build
```

Seed the super admin with `node seedAdmin.js`. Live DB (test) is an Atlas cluster `attend_backend`; the test tenant admin/super-admin accounts are seeded there.
