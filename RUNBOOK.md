# AttendEase — Incident Response & Production Runbook

> **Version**: 1.0  
> **Audience**: Platform Engineers, SREs, Super Administrators  
> **Last Updated**: August 2026

---

## Table of Contents
1. [Sev-1: Database / Data Outage & Corruption](#1-sev-1-database--data-outage--corruption)
2. [Sev-1: Mass Token Revocation & Security Breach](#2-sev-1-mass-token-revocation--security-breach)
3. [Sev-2: Redis Outage & Rate Limiter Degradation](#3-sev-2-redis-outage--rate-limiter-degradation)
4. [Sev-2: Razorpay Billing Desync & Double Charging](#4-sev-2-razorpay-billing-desync--double-charging)
5. [Sev-2: Bull Queue Worker Backlog / Crash](#5-sev-2-bull-queue-worker-backlog--crash)
6. [Sev-3: Multi-Tenant Data Leak Investigation](#6-sev-3-multi-tenant-data-leak-investigation)
7. [Health Checks & Diagnostics Cheat Sheet](#7-health-checks--diagnostics-cheat-sheet)

---

## 1. Sev-1: Database / Data Outage & Corruption

### Symptoms
- 500 errors across multiple endpoints with `MongooseServerSelectionError` or `MongoTimeoutError`.
- High latency on database queries (>5000ms).

### Immediate Actions
1. **Verify Database Connectivity**:
   ```bash
   curl -I https://api.attendease.com/health
   ```
2. **Check MongoDB Cluster Health**:
   - Check MongoDB Atlas CPU, IOPS, and connection limits.
   - If secondary lag is high, ensure queries use `{ readPreference: 'primaryPreferred' }`.
3. **Point-In-Time Recovery (PITR)**:
   - Atlas Snapshots: Restore to the latest consistent snapshot prior to corruption timestamp.
   - Run data consistency validation:
     ```bash
     node backend/scripts/fixDatabaseObjectIds.js
     ```
4. **Re-sync Tenant Counters**:
   ```javascript
   // In Mongo shell:
   const Tenant = db.getCollection('tenants');
   // Force stats recalculation across all active tenants
   ```

---

## 2. Sev-1: Mass Token Revocation & Security Breach

### Symptoms
- Compromised secret key or suspected unauthorized tenant access.

### Immediate Actions
1. **Rotate `JWT_SECRET` in environment variables**:
   - Generate a new 64-byte secret:
     ```bash
     node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
     ```
   - Update `.env` / production secrets store (`JWT_SECRET`).
   - Trigger zero-downtime rolling restart of backend instances.
2. **Mass Revoke Refresh Tokens**:
   ```javascript
   // Mongo Shell:
   db.refreshtokens.updateMany({}, { $set: { revoked: true } });
   ```
3. **Increment Token Versions across all users**:
   ```javascript
   // Mongo Shell:
   db.users.updateMany({}, { $inc: { tokenVersion: 1 } });
   ```
4. **Flush Cache**:
   ```bash
   redis-cli FLUSHDB
   ```

---

## 3. Sev-2: Redis Outage & Rate Limiter Degradation

### Symptoms
- Rate limiter returns 503 `RATE_LIMITER_UNAVAILABLE` in production.
- Cache misses spike to 100%.

### Immediate Actions
1. **Verify Redis status**:
   ```bash
   redis-cli -u $REDIS_URL ping
   ```
2. **Inspect Upstash / Redis instance memory & network throughput**.
3. **If Redis is unrecoverable temporarily**:
   - Switch application environment to fallback cache or restart Redis container.
4. **Cache warmup after Redis restart**:
   - Background tenant cache warmup automatically takes effect on first incoming request per tenant within 30 seconds TTL.

---

## 4. Sev-2: Razorpay Billing Desync & Double Charging

### Symptoms
- Tenant shows `expired` or `trial` after payment succeeded.
- Customer webhook notifications delayed or failing verification.

### Immediate Actions
1. **Manual Plan Re-sync via Super Admin API**:
   ```bash
   curl -X PUT https://api.attendease.com/api/admin/super/tenants/:tenantId/subscription \
     -H "Authorization: Bearer <SUPER_ADMIN_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"plan": "professional", "status": "active", "billingCycle": "monthly"}'
   ```
2. **Verify Razorpay Payment Signature**:
   - Inspect Razorpay dashboard for payment ID and order status.
   - Run manual verification via `/api/billing/verify-payment`.
3. **Clear Stale Tenant Subscription Cache**:
   ```javascript
   await cache.del(`tenant:${tenantId}`);
   await cache.del(`tenant:subdomain:${tenantSubdomain}`);
   ```

---

## 5. Sev-2: Bull Queue Worker Backlog / Crash

### Symptoms
- Attendance statistics percentage not updating after marking attendance.
- High memory usage on Redis queue keys (`bull:attendance:*`).

### Immediate Actions
1. **Inspect Queue Status**:
   - Check `/health` endpoint stats for queue job backlog.
2. **Drain Stalled Jobs**:
   ```javascript
   // In node REPL connected to Redis:
   const { attendanceQueue } = require('./backend/queues/attendanceQueue');
   await attendanceQueue.clean(5000, 'failed');
   ```
3. **Trigger Manual Statistics Recalculation**:
   ```javascript
   // Run student stats recalculation directly:
   const { updateStudentAttendanceStats } = require('./backend/controllers/attendanceController');
   await updateStudentAttendanceStats(studentId, subjectId, tenantId);
   ```

---

## 6. Sev-3: Multi-Tenant Data Leak Investigation

### Symptoms
- User reports seeing data (students, courses, reports) from another institution.

### Immediate Actions
1. **Check Audit Logs**:
   ```bash
   # Filter audit logs for cross-tenant actor vs target mismatch
   node -e "
     const mongoose = require('mongoose');
     // Query AuditLog collection for mismatched tenantId
   "
   ```
2. **Verify Tenant Resolver Matrix**:
   - Ensure `req.tenantId` is strictly derived from JWT payload for authenticated requests.
   - Verify `x-tenant-id` header cannot override JWT tenant context for non-super-admins.
3. **Inspect Query Filters**:
   - All Mongoose queries must include `{ tenantId: req.tenantId }`.

---

## 7. Health Checks & Diagnostics Cheat Sheet

| Check | Command / Endpoint | Expected Response |
|---|---|---|
| API Liveness | `GET /health` | `200 OK` with `{ status: "ok" }` |
| Redis Connection | `redis-cli ping` | `PONG` |
| Syntax Verification | `node --check backend/index.js` | Exit code `0` |
| Check Failed 2FA / Login Lockouts | Query `accountLockouts` in Node memory | Status clear |

---
*Maintained by the AttendEase Core Engineering Team.*
