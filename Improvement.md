# AttendEase — Improvement Roadmap

> College-focused multi-tenant SaaS ERP.  
> Last updated: 2026-08-12  
> Status: Many P0/P1 items from earlier roadmap are already implemented. This document covers the **remaining gaps**, **bugs**, and **consistency work** needed for production readiness.

---

## P0 — Blockers (fix before production / sales)

### 1. Auth consistency & token hygiene
- **Issue**: Mixed JWT lifetimes across roles (`super_admin` 7d, student/teacher registration 7d, parent 1d, normal login 15m). Super admin also has a plaintext-password backdoor via `SUPER_ADMIN_PASSWORD`.
- **Fix**:
  - Standardize on **15-minute access tokens + 7-day refresh tokens** for **all** roles, including super admin.
  - Remove `password === process.env.SUPER_ADMIN_PASSWORD` fallback; require bcrypt comparison only.
  - Wire `POST /api/auth/refresh` for all roles and deprecate long-lived direct tokens.
  - On standard `logout`, revoke the current refresh token; keep `logoutAllSessions` via `tokenVersion`.

### 2. Logging sweep — replace all `console.*` in production paths
- **Issue**: `authController`, `billingController`, `tenantController`, `auditLogger`, `require2FA`, and `optionalTenant` still use `console.log`/`console.warn`/`console.error`. This breaks structured logging, leaks sensitive data, and makes log aggregation unreliable.
- **Fix**:
  - Replace every `console.*` in controllers/middleware with `logger.*` (`logger.info/debug/warn/error`).
  - Ensure no PII (emails, passwords, enrollment numbers) is logged in plain text in production.

### 3. Cache invalidation on every tenant/user mutation
- **Issue**: Tenant branding, plan, subscription, and user profile changes are not reflected immediately because `tenant:*` and `user:*` cache entries are TTL-only (30s). Admins see stale data after updates.
- **Fix**:
  - After every tenant/user write, call `cache.del('tenant:${id}')` and `cache.del('user:${id}')`.
  - Apply to: `updateTenantSettings`, `updateSubscription`, `cancelSubscription`, user activation/deactivation, password changes, role updates.

### 4. 2FA enforcement on all sensitive routes
- **Issue**: `require2FA` middleware exists but is not wired to admin/super-admin routes that export data or change billing/roles.
- **Fix**:
  - Apply `require2FA` to: all `/api/admin/*`, `/api/super-admin/*`, `/api/billing/*`, `/api/roles/*`, `/api/plans/*`, attendance bulk-update, and any data-export endpoints.
  - Add a clear error shape: `{ success: false, twoFactorRequired: true, message: "2FA verification code required" }`.

---

## P1 — High impact (next sprint)

### 5. Unified error response envelope
- **Issue**: Some controllers return `{ success, message, error }` in prod, others omit `error`. Clients handle errors inconsistently.
- **Fix**:
  - Adopt a single shape: `{ success: false, message: string, code?: string, details?: any }`.
  - Update global error handler in `index.js` and all controller error paths to use it.

### 6. Offline attendance sync — conflict resolution
- **Issue**: `syncQueue` allows retry, but there is no rule for what happens when two devices submit different attendance for the same `classSessionId + studentId`.
- **Fix**:
  - Server-authoritative rule: accept the first valid sync; reject later duplicates with `409 { message: "Already synced by another device" }`.
  - Status conflicts (present vs absent) require teacher re-review via UI, not silent overwrite.
  - Remarks field can use last-write-wins.

### 7. SMS fallback — security model
- **Issue**: Raw SMS parsing is fragile and open to spoofing/cost abuse.
- **Fix**:
  - Only pre-approved teacher phone numbers may submit.
  - Use a structured SMS template with a tenant-specific checksum/code.
  - Rate-limit per teacher per day.
  - Validate teacher assignment + timetable slot before applying any mark.

### 8. Database unique constraints
- **Issue**: `Enrollment` lacks a unique index on `(userId, subjectId, section, tenantId)` and `(enrollmentNumber, tenantId)`. Duplicate imports create duplicate mappings.
- **Fix**:
  - Add unique compound index on `Enrollment(userId, subjectId, section, tenantId)`.
  - Add unique index on `Enrollment(enrollmentNumber, tenantId)`.
  - Add unique compound index on `Attendance(tenantId, classSessionId, studentId)` to enforce true per-student uniqueness.

### 9. Soft-delete enforcement
- **Issue**: `Tenant` has `deletedAt`, but some paths still hard-delete (`User.deleteMany` in `registerTenant`). No global policy.
- **Fix**:
  - Add `isDeleted` flag to `User`, `Subject`, `Attendance`, `Exam`, `Fee`, `Timetable`.
  - Replace hard deletes with soft deletes in all admin CRUD.
  - Add a background purge job that permanently removes soft-deleted records after 90 days.

### 10. Graceful shutdown
- **Issue**: `index.js` does not handle `SIGTERM`/`SIGINT`. In production, in-flight requests are dropped and MongoDB/Redis connections leak.
- **Fix**:
  - Handle `SIGTERM`/`SIGINT`: stop accepting new requests, drain in-flight, close MongoDB/Redis, then exit.
  - Set `serverSelectionTimeoutMS` and `socketTimeoutMS` appropriately during shutdown.

### 11. Rate limiting — require Redis in production
- **Issue**: `rate-limit-redis` is optional; if missing, memory store is used, which breaks under PM2/cluster.
- **Fix**:
  - In production, require Redis; fail closed if Redis is unavailable (return 503).
  - Remove silent memory fallback when `NODE_ENV === 'production'`.

### 12. Pagination safety on admin summary endpoints
- **Issue**: `/api/attendance/admin/students` runs per-student aggregates via `Promise.all`, which times out above ~200 rows.
- **Fix**:
  - Replace with a single `$group` aggregation by `studentId`.
  - Enforce max limit of 100; use cursor-based pagination for larger sections.

---

## P2 — Medium (next quarter)

### 13. Feature flags / gradual rollout
- **Issue**: New features (offline mode, SMS, proxy detection) are either fully on or off per plan. There is no tenant-level opt-in for beta features.
- **Fix**:
  - Use `Tenant.settings.featureFlags` or a lightweight `FeatureFlag` collection.
  - Super-admin can enable/disable per tenant; tenant admin can opt into beta modules.
  - Gate new code paths behind flags until stable.

### 14. Proxy-detection alerts
- **Issue**: `ipAddress` and `deviceFingerprint` are stored on attendance, but there is no alerting when multiple students are marked from the same device/IP.
- **Fix**:
  - After `markAttendance`, run a lightweight query: group by `ipAddress + date` and flag if count > threshold.
  - Create `Alert` records and surface them in the teacher/admin dashboard.

### 15. Student self-service password reset
- **Issue**: Students default to a weak temporary password and have no self-service reset flow.
- **Fix**:
  - Add `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` for `student` role.
  - Send reset link via email/Nodemailer; token expires in 1 hour.

### 16. Attendance summary aggregation optimization
- **Issue**: `getClassSummary` loads all records into memory and filters with JS. At 500+ students per class, this is slow.
- **Fix**:
  - Convert to a single MongoDB aggregation using `$group`.
  - Use covered queries where possible.

### 17. Backup / restore per tenant
- **Issue**: No automated backup strategy for a multi-tenant SaaS.
- **Fix**:
  - Daily automated snapshots per tenant (or per database with tenant metadata).
  - Super-admin restore endpoint with integrity verification.
  - Document RTO/RPO in the incident runbook.

### 18. Incident response runbook
- **Issue**: No documented playbooks for production incidents.
- **Fix**:
  - Create `RUNBOOK.md` covering: attendance DB corruption, billing double-charge, mass data leak, queue worker down, Redis outage.
  - Include rollback steps, communication templates, and escalation contacts.

---

## P3 — Polish / scale

### 19. Queue monitoring / Bull board
- **Issue**: Bull queues exist but have no visibility into job health.
- **Fix**:
  - Expose Bull metrics: waiting, active, completed, failed, delayed counts.
  - Add an admin dashboard for retry/DLQ health.

### 20. Multi-tenant isolation contract tests
- **Issue**: No automated verification that tenant A cannot access tenant B’s data.
- **Fix**:
  - Write Jest + Supertest tests that attempt cross-tenant access with valid tokens; assert 403/404.
  - Test cache invalidation on tenant update.
  - Test queue job tenant scoping.

### 21. Index review
- **Issue**: Some compound indexes may be missing for common query patterns.
- **Fix**:
  - Ensure `Timetable(tenantId, section, day, isActive)`.
  - Ensure `User(tenantId, role, section)`.
  - Review slow queries via APM/logs monthly.

### 22. Remove deprecated Mongoose options
- **Issue**: `index.js` still passes `useNewUrlParser: true`, `useUnifiedTopology: true`.
- **Fix**:
  - Drop these options; modern Mongoose warns/ignores them.

### 23. Cache hit-rate monitoring
- **Issue**: No visibility into cache effectiveness.
- **Fix**:
  - Instrument `cache.get`/`set` with hit/miss counters.
  - Expose via `/health` or admin dashboard.

### 24. Idempotency key enforcement on billing
- **Issue**: `idempotency.js` middleware exists but is not applied to all billing mutation routes.
- **Fix**:
  - Apply to `POST /api/billing/subscription`, `POST /api/billing/webhook`, and any payment verification endpoint.
  - Return cached response on replay.

---

## Execution order

1. **Week 1**: P0 #1–4 (auth, logging, cache, 2FA).  
2. **Week 2**: P1 #5–8 (error envelope, offline conflicts, SMS security, unique constraints).  
3. **Week 3**: P1 #9–12 (soft delete, shutdown, rate limiting, pagination).  
4. **Week 4**: P2 #13–15 (feature flags, proxy alerts, student reset).  
5. **Week 5–6**: P2 #16–18 + P3 backlog.

---

## Quick reference

| Priority | Count | Theme |
|----------|-------|-------|
| P0 | 4 | Auth security, logging, cache consistency, 2FA |
| P1 | 8 | Error consistency, offline/SMS safety, DB integrity, resilience |
| P2 | 6 | Rollout control, proxy detection, student UX, backups, runbook |
| P3 | 6 | Observability, testing, indexes, cleanup |

---

*This roadmap supersedes earlier versions. Items marked “already implemented” in the current codebase have been removed; remaining work is listed above.*
