# AttendEase ↔ ATTEND-AI Integration — Phase 1 + Phase 2 Design

> **Branch:** `feature/integration-attendease-attend-ai`  
> **Status:** Phase 1 **complete & committed**. Phase 2 (mobile face-attendance UI) **in progress**.  
> **Last updated:** 2026-08-19  
> **Scope:** Phase 1 = AttendEase backend bridge layer. Phase 2 = mobile-optimized React pages inside the existing AttendEase frontend. ATTEND-AI itself is never modified — its face-recognition logic is ported, and its `face_data/` is imported via a sync script.

**Phase 1 commits on this branch:**

| Commit | What |
|---|---|
| `72e6211` | `faceDescriptor` + `faceImageUrl` fields on User model |
| `a635290` | `faceController.js`, `faceRoutes.js`, mounted in `index.js` |
| `d3fc0e9` | `mobile-login` endpoint + validator, `syncFaceData.js`, Postman collection |

---

## 1. Objective

Build a bridge layer inside AttendEase's existing Node/Express backend so that a future mobile face-attendance app (Phase 2) can:

1. Authenticate as a student using roll number + password (instead of email + subdomain).
2. Upload face descriptors for students (teacher/admin use).
3. Submit a batch of face-verified student IDs against a timetable slot and have AttendEase mark attendance through its existing marking logic.

This spec covers **Phase 1** (backend endpoints, model changes, sync script — all complete) and **Phase 2** (mobile-optimized face-attendance UI — in progress, see §8).

---

## 2. What AttendEase already provides (foundations we build on)

| Capability | Where | Relevance |
|---|---|---|
| Multi-tenant User model with `rollNo`, `tenantId`, `isActive` | `User.js` | Students are already Users with roll numbers scoped to tenants. |
| Enrollment model mapping `enrollmentNumber` → `userId` | `Enrollment.js` | Roll number lookup is already possible via Enrollment, with tenant scoping. |
| JWT auth: 15-min access + 7-day refresh, `tokenVersion`, cache | `auth.js`, `authController.js` | Mobile auth can reuse the same token shape; `authenticateToken` already attaches full user + tenant to `req`. |
| Tenant resolution via subdomain or `X-Tenant-ID` header | `auth.js` `getTenantFromRequest` | Mobile app can pass `X-Tenant-ID` or subdomain to identify the institution. |
| Attendance marking: requires `timetableId` / `classSessionId`, `studentId`, `subjectId`, `section`, `teacherId`, `tenantId` | `Attendance.js`, attendance controller | The face-verification endpoint will call into this existing flow. |
| RBAC middleware: `authorizeRoles`, `teacherAuth`, `adminAuth`, `studentAuth` | `auth.js` | Face endpoints are gated to teachers/admins; mobile auth is a student flow. |
| Rate limiting via `express-rate-limit` | `authRoutes.js` | Mobile login gets its own limiter. |
| Structured logging via `logger` | `utils/logger.js` | All new code uses `logger`, not `console.*`. |

---

## 3. Model changes

### 3.1 User model — add face descriptor fields

**File:** `backend/models/User.js`

Add two optional fields near the existing profile/academic fields (after `parentEmail`, before `courseId`):

```js
// Face recognition (ATTEND-AI integration — Phase 1)
// Stored descriptor from face-api.js (128-dim or 512-dim FloatArray,
// serialized as a plain number array). Null until a face is registered.
faceDescriptor: {
  type: [Number],
  default: null,
},

// URL to the registered face image (stored in backend/uploads/ or CDN).
// Optional — kept for audit/debugging, not used for recognition at runtime.
faceImageUrl: {
  type: String,
  trim: true,
  default: null,
},
```

**Why on User and not a separate collection?**

- Students are already Users. One descriptor per student is the current ATTEND-AI model.
- At college scale (hundreds to low thousands of students per tenant), embedding the array on User is simple and queryable.
- A separate `FaceTemplate` collection is future work if we need multiple faces per student, versioning, or descriptor metadata — not needed for Phase 1.

**Indexes:** No new index needed. Queries that filter by `faceDescriptor: { $ne: null }` will use the existing `tenantId + role` indexes for tenant-scoped lookups. If we later need to find "all students with face data" frequently, add `{ tenantId: 1, faceDescriptor: 1 }`.

**Pre-save:** No transformation needed — descriptors are stored as-is (numbers). The existing `rollNo` uppercase/trim pre-save middleware is irrelevant here.

### 3.2 No changes to Enrollment or Attendance models

- **Enrollment** already maps `enrollmentNumber` → `userId` with tenant scoping. Mobile auth uses this.
- **Attendance** already accepts `timetableId`, `classSessionId`, `studentId`, `subjectId`, `section`, `teacherId`, `tenantId`. The face-verification endpoint fills these from the request + tenant context.

---

## 4. New routes

All new routes live in a new router: `backend/routes/faceRoutes.js`, mounted at `/api/faces` in `backend/index.js`.

### 4.1 `POST /api/faces/register` — register a student's face descriptor

**Auth:** `authenticateToken` + `authorizeRoles('teacher', 'admin', 'super_admin')`  
**Rate limit:** 30 req / 15 min (same as authLimiter)  
**Content-type:** `multipart/form-data` (image file + student identifier)

**Request:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `studentId` | ObjectId (string) | Yes | The User `_id` of the student. |
| `image` | File (JPEG/PNG) | Yes | Front-facing photo, similar to ATTEND-AI's `face_data/` images. |
| `tenantId` | ObjectId (string) | No | Optional explicit tenant; otherwise taken from `req.user.tenantId`. |

**Processing:**

1. Verify the requester is a teacher/admin and is within the same tenant as the target student.
2. Save the uploaded image to `backend/uploads/face-attendance/<studentId>_<timestamp>.jpg` (use existing `fileUpload`/`multer` middleware pattern).
3. Compute the face descriptor from the image.  
   **Phase 1 decision:** AttendEase backend does NOT run face recognition itself in Phase 1. The descriptor is expected to come from the client (mobile app or ATTEND-AI sync script) that has already run face-api.js / on-device ML.  
   To keep the endpoint usable for the sync script and future mobile app, accept the descriptor in the request body as a JSON field `faceDescriptor` (array of numbers) alongside the image. The image is stored for audit; the descriptor is what gets saved to the User.  
   If `faceDescriptor` is missing, return `400 { success: false, message: "faceDescriptor is required" }`.
4. Upsert the descriptor onto the User:  
   `User.findByIdAndUpdate(studentId, { faceDescriptor, faceImageUrl }, { new: true, runValidators: true })`.
5. Log the registration via `logActivity` (existing pattern in authController).

**Response (200):**

```json
{
  "success": true,
  "message": "Face descriptor registered",
  "faceImageUrl": "/uploads/face-attendance/5f9a..._1787291234567.jpg",
  "registeredAt": "2026-08-19T10:00:00.000Z"
}
```

**Errors:**

| Code | Message |
|---|---|
| 400 | Missing `studentId`, `image`, or `faceDescriptor` |
| 400 | `faceDescriptor` is not a non-empty array of numbers |
| 403 | Requester not teacher/admin, or cross-tenant |
| 404 | Student User not found in this tenant |
| 409 | Student already has a face descriptor registered (optional — we can allow re-registration; decide in implementation) |

### 4.2 `GET /api/faces/:studentId` — retrieve a student's face descriptor

**Auth:** `authenticateToken` + `authorizeRoles('teacher', 'admin', 'super_admin')`  
**Purpose:** Mobile app downloads the stored descriptor to cache locally for offline matching, or for audit. In a real face-recognition pipeline the server wouldn't expose raw descriptors, but for Phase 1 (demo/internal) this is acceptable. We document this as a known limitation.

**Request:** `GET /api/faces/<studentId>`  
**Response (200):**

```json
{
  "success": true,
  "studentId": "<studentId>",
  "name": "<student name>",
  "rollNo": "<rollNo>",
  "faceDescriptor": [0.12, -0.34, ...],  // array of numbers, or null
  "faceImageUrl": "/uploads/face-attendance/...jpg",  // or null
  "registeredAt": "2026-08-19T10:00:00.000Z"
}
```

**Errors:**

| Code | Message |
|---|---|
| 403 | Not teacher/admin, or cross-tenant |
| 404 | Student not found, or no face descriptor registered |

### 4.3 `POST /api/auth/mobile-login` — student login by roll number ✅ IMPLEMENTED

**Auth:** None (public, rate-limited)  
**Rate limit:** 5 req / 15 min per IP via `mobileLoginLimiter` (stricter than web login's 10/15m)  
**Content-type:** `application/json`

**Implementation locations (not a separate file):**

| Piece | File | Detail |
|---|---|---|
| Controller | `backend/controllers/authController.js` | `mobileLogin` — sits just before `parentLogin`, exported in `module.exports` |
| Validator | `backend/validators/auth.js` | `mobileLogin` array using `express-validator` `body()` chains |
| Route | `backend/routes/authRoutes.js` | `authRoute.post('/mobile-login', mobileLoginLimiter, mobileLoginValidator, mobileLoginCtrl)` |

Imports are aliased in `authRoutes.js` to avoid name collisions:
`mobileLogin: mobileLoginValidator` from validators, `mobileLogin: mobileLoginCtrl` from the controller.

**Validator schema (`express-validator`):**

```js
const mobileLogin = [
  body('enrollmentNumber').notEmpty().withMessage('Enrollment number is required').isString().trim(),
  body('password').notEmpty().withMessage('Password is required').isString(),
  body('tenantId').notEmpty().withMessage('Tenant ID is required')
    .isMongoId().withMessage('Invalid tenantId format'),
  body('deviceFingerprint').optional().isString().trim(),
];
```

**Request:**

```json
{
  "enrollmentNumber": "23BCON1379",
  "password": "studentpassword",
  "tenantId": "5f9a...",
  "deviceFingerprint": "optional-device-id"
}
```

**Fields:**

| Field | Required | Notes |
|---|---|---|
| `enrollmentNumber` | Yes | Roll number, uppercase, trimmed (matches Enrollment.enrollmentNumber). |
| `password` | Yes | The student's account password (stored on User, not Enrollment). |
| `tenantId` | Yes | ObjectId string. Mobile app discovers this via `GET /api/auth/tenant-info?subdomain=xxx` or the user enters it. Required because mobile apps don't have a subdomain in the URL host. |
| `deviceFingerprint` | No | Optional; stored on the RefreshToken record like web login. |

**Processing (as implemented):**

1. Validate presence of `enrollmentNumber`, `password`, `tenantId`; uppercase+trim the enrollment number.
2. Validate `tenantId` with `mongoose.Types.ObjectId.isValid()` → `400 Invalid tenantId format` if malformed.
3. Resolve the tenant: `Tenant.findById(tenantId)` → `404` if missing, `403` if `!tenant.isActive`.
4. Look up Enrollment: `Enrollment.findOne({ enrollmentNumber, tenantId: tenant._id })`.
   - Not found → `404 "Invalid enrollment number or institution."`
   - `isRegistered === false` → `400 "This enrollment has not been activated yet..."`
   - No `enrollment.userId` → `400 "Enrollment is not linked to a user account..."`
5. Look up User: `User.findOne({ _id: userId, tenantId: tenant._id, role: "student", isActive: true, isDeleted: false })` → `403` if missing/inactive.
6. **Account lockout (Option B from §6.1):** because the User is resolved *before* the password check, the existing email-keyed helpers are reused directly — `isLockedOut(user.email, tenant._id)` → `429` if locked. No change to `accountLockout.js` was needed.
7. Verify password with `bcrypt.compare`. On failure `recordFailedAttempt(user.email, tenant._id)` → `401`. On success `clearAttempts(user.email, tenant._id)`.
8. Update `lastLoginAt`, `lastLoginIP`, increment `loginCount`.
9. Issue the same tokens as web login: 15-min access JWT `{ userId, role: 'student', tenantId, tokenVersion }` + 7-day refresh token row in `RefreshToken` (with `deviceFingerprint` falling back to the `user-agent` header).
10. `logActivity({ endpoint: "/api/auth/mobile-login", ... })`, then return the same response shape as `POST /api/auth/login`.

The whole handler is wrapped in `try/catch` returning `500 "Server error during mobile login"` on unexpected failure.

**Response (200):** Same shape as `POST /api/auth/login`.

**Errors:**

| Code | Message |
|---|---|
| 400 | Missing fields, or enrollment not activated |
| 401 | Invalid password |
| 403 | Account deactivated |
| 404 | Enrollment / user not found for this tenant |
| 429 | Too many attempts (account locked) |

### 4.4 `POST /api/attendance/mark-face-detection` — face-verified attendance marking

**Auth:** `authenticateToken` + `authorizeRoles('teacher', 'admin', 'super_admin')`  
**Rate limit:** 30 req / 15 min  
**Content-type:** `application/json`

**Request:**

```json
{
  "timetableId": "5f9a...",
  "classSessionId": "2026-08-19-MORNING-SECTION-A",  // optional if timetableId provided
  "subjectId": "5f9a...",
  "verifiedStudents": [
    { "studentId": "5f9a...", "confidence": 0.92 },
    { "studentId": "5f9b...", "confidence": 0.88 }
  ],
  "timestamp": "2026-08-19T10:30:00.000Z",  // optional; defaults to now
  " remarks": "Face attendance via mobile"
}
```

**Fields:**

| Field | Required | Notes |
|---|---|---|
| `timetableId` | Yes* | ObjectId string. Must match an existing Timetable entry for this teacher/tenant. (*) Alternatively `classSessionId` + `subjectId` + `section` can be provided and the controller resolves the timetable — decide in implementation. For Phase 1, require `timetableId`. |
| `classSessionId` | No | If provided, used as the attendance `classSessionId`. If omitted, generated from timetable + date. |
| `subjectId` | Yes | ObjectId string. Must be one of the teacher's assigned subjects. |
| `verifiedStudents` | Yes | Non-empty array. Each entry: `studentId` (ObjectId string), `confidence` (0–1 number, optional). |
| `timestamp` | No | ISO date; defaults to `new Date()`. Used as the attendance `date`. |
| `remarks` | No | String; stored on each attendance record. |

**Processing (per student in `verifiedStudents`):**

1. Resolve the timetable slot from `timetableId` (or from `classSessionId` + `subjectId` + `section` if we allow that path). Verify it belongs to the requester's tenant and (if teacher) to one of their assigned subjects.
2. Derive the `section` from the timetable entry (or from the request if provided).
3. For each `studentId`:
   - Verify the student User exists, is `isActive`, belongs to the same tenant, and is a student.
   - Verify the student's `section` matches the timetable/section context (so a teacher can't mark a student in a different section via face detection).
   - Call the existing attendance marking logic: create an Attendance record with `studentId`, `subjectId`, `teacherId: req.user._id`, `section`, `date: timestamp || now`, `status: 'present'`, `classSessionId`, `timetableId`, `tenantId: req.user.tenantId`, `createdBy: req.user._id`, `ipAddress: req.ip`, `deviceFingerprint`, `remarks`.
   - The existing attendance controller already handles duplicate prevention via the unique index `{ tenantId, classSessionId, studentId }`. If a record for this student + session already exists, the insert will throw a duplicate key error — catch it and return `409` for that student, or skip it with a warning. Decide in implementation: for face detection, skipping with a warning (student already marked) is friendlier than failing the whole batch.
4. After all students are processed, trigger the background stats recalculation for the affected students/subjects (reuse `User.bulkUpdateAttendance` or enqueue via the existing Bull queue if one exists for attendance recalc — check `backend/queues/`).

**Response (200):**

```json
{
  "success": true,
  "message": "Attendance marked for N students",
  "marked": ["5f9a...", "5f9b..."],
  "skipped": [],  // students already marked in this session
  "classSessionId": "2026-08-19-MORNING-SECTION-A",
  "date": "2026-08-19T10:30:00.000Z"
}
```

**Errors:**

| Code | Message |
|---|---|
| 400 | Missing `timetableId`/`subjectId`, empty `verifiedStudents`, invalid student entries |
| 403 | Timetable not found, or not the teacher's subject, or cross-tenant |
| 409 | Entire batch conflict (decide if we ever return this vs per-student skip) |

### 4.5 Route summary table

| Method | Path | Auth | Rate limit | Purpose |
|---|---|---|---|---|
| POST | `/api/faces/register` | teacher/admin/super_admin | 30/15m | Register face descriptor + image for a student |
| GET | `/api/faces/:studentId` | teacher/admin/super_admin | 30/15m | Retrieve stored descriptor (mobile cache / audit) |
| POST | `/api/auth/mobile-login` | none (public) | 5/15m | Student login by roll number + password |
| POST | `/api/attendance/mark-face-detection` | teacher/admin/super_admin | 30/15m | Mark attendance from a batch of face-verified student IDs |

---

## 5. Files created / changed (Phase 1 — actual)

| File | Type | Status |
|---|---|---|
| `backend/models/User.js` | Model | Changed — added `faceDescriptor` + `faceImageUrl` |
| `backend/controllers/faceController.js` | Controller | New — `registerFace`, `getFaceDescriptor`, `markFaceDetection` |
| `backend/routes/faceRoutes.js` | Router | New — 3 routes + multer config + `faceLimiter` |
| `backend/index.js` | Bootstrap | Changed — mounts `faceRoutes` on `/api/faces` and `/api/attendance` |
| `backend/controllers/authController.js` | Controller | Changed — added `mobileLogin` |
| `backend/routes/authRoutes.js` | Router | Changed — `mobileLoginLimiter` + `/mobile-login` route |
| `backend/validators/auth.js` | Validator | Changed — `mobileLogin` schema |
| `backend/scripts/syncFaceData.js` | CLI script | New — manifest → User descriptor import |
| `AttendEase_AttendAI_Integration.postman_collection.json` | Test collection | New — repo root; covers all 4 endpoints |
| `backend/docs/integration-attend-ai.md` | Doc | This file |

**Actual mount in `backend/index.js`:**

```js
const faceRoutes = require("./routes/faceRoutes");
// ...
app.use("/api/attendance", attendanceRoute);
app.use("/api/attendance", faceRoutes);  // → /api/attendance/mark-face-detection
app.use("/api/faces", faceRoutes);
```

Mounting the same router twice is intentional: it keeps face code in one file while exposing the attendance action under the semantically correct `/api/attendance` prefix. Express matches `/mark-face-detection` only on the attendance mount and `/register` + `/:studentId` only on the faces mount.

---

## 6. Edge cases & implementation decisions

### 6.1 Account lockout for mobile login — ✅ RESOLVED (Option B)

Today `accountLockout.js` keys on `email`. Mobile login identifies the user by `enrollmentNumber`. Options considered:

- **Option A:** Extend `isLockedOut` / `recordFailedAttempt` / `clearAttempts` to also accept an `enrollmentNumber` key.
- **Option B (chosen):** Resolve the User first (Enrollment → `userId` → User), then call the existing lockout functions with `user.email`.

**Implemented:** Option B. `mobileLogin` resolves the tenant → enrollment → User *before* the `bcrypt.compare` call, so `isLockedOut(user.email, tenant._id)` / `recordFailedAttempt(user.email, tenant._id)` / `clearAttempts(user.email, tenant._id)` work unchanged. **`accountLockout.js` was not modified.** If the enrollment isn't activated or has no linked User, the request is rejected before any lockout bookkeeping — correct, since there is no account to lock.

### 6.2 Face descriptor source of truth

Phase 1 accepts the descriptor from the client (mobile app or sync script). The AttendEase backend does **not** run face recognition. This is intentional — it keeps the backend simple and lets the mobile app do on-device matching (which is the right architecture for privacy + performance). Document this clearly so no one expects server-side recognition.

### 6.3 Re-registration of face descriptors

A student may need to re-register their face (new photo, better lighting). Decide:

- **Allow overwrite:** `POST /api/faces/register` on an existing student replaces the descriptor. Simpler, no error code needed.
- **Block overwrite:** Return `409` if a descriptor already exists; require an explicit "re-register" flow.

**Recommendation:** Allow overwrite for Phase 1. It's a demo/internal feature; forcing a separate re-registration flow adds complexity without value yet.

### 6.4 Descriptor exposure via GET /api/faces/:studentId

Exposing raw descriptors is a known security/privacy limitation. For Phase 1 (internal demo) it's acceptable and useful for mobile caching. Document it as a limitation and a future improvement: in production, the mobile app should either (a) download the descriptor once and cache it, with the endpoint rate-limited and auth-gated, or (b) move to server-side matching with a different trust model. We flag this in the doc and move on.

### 6.5 Timetable resolution for mark-face-detection

Today's attendance marking requires a `Timetable` entry (the existing controller enforces this). For the face-detection endpoint, we require `timetableId` in the request. The implementation must:

- Fetch the Timetable entry, verify it's in the requester's tenant.
- If the requester is a teacher, verify the timetable's subject is one of their assigned subjects.
- Derive `section`, `day`, `startTime`, `endTime`, `room` from the timetable for the Attendance record.

If `timetableId` is not provided but `classSessionId` + `subjectId` are, we could alternatively look up the class session — but that's more complex and not needed for Phase 1. Keep it simple: require `timetableId`.

### 6.6 Bulk stats recalculation

After marking a batch, student attendance summaries need updating. Today there's `User.bulkUpdateAttendance(studentIds, tenantId)` which calls `updateAttendanceSummary` per student. For a batch of N students this is N sequential calls — fine for small batches, slow for large ones. For Phase 1, call `bulkUpdateAttendance` after the batch. If we later need async recalc, enqueue via Bull (check if an attendance queue exists in `backend/queues/`).

---

## 7. Sync script — import ATTEND-AI face_data/

### 7.1 Input format

ATTEND-AI stores per-student data in `face_data/` as image files. The sync script needs a mapping of roll number → image path → descriptor. Two possible input modes:

**Mode A — Pre-computed descriptors (preferred):** ATTEND-AI side runs face-api.js on each `face_data/` image and exports a JSON manifest:

```json
[
  { "enrollmentNumber": "23BCON1379", "imagePath": "face_data/23BCON1379.jpg", "descriptor": [0.12, -0.34, ...], "tenantId": "5f9a..." },
  ...
]
```

The AttendEase sync script reads this manifest and upserts descriptors onto Users.

**Mode B — Images only:** The sync script receives the `face_data/` folder + a roll-number mapping, and computes descriptors itself using a Node face-api.js bundle. This is heavier (needs the model files + WASM in Node) and is **not** the Phase 1 path — it's future work if we want the backend to compute descriptors.

**Phase 1 decision:** Mode A. The sync script assumes a pre-computed manifest. Document Mode B as future work.

### 7.2 Script: `backend/scripts/syncFaceData.js`

**Usage:**

```bash
node backend/scripts/syncFaceData.js --manifest path/to/face-manifest.json --tenant-id 5f9a...
```

**Behavior:**

1. Read the manifest JSON.
2. For each entry:
   - Find the User by `rollNo` (enrollmentNumber) + `tenantId`. (User.rollNo is stored uppercase; normalize the manifest's enrollmentNumber to uppercase to match.)
   - If User not found or not a student or not in the tenant → warning, skip.
   - Upsert `faceDescriptor` + `faceImageUrl` onto the User.
   - Log each upsert.
3. Print a summary: X users updated, Y skipped, Z errors.

**Auth:** This is an admin script — run by a super_admin or tenant admin with access to the server. No HTTP endpoint for it in Phase 1; it's a CLI script. If we later want a UI-triggered import, add a protected admin endpoint that calls the same logic.

### 7.3 Image storage during sync

If the manifest includes image paths that are local to ATTEND-AI's filesystem, the sync script can't read them directly (they're on a different machine). For Phase 1, the manifest should include the descriptor (computed on the ATTEND-AI side) but not necessarily the image. If we want to also import images, the ATTEND-AI side must export them as base64 or files included in the manifest bundle. Keep it simple: Phase 1 syncs descriptors only; images are optionally included if the manifest provides base64.

---

## 8. Phase 2 — Mobile face-attendance UI (IN PROGRESS)

### 8.1 Platform decision: mobile-optimized React pages, **not** React Native

Phase 2 is built as **responsive React pages inside the existing AttendEase frontend** (`frontend/src/`, CRA + React 18 + Tailwind), served over HTTPS and opened in the phone browser. A separate React Native / Expo app was evaluated and rejected for now.

| Factor | React Native / Expo | Mobile-optimized React (chosen) |
|---|---|---|
| Time to working demo | Weeks — new codebase, RN camera + on-device ML bridging | Days — reuses ATTEND-AI's browser face-api.js logic directly |
| Reuse of ATTEND-AI work | Minimal — its face logic is browser JS, doesn't port to RN | Direct — the detection loop, liveness and canvas overlay port almost 1:1 into a React component |
| Demoability | Needs install / emulator | Open a URL on any phone browser |
| Auth / API | New auth plumbing | Existing `utils/api.js` axios instance, interceptors, refresh-token flow |
| Maintenance | Two codebases, two deploys | One frontend, one deploy |

**Trade-off accepted:** mobile browsers require **HTTPS** for `navigator.mediaDevices.getUserMedia` (localhost is exempt). See §14 for the ngrok-based demo setup that satisfies this.

React Native remains a **future stretch goal** (§12), not a Phase 2 deliverable.

### 8.2 What gets ported from ATTEND-AI

All of the following lives in ATTEND-AI's `index.html` as vanilla JS/CSS and is ported into React:

| ATTEND-AI source | Lines | Ported into |
|---|---|---|
| face-api.js model loading (`tinyFaceDetector`, `faceLandmark68Net`, `faceRecognitionNet`, `faceExpressionNet`) from the jsdelivr weights CDN | `initCameraPage()` ~1135–1159 | `useFaceModels` hook |
| `getUserMedia` camera start/stop, canvas sizing | `startCamera()` / `stopCamera()` ~1242–1281 | `useCamera` hook |
| Detection loop — `detectAllFaces` every 4th frame, euclidean-distance match against known descriptors at `THRESHOLD = 0.45` | `startLoop()` ~1286–1355 | `useFaceDetection` hook |
| Liveness — nose landmark 30 tracked over a 15-frame history, confirmed at `HEAD_MOVE_THRESHOLD = 10`px total movement | `processLiveness()` ~1187–1237 | `useLiveness` hook |
| Canvas overlay — colour-coded boxes (gold=marked, green=verified+live, amber=recognised-not-live, red=unknown), corner accents, name/status labels | `drawOverlay()` ~1398–1451 | `FaceOverlay` component |
| Detected-students panel | `updateDetPanel()` ~1453–1470 | `DetectedPanel` component |
| CSS: `.cam-box`, `#cam-video`, `#cam-canvas`, `.liveness-scan`, `.am-flash`, `.det-panel`, `.det-item`, `.sdot` | ~159–201 | `faceAttendance.css` (kept as plain CSS, not Tailwind — it's animation-heavy and already written) |

**Not ported:** ATTEND-AI's own auth, SQLite calls, theme toggle, sidebar, PDF/report generation, and the emotion panel (expressions model is still loaded because the ported loop reads `d.expressions`, but the emotion UI is dropped for Phase 2 — it's not part of the attendance story).

### 8.3 Key behavioural change vs ATTEND-AI

ATTEND-AI **auto-marks** the instant a face is verified + live (`doAutoMark()` fires from inside the detection loop, POSTing to its own `/api/attendance/mark-detected`).

AttendEase Phase 2 keeps auto-mark **off by default** and requires an explicit **"Mark Attendance"** tap, because:

- `POST /api/attendance/mark-face-detection` is rate-limited to 30/15m — an auto-mark firing per detection burst would exhaust it.
- The teacher must first choose a **timetable slot**; there is no valid marking context until they do.
- A deliberate tap is a better demo beat and avoids accidental marking while the camera is being aimed.

Auto-mark is retained as an **opt-in toggle** that batches newly-verified students and fires at most once every few seconds, mirroring ATTEND-AI's `autoMarkInProgress` guard.

### 8.4 Page 1 — Teacher Face Attendance Session (built first)

**Route:** `/face-attendance` · **Component:** `frontend/src/component/FaceAttendance/TeacherFaceSession.jsx`  
**Guard:** `<Protected requiredRole="teacher">` — the teacher is already authenticated with a normal web JWT, so **no `mobile-login` is used on this page**.

**Flow:**

1. Teacher opens the page on a phone (or laptop — it's responsive).
2. Selects **subject → section → timetable slot** for today. Slots come from the existing timetable API; the chosen slot supplies `timetableId` + `subjectId`.
3. Page loads the enrolled students for that section, then fetches each one's stored descriptor via `GET /api/faces/:studentId`, building the in-memory `knownDescriptors` array (ATTEND-AI's equivalent came from `/api/student-photos`).
4. Tap **Start Camera** → permission prompt → `getUserMedia({ facingMode: 'environment' })`. *(Rear camera, unlike ATTEND-AI's `'user'` — the teacher points the phone at the class.)*
5. Detection loop runs: recognises students, tracks liveness per student, draws the overlay, populates the detected panel.
6. Tap **Mark Attendance** → `POST /api/attendance/mark-face-detection` with `{ timetableId, subjectId, verifiedStudents: [{ studentId, confidence }], timestamp, remarks: "Face attendance via mobile" }`.
7. Show the response summary — `marked`, `skipped`, `errors` — and flash the `am-flash` overlay.

`confidence` is derived from the euclidean distance the port already computes: `confidence = 1 - (distance / THRESHOLD)`, clamped to `[0, 1]`, which satisfies the endpoint's 0–1 validation.

### 8.5 Page 2 — Student Face Check-In (built second)

**Route:** `/face-checkin` · **Component:** `frontend/src/component/FaceAttendance/StudentFaceCheckin.jsx`  
**Guard:** **public** — this is the only page that uses `POST /api/auth/mobile-login`.

**Flow:**

1. Student opens the page; enters **enrollment number + password**. Tenant is resolved via `GET /api/auth/tenant-info?subdomain=<x>` to get the `tenantId` that `mobile-login` requires.
2. `POST /api/auth/mobile-login` → JWT + refresh token stored via the same `localStorage` keys the web app uses, so `utils/api.js` interceptors work unchanged.
3. Fetch **own** descriptor via `GET /api/faces/:studentId` (single entry in `knownDescriptors`).
4. Tap **Start Camera** → `facingMode: 'user'` (front camera, selfie check-in).
5. Detection loop matches only against the student's own descriptor + runs liveness.
6. On verified + live, **Check In** becomes enabled → `POST /api/attendance/mark-face-detection` with the current slot and a single-entry `verifiedStudents`.

**⚠ Known gap — student self-check-in is not yet fully supported by the backend.** `mark-face-detection` is gated to `teacher`/`admin`/`super_admin` and derives `teacherId` from `req.user._id`; a student token will be rejected with `403`. Options, to be decided before this page is finished:

- **(a)** Add a student-facing variant that resolves the teacher from the timetable slot rather than the caller — cleanest, small backend change.
- **(b)** Have check-ins land in a pending queue for teacher approval — better audit story, more work.
- **(c)** Ship the teacher page only for the B.Tech demo and document student check-in as future scope — lowest risk.

Because of this, **§8.4 (teacher page) is the Phase 2 deliverable** and §8.5 is contingent on resolving the above.

### 8.6 Phase 2 files

| File | Purpose |
|---|---|
| `frontend/src/component/FaceAttendance/TeacherFaceSession.jsx` | Teacher session page (§8.4) |
| `frontend/src/component/FaceAttendance/StudentFaceCheckin.jsx` | Student check-in page (§8.5, contingent) |
| `frontend/src/component/FaceAttendance/FaceOverlay.jsx` | Canvas overlay (port of `drawOverlay`) |
| `frontend/src/component/FaceAttendance/DetectedPanel.jsx` | Recognised-students list |
| `frontend/src/component/FaceAttendance/faceAttendance.css` | Ported ATTEND-AI camera/liveness/flash styles |
| `frontend/src/hooks/useFaceModels.js` | Loads face-api.js models from CDN, exposes `ready` + progress |
| `frontend/src/hooks/useCamera.js` | `getUserMedia` lifecycle, stream cleanup |
| `frontend/src/hooks/useFaceDetection.js` | Detection loop + descriptor matching |
| `frontend/src/hooks/useLiveness.js` | Nose-history head-movement liveness |
| `frontend/src/utils/faceApiLoader.js` | Injects the face-api.js CDN `<script>` once and resolves when `window.faceapi` exists |

**Dependency note:** face-api.js is loaded from CDN via a script tag (exactly as ATTEND-AI does) rather than added to `package.json`. This avoids a CRA build-size hit and a webpack 5 polyfill fight, and keeps the port faithful. The weights URL is `https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js/weights`.

### 8.7 Routes to add in `frontend/src/App.js`

```js
const TeacherFaceSession = lazy(() => import("./component/FaceAttendance/TeacherFaceSession"));
const StudentFaceCheckin = lazy(() => import("./component/FaceAttendance/StudentFaceCheckin"));

// Protected — teacher only
<Route path="/face-attendance" element={
  <Protected requiredRole="teacher"><TeacherFaceSession /></Protected>
} />

// Public — student check-in has its own mobile-login form
<Route path="/face-checkin" element={<StudentFaceCheckin />} />
```

A **Face Attendance** nav entry is added for teachers in `frontend/src/component/header/index.jsx` (it already imports `ClipboardCheck` / `Camera`-style lucide icons).

---

## 9. Security & privacy notes

- **Tenant isolation:** All new endpoints enforce tenant scoping via `req.user.tenantId` and explicit checks. A teacher from tenant A cannot register faces or mark attendance for tenant B's students.
- **Role gating:** Face registration and attendance marking are teacher/admin/super_admin only. Students cannot register faces for other students.
- **Mobile login brute-force:** Rate-limited to 5 req / 15 min per IP — stricter than web login. Account lockout extends to mobile login via the existing lockout utilities ( keyed on email after User resolution).
- **Descriptor exposure:** `GET /api/faces/:studentId` exposes raw descriptors. Auth-gated and rate-limited, but flagged as a Phase 1 limitation. For a production deployment, revisit whether descriptors should be server-side matched or tokens/cached with short TTL.
- **Image storage:** Face images are stored in `backend/uploads/face-attendance/` — same upload path as other attachments. Ensure the upload middleware restricts file types (JPEG/PNG) and size. Reuse existing `multer`/`fileUpload` patterns.
- **No server-side face recognition:** AttendEase backend does not process faces. This reduces attack surface and privacy concerns — the server only stores descriptors and images, and trusts the mobile app's verification result. This trust model is acceptable for an internal/demo deployment; for production, consider server-side verification or signed attestation from the mobile app.

---

## 10. Testing approach

### Phase 1 — backend endpoints (manual + Postman)

The `AttendEase_AttendAI_Integration.postman_collection.json` collection at the repo root covers all four endpoints, auto-capturing the teacher token into a collection variable. Cases to exercise:

1. **mobile-login:**
   - Registered student, correct password → 200 + token.
   - Registered student, wrong password → 401.
   - Unregistered enrollment → 404.
   - Enrollment not activated → 400.
   - Cross-tenant enrollmentNumber → 404 (tenantId filter).
   - Rate limit: 6 rapid requests → 429.

2. **faces/register:**
   - Teacher, same tenant, valid studentId + descriptor → 200, descriptor saved on User.
   - Teacher, cross-tenant studentId → 403.
   - Student role → 403.
   - Missing descriptor → 400.
   - Re-register same student → 200 (overwrite).

3. **faces/:studentId:**
   - Teacher, same tenant → 200 + descriptor.
   - Student with no descriptor → 404.
   - Cross-tenant → 403.

4. **mark-face-detection:**
   - Teacher, valid timetableId + subjectId + verifiedStudents → 200, Attendance records created.
   - Duplicate student in same session → skipped (warn), not failed.
   - Wrong subject (not teacher's) → 403.
   - Cross-tenant timetable → 403.
   - Empty verifiedStudents → 400.

Test against a dev tenant with a few sample students and a configured timetable.

### Phase 2 — mobile UI (manual, on a real phone)

Desktop-browser testing is necessary but **not sufficient** — camera behaviour, performance and layout all differ on mobile. Verify on an actual phone over HTTPS (§14):

1. **Model loading:** page shows progress and reaches ready state; no CDN failures in the console.
2. **Camera permission:** denying it produces a clear error state, not a blank box; granting it starts the feed.
3. **Camera facing:** teacher page uses the rear camera, student page the front.
4. **Detection:** a registered student's face is recognised (green/amber box + name); an unregistered face shows red/"Unknown".
5. **Liveness:** holding still keeps the bar below threshold; a small head movement fills it and flips status to live.
6. **Marking:** tapping Mark Attendance produces a summary and the records appear in the normal attendance table.
7. **Duplicate handling:** marking the same student twice in one session returns them under `skipped`, not as an error.
8. **No slot selected:** the Mark button stays disabled and the reason is visible.
9. **Cleanup:** navigating away stops the camera (no lingering recording indicator) and cancels the animation frame.
10. **Performance:** the FPS badge stays usable on a mid-range phone; the every-4th-frame throttle from ATTEND-AI is retained for this reason.

---

## 11. Implementation order

### Phase 1 — ✅ COMPLETE

| Step | What | Status |
|---|---|---|
| 1 | `faceDescriptor` + `faceImageUrl` on User model | ✅ `72e6211` |
| 2 | `faceController.js` — `registerFace`, `getFaceDescriptor`, `markFaceDetection` | ✅ `a635290` |
| 3 | `faceRoutes.js` + multer + rate limiter | ✅ `a635290` |
| 4 | Mount `faceRoutes` in `backend/index.js` | ✅ `a635290` |
| 5 | `mobile-login` controller + validator + route | ✅ `d3fc0e9` |
| 6 | `syncFaceData.js` CLI import script | ✅ `d3fc0e9` |
| 7 | Postman collection for all 4 endpoints | ✅ `d3fc0e9` |
| 8 | Account lockout decision (Option B — no `accountLockout.js` change) | ✅ §6.1 |

### Phase 2 — IN PROGRESS

| Step | What | Depends on |
|---|---|---|
| 1 | `faceApiLoader.js` — CDN script injection helper | — |
| 2 | `useFaceModels` hook — load the 4 nets, expose progress | Step 1 |
| 3 | `useCamera` hook — `getUserMedia` + cleanup | — |
| 4 | `useLiveness` hook — port `processLiveness` | — |
| 5 | `useFaceDetection` hook — port the detection loop + matching | Steps 2–4 |
| 6 | `faceAttendance.css` — port ATTEND-AI camera styles | — |
| 7 | `FaceOverlay` + `DetectedPanel` components | Step 6 |
| 8 | `TeacherFaceSession.jsx` — slot picker, descriptor load, mark action | Steps 5, 7 |
| 9 | Route + teacher nav entry in `App.js` / `header/index.jsx` | Step 8 |
| 10 | Register 3–4 test descriptors, verify end-to-end on a phone over HTTPS | Step 9 |
| 11 | Decide student check-in approach (§8.5 a/b/c); build `StudentFaceCheckin.jsx` if pursuing | Step 10 |
| 12 | Update `ARCHITECTURE.md` + this doc's status | All above |

Do each step and verify before moving to the next. Commit after each meaningful step.

---

## 12. Out of scope

**Still out of scope after Phase 2:**

- **Native mobile app (React Native / Expo / Flutter)** — Phase 2 ships mobile *web*. A native shell is a future stretch goal, only worth doing once the web flow is proven (see §8.1).
- **Server-side face recognition** — not planned. AttendEase stores descriptors and trusts the client's verification result; it never runs face-api.js on the backend.
- **Face descriptor versioning / multiple faces per student** — one descriptor per student.
- **Production hardening of descriptor exposure** — signed attestations, short-lived caches, or server-side matching. Flagged in §9.
- **Automated tests for the new endpoints / pages** — manual + Postman for now; Jest/Supertest and RTL later.
- **Offline face attendance** — the existing `offlineSync.js` queue is not wired to the face flow.
- **Emotion / engagement analytics** — ATTEND-AI's expression UI is deliberately not ported (§8.2).

**No longer out of scope (delivered or in progress):**

- ~~Mobile app~~ → mobile web pages, Phase 2 (§8).
- ~~UI for face registration~~ → teacher-facing descriptor registration is reachable via the Phase 2 session page + `POST /api/faces/register`.

---

## 13. Phase 2 demo flow (how an evaluator uses it on a phone)

There is **no app to install** — it's a web page.

1. **Before the demo:** run the backend + frontend, expose over HTTPS (§14), and register descriptors for 3–4 test students via `POST /api/faces/register` (Postman collection has the request) or `syncFaceData.js`.
2. Evaluator opens the HTTPS URL on their phone browser and logs in as a **teacher** (or you hand over a phone already logged in).
3. Tap **Face Attendance** in the nav → pick today's subject / section / timetable slot.
4. Tap **Start Camera** → tap **Allow** on the browser's camera prompt.
5. Point the phone at the "students" — real people, printed photos, or a second phone showing student images. Recognised names appear live in the detected panel with colour-coded boxes.
6. Students move their heads slightly → the liveness bar fills → status flips to green (verified + live).
7. Tap **Mark Attendance** → summary appears (`N marked`, skips, errors).
8. Switch to the laptop and show the same records now present in AttendEase's normal attendance table — proving the AI flow wrote into the real ERP, not a side database.

**Using printed photos instead of the evaluator's own face is recommended** — it avoids asking them to hand over biometric data and makes the demo repeatable.

---

## 14. HTTPS requirement & demo setup

`navigator.mediaDevices.getUserMedia` is only available in a **secure context**. `localhost` counts as secure; a LAN IP like `http://192.168.1.x:3000` does **not**, so a phone hitting the dev server over plain HTTP will be denied camera access.

**Options, best first:**

| Option | Setup | Notes |
|---|---|---|
| **ngrok** (recommended) | `ngrok http 3000` → open the `https://…ngrok…` URL on the phone | Works instantly; free tier gives a new URL each run. Add the URL to backend CORS / `FRONTEND_URL` if the API is on a different origin. |
| Deployed environment | Any host with a real TLS cert (VPS + Let's Encrypt, college domain, Vercel/Netlify for the frontend) | Best if AttendEase is already deployed. |
| LAN IP over HTTP | Phone + laptop on the same Wi-Fi | ❌ Camera will be blocked. Do not rely on this. |

**Fallback:** keep a short screen recording of the working flow. If college Wi-Fi blocks ngrok or the camera prompt misbehaves, play the recording — the evaluator still sees the UI, the flow, and the backend integration. This is a safety net, not the primary demo.

**Pre-demo checklist:**

- [ ] Backend running; MongoDB reachable
- [ ] Frontend running; `REACT_APP_API_URL` points at the reachable backend
- [ ] HTTPS tunnel live; URL opens on the phone
- [ ] Backend CORS allows the tunnel origin
- [ ] 3–4 students have `faceDescriptor` set (verify with `GET /api/faces/:studentId`)
- [ ] A timetable slot exists for today for the demo subject + section
- [ ] Camera permission already granted on the demo phone
- [ ] Printed student photos / second phone ready as "students"
- [ ] Screen-recording fallback on hand
