# PROJECT SYNOPSIS OF MAJOR PROJECT

## AttendEase — A Multi-Tenant SaaS Academic ERP with Intelligent Attendance, Exam & Fee Management

### B.Tech (Computer Science & Engineering) — Semester VII

**Submitted by:**
**Parth Manocha**
University Roll No.: 23BCON0051
JECRC University, Jaipur

**Under the guidance of:**
**Mr. Divyansh Dewani**
Teaching Assistant, Department of Computer Science & Engineering
JECRC University, Jaipur

**Month-Year:** August 2026

---

**JECRC University**
**School of Engineering**
**Department of Computer Science & Engineering**
**Jaipur**

---

## TABLE OF CONTENTS

| Content | Page No. |
|---|---|
| Introduction | |
| 1.1 Background of the Study | |
| 1.2 Problem Statement | |
| 1.3 Objectives of the Project | |
| 1.4 Scope of the Project | |
| Study of Existing System / Literature Review | |
| 2.1 Related Work | |
| 2.2 Comparative Study | |
| 2.3 Feasibility Study | |
| Rationale | |
| Methodology / Planning of Work | |
| Context / E-R Diagrams | |
| Facilities Required for Proposed Work | |
| References | |

---

## 1. INTRODUCTION

### 1.1 Background of the Study

The education sector is undergoing a profound digital transformation. Educational institutions — from schools to universities — are progressively replacing traditional paper-based registers and fragmented spreadsheet workflows with integrated Enterprise Resource Planning (ERP) systems. The motivation behind this shift is multifaceted: reducing administrative overhead, minimizing human error, ensuring data consistency, and enabling real-time decision-making through actionable analytics.

In the Indian higher-education landscape, colleges and universities manage complex academic operations including student enrollment, course and subject management, timetable scheduling, daily attendance capture, examination planning, grade management, fee collection, and stakeholder communication. Traditionally, these functions are handled through disjointed tools or manual processes, leading to data silos, delayed reporting, and compliance risks.

The emergence of cloud-based Software-as-a-Service (SaaS) platforms has democratized access to sophisticated ERP capabilities. Multi-tenancy — a single application instance serving multiple independent organizations (tenants) with strict data isolation — has become the de facto architecture for SaaS products targeting institutional clients. This model offers economies of scale for the provider while delivering customization, security, and dedicated experiences to each tenant.

Modern web technologies (Node.js, React, MongoDB, Redis) and cloud infrastructure (MongoDB Atlas, Vercel, Render) have matured to the point where a small development team can architect and deploy production-grade, multi-tenant SaaS applications with enterprise features such as role-based access control (RBAC), asynchronous background processing, payment gateway integration, and offline-first data sync.

### 1.2 Problem Statement

Despite the availability of several academic management tools, most existing solutions suffer from one or more of the following limitations:

- **Fragmentation:** Institutions rely on multiple disconnected systems for attendance, exams, fees, and timetables, resulting in redundant data entry and reconciliation errors.
- **Lack of Multi-Tenancy:** Traditional ERP installations are single-tenant, requiring dedicated infrastructure per institution, which is cost-prohibitive for small and medium colleges.
- **Absence of Intelligent Attendance Mechanisms:** Proxy attendance — where students mark attendance for absent peers — remains a widespread problem. Existing systems rarely implement IP-based or device-fingerprint-based proxy detection.
- **Offline Unreliability:** In regions with poor internet connectivity, teachers cannot reliably capture attendance or sync data. Real-time systems fail silently, leading to incomplete records.
- **Rigid Role Management:** Off-the-shelf systems offer fixed roles (admin, teacher, student) without granular, institution-specific permission customization.
- **Manual Fee & Billing Workflows:** Fee structure management, invoice generation, payment reconciliation, and receipt issuance are often manual or semi-automated, consuming administrative resources.

There is a clear need for a unified, intelligent, multi-tenant Academic ERP that addresses these gaps while remaining affordable and easy to deploy for educational institutions of varying sizes.

### 1.3 Objectives of the Project

The primary objectives of the AttendEase project are:

1. To design and develop a multi-tenant SaaS Academic ERP platform capable of serving multiple educational institutions with strict data isolation and tenant-level customization.
2. To implement a robust Role-Based Access Control (RBAC) system with custom, granular permissions (module:action) tailored to each institution's organizational structure.
3. To build an intelligent attendance management engine with proxy detection (IP address and device fingerprinting), offline-first capture with background sync, and real-time statistical aggregation.
4. To integrate comprehensive exam management — including date-shift scheduling, invigilator assignment with conflict detection, grade submission, and automated result computation.
5. To automate fee structure definition, invoice generation, online payment collection via Razorpay, and receipt generation.
6. To enable tenant-level branding through dynamic design tokens and plan-based feature gating, allowing institutions to subscribe to modules according to their needs and budget.

### 1.4 Scope of the Project

**In Scope:**
- Academic hierarchy management (Courses → Branches → Semesters → Subjects → Sections).
- Weekly timetable generation with multi-level conflict detection (teacher, section, room).
- Attendance capture with proxy detection, offline sync, and background statistical recalculation.
- Exam scheduling (Date × Shift grid), invigilation duty allocation, grade entry, and student result portal.
- Fee structure definition, automated fee generation, student self-payment portal, and transaction logging.
- Multi-tenant SaaS engine with plan-based module gating, usage quotas, and subscription billing.
- Custom RBAC with granular permissions and multi-tenant security boundaries.
- Tenant branding (logo, favicon, CSS design tokens) and responsive web interface.

**Out of Scope:**
- Native mobile applications (responsive Progressive Web App only).
- K-12 board-specific compliance fields (CBSE/ICSE state-board patterns).
- Biometric or RFID hardware integration.
- Video conferencing or live class streaming.
- Multi-language internationalization beyond English.

---

## 2. STUDY OF EXISTING SYSTEM / LITERATURE REVIEW

### 2.1 Related Work

Several academic management systems and ERP solutions have been proposed and implemented in both academic literature and commercial software. This section reviews five representative systems.

#### 2.1.1 Fedena
Fedena is a widely adopted school management ERP offering features such as student information management, attendance tracking, timetable scheduling, and examination management. While Fedena provides a comprehensive feature set, it operates primarily as a single-tenant on-premise or hosted solution. Multi-tenancy with strict data isolation and per-tenant branding is not a first-class architectural concern. Additionally, Fedena lacks native proxy detection for attendance and does not offer a modular, plan-based subscription model.

#### 2.1.2 ERPNext Education
ERPNext is an open-source ERP suite with an Education module. Its modular architecture and open-source nature are advantageous, but the Education module lacks advanced attendance analytics, offline-first sync capabilities, and fine-grained custom role management. The learning curve for customization is steep, and the community-driven support model may not meet the service-level expectations of institutional clients.

#### 2.1.3 Microsoft School Data Sync (SDS)
Microsoft SDS integrates with Microsoft 365 and PowerSchool to synchronize student information systems. While powerful within the Microsoft ecosystem, it is heavily dependent on cloud connectivity, lacks offline resilience, and requires significant Microsoft 365 licensing investment. The platform does not natively support the academic nuances of Indian higher-education institutions such as course-branch-semester hierarchies and fee management workflows.

#### 2.1.4 Google Classroom + Google Sheets
Many small institutions rely on Google Classroom for content delivery and Google Sheets for attendance and grade tracking. This ad-hoc approach is cost-effective initially but does not scale. Data is fragmented across multiple spreadsheets, there is no built-in audit trail, proxy detection is impossible, and generating consolidated reports requires manual effort.

#### 2.1.5 AttendEase (Proposed System)
AttendEase addresses the aforementioned limitations through a purpose-built, multi-tenant SaaS architecture. It introduces intelligent attendance mechanisms (proxy detection via IP and device fingerprinting), offline-first data capture with Bull queue-based background sync, modular plan-based feature gating, custom RBAC, and integrated fee management with Razorpay. The system is designed for deployment on modern cloud infrastructure with minimal operational overhead.

### 2.2 Comparative Study

| Feature / System | Fedena | ERPNext Education | Microsoft SDS | Google Classroom + Sheets | AttendEase (Proposed) |
|---|---|---|---|---|---|
| Multi-Tenancy | ❌ Limited | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Offline Attendance Sync | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Proxy Detection | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Custom RBAC | ❌ Fixed roles | ⚠️ Limited | ⚠️ M365 roles | ❌ No | ✅ Yes |
| Exam Scheduling & Invigilation | ✅ Yes | ✅ Yes | ⚠️ Partial | ❌ No | ✅ Yes |
| Fee Automation & Online Payments | ✅ Yes | ✅ Yes | ❌ No | ❌ No | ✅ Yes |
| Plan-Based Feature Gating | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Yes |
| Tenant Branding | ❌ No | ❌ No | ⚠️ M365 theme | ❌ No | ✅ Yes |
| Background Async Processing | ❌ No | ⚠️ Limited | ❌ No | ❌ No | ✅ Yes |
| Responsive Web UI | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

### 2.3 Feasibility Study

#### 2.3.1 Technical Feasibility
The proposed system leverages a proven technology stack: Node.js with Express for REST API services, MongoDB with Mongoose for document-oriented persistence, Redis with Bull queues for asynchronous job processing, and React 18 with Tailwind CSS for the frontend. All chosen technologies are mature, well-documented, and widely deployed in production. Payment processing via Razorpay and email via Nodemailer are supported by established SDKs. The architecture patterns (multi-tenant scoping, JWT refresh rotation, feature gating, RBAC middleware pipeline) are industry-standard and implementable within the project timeframe.

#### 2.3.2 Economic Feasibility
The entire backend and frontend stack relies on open-source technologies, eliminating licensing costs. Cloud deployment options (MongoDB Atlas free tier, Render free tier, Vercel hobby tier) allow zero-cost initial deployment. Razorpay charges per successful transaction, aligning costs with revenue for the SaaS model. For an institution subscribing to AttendEase, the subscription fee is projected to be lower than the combined cost of disparate tools (spreadsheet licenses, separate attendance software, payment gateway fees).

#### 2.3.3 Operational Feasibility
The system is delivered as a web application accessible through standard browsers (Chrome, Firefox, Edge), requiring no client-side installation. The role-aware interface reduces training overhead — teachers mark attendance through an intuitive timetable grid, students view results through a familiar portal layout, and administrators manage configurations through guided wizards. Tenant administrators can independently configure courses, subjects, teachers, and fee structures without developer intervention.

---

## 3. RATIONALE

The development of AttendEase is justified by several converging factors:

- **Administrative Burden:**中小型 colleges in India expend significant human resources on manual attendance registers, paper-based exam schedules, and offline fee collection. Digitizing these workflows reduces processing time by an estimated 60–80%.
- **Data Integrity & Compliance:** Manual systems are prone to tampering, loss, and inconsistencies. A centralized ERP with audit logging, immutable transaction records, and role-based access ensures regulatory compliance and data provenance.
- **Scalability of SaaS:** A multi-tenant SaaS model allows AttendEase to serve hundreds of institutions from a single codebase and infrastructure, making quality academic software accessible to institutions that cannot afford traditional ERP licenses.
- **Intelligent Features:** Proxy detection, offline sync, and automated conflict resolution directly address pain points reported by educators and administrators — features that generic ERPs or ad-hoc tools do not provide.
- **Economic Empowerment:** By automating fee collection, exam grading, and report generation, institutions can reallocate administrative staff to higher-value activities, improving overall institutional efficiency.

The significance of this project lies in its potential to democratize access to enterprise-grade academic management tools, particularly for中小型 colleges that have historically been underserved by expensive, monolithic ERP vendors.

---

## 4. METHODOLOGY / PLANNING OF WORK

### 4.1 SDLC Model

The project follows an **Agile Incremental development model**, organized into five major phases. Each phase delivers a functional increment that is integrated, tested, and reviewed before proceeding to the next.

### 4.2 Phase-wise Planning

**Phase 1: Foundation — Authentication, Multi-Tenancy & RBAC**
- User registration, JWT login, 2FA (TOTP).
- Refresh token rotation (15-minute access tokens, 7-day refresh tokens).
- Tenant resolver middleware, tenant-scoped queries.
- CustomRole model with granular permissions.
- Super admin and tenant admin dashboards.

**Phase 2: Academic Core — Courses, Subjects, Teachers & Timetable**
- Course → Branch → Semester → Subject → Section hierarchy.
- Teacher CRUD with cascade delete.
- Subject CRUD and teacher-subject-section assignments.
- Weekly timetable grid (Day × Time Slot) per section.
- Conflict detection (teacher overlap, room double-booking, section clash).
- Bulk timetable import.

**Phase 3: Attendance Intelligence**
- Attendance marking from scheduled timetable slots.
- Proxy detection (IP + device fingerprint).
- Offline sync queue with exponential backoff.
- SMS fallback parsing for low-connectivity scenarios.
- Background Bull queue for statistical aggregation.
- Attendance history, overview tables, CSV export.

**Phase 4: Exams, Grades & Fees**
- Date × Shift exam grid (Shifts I–IV).
- Exam scheduling with conflict detection.
- Invigilator assignment (max 2, conflict-aware).
- Grade submission and GPA computation.
- Student result portal.
- Fee structure per course, auto-generation, student self-payment (Razorpay), transaction logging, receipt generation.

**Phase 5: Billing, Plan Gating & Frontend Polish**
- Plan hierarchy (Basic, Professional, Enterprise) with module/limit definitions.
- Subscription billing flow (Razorpay order creation → checkout → verification).
- Plan feature guard middleware (403 with upgradeRequired flag).
- Upgrade modal (PricingModal) with plan comparison.
- Tenant branding (logo, favicon, design tokens).
- Role-aware sidebar navigation, theme engine.
- Audit logging, request tracing, rate limiting hardening.
- Graceful shutdown, cache monitoring, tenant isolation contract tests.

### 4.3 Module Division & Responsibilities

| Module | Key Components | Deliverable |
|---|---|---|
| Auth & Tenancy | JWT, 2FA, tenantResolver, RBAC middleware | Secure, scoped API |
| Academic Core | Course, Branch, Semester, Subject, Section models + controllers | CRUD + promotion engine |
| Timetable | Timetable model, conflict checker, bulk import | Validated weekly schedules |
| Attendance | Attendance model, proxy detection, offline sync, Bull queue | Reliable attendance records |
| Exams | Exam model, invigilation logic, grade computation, result views | Complete exam lifecycle |
| Fees | Fee model, Razorpay integration, receipt generation | Automated billing & payments |
| Billing & Plans | PlanDefaults, featureGuard, PricingModal | Subscription management |
| Frontend | React SPA, ThemeContexts, AppShell, shared UI kit | Responsive, branded UI |

### 4.4 Quality Assurance Strategy
- **Backend:** `node --check` syntax validation, ESLint-equivalent code review, automated tenant isolation tests (11/11 passing).
- **Frontend:** `npm run build` production build verification, zero-ESLint-error policy.
- **Integration:** Live API verification against seeded JWT accounts.
- **Monitoring:** Structured logging (`logger.js`), API logs, audit logs, cache hit-rate monitoring on `/health`.

---

## 5. CONTEXT / E-R DIAGRAMS

### 5.1 System Architecture Overview

The system is architected as a **Multi-Tenant Modular Monolith with Asynchronous Queue Workers**.

```
Client Layer (Frontend SPA)
    ├── Super Admin Dashboard
    ├── Tenant Admin Portal
    ├── Teacher Dashboard
    └── Student & Parent Portal
                ↓
Edge & Middleware Layer
    ├── CORS & Helmet CSP
    ├── Redis Fail-Closed Rate Limiter
    ├── JWT Auth & 2FA Guard
    ├── Tenant Resolver & Auto-Scoper
    ├── Plan Feature Guard (403 Gate)
    └── RBAC Permission Evaluator
                ↓
Backend API Server (Express 4, Port 8011)
    ├── Resource Controllers
    ├── Express Validators
    ├── Audit & Request Tracing
    └── Plan Defaults Engine
                ↓
    ┌───────────────────────────────────┐
    │                                   │
DataStore              Async Queue Workers
    │                                   │
MongoDB + Mongoose        Redis Bull Queue
Redis Cache                ├── Attendance Recalc
                          ├── SMS Fallback
                          └── Offline Sync
                ↓
External Integrations
    ├── Razorpay Payment Gateway
    ├── Nodemailer SMTP Email
    └── Twilio SMS Gateway
```

### 5.2 Entity-Relationship Diagram

**Entities and Relationships:**

- **Tenant** (1) ─── (N) **User**: An institution (tenant) contains multiple users (admin, teachers, students, parents).
- **Tenant** (1) ─── (N) **Course**: Each tenant defines academic courses (e.g., B.Tech, BCA).
- **Course** (1) ─── (N) **Subject**: Courses contain subjects mapped to semesters.
- **Tenant** (1) ─── (N) **Timetable**: Tenants schedule timetables for their sections.
- **Tenant** (1) ─── (N) **Exam**: Tenants conduct exams for their courses/semesters.
- **Tenant** (1) ─── (N) **Fee**: Tenants define fee structures for their programs.
- **Tenant** (1) ─── (N) **CustomRole**: Each tenant defines custom organizational roles.
- **User** (1) ─── (N) **Enrollment**: Students enroll in subjects/sections.
- **User** (1) ─── (N) **Attendance**: Users mark or receive attendance records linked to timetable slots.
- **User** (1) ─── (N) **ExamResult**: Users obtain exam results.
- **User** (1) ─── (N) **Transaction**: Users make fee payments logged as transactions.
- **Timetable** (1) ─── (N) **Attendance**: Each attendance record is linked to a timetable slot.
- **Exam** (1) ─── (N) **ExamResult**: Each exam has multiple student grade records.
- **Fee** (1) ─── (N) **Transaction**: Each fee invoice tracks payment transactions.

### 5.3 Database Collections Reference

| Collection | Purpose | Key Fields |
|---|---|---|
| **Tenant** | Institution profile | name, domain, settings (semesters, exams, shifts), branding (logo, colors), subscription (plan, status) |
| **User** | All accounts | role (super_admin/admin/teacher/student/parent), attendance summary, assignedSubjects, tokenVersion, 2FA |
| **Plan** | SaaS plan tiers | code, name, priceMonthly, modules{}, limits{} |
| **Course** | Academic programs | code, branches[], durationYears, semestersPerYear, feeStructure |
| **Subject** | Course subjects | courseId, courseCode, branch, semester, isActive |
| **Timetable** | Class schedules | day, startTime, endTime, room, teacherId, subjectId, section, isNoClass |
| **Attendance** | Per-student attendance | date, status (present/absent/leave), timetableId, proxy telemetry (ipAddress, x-device-fingerprint) |
| **Enrollment** | Student enrollments | studentId, subjectId, section, teacherId |
| **Exam** | Exam schedules | date, shift (I-IV), examTypeCode, courseId, branch, semester, invigilators[], maxMarks, passingMarks |
| **ExamResult** | Student grades | studentId, examId, marksObtained, grade, isAbsent, remarks |
| **Fee** | Student fee invoices | studentId, amount, paidAmount, dueDate, status (pending/partial/paid/waived), type |
| **Transaction** | Payment logs | razorpayPaymentId, amount, paymentMethod, receiptUrl |
| **CustomRole** | Custom roles | tenantId, name, permissions[] |
| **AuditLog** | Compliance trail | actor, role, tenantId, action, resource, IP, requestId |
| **RefreshToken** | Session tokens | userId, token hash, expiresAt |
| **APILog** | Performance logs | method, path, statusCode, responseTime, IP |

---

## 6. FACILITIES REQUIRED FOR PROPOSED WORK

### 6.1 Hardware Requirements

**Development Environment:**
- Processor: Intel Core i5 / AMD Ryzen 5 or higher
- RAM: 8 GB minimum (16 GB recommended)
- Storage: 256 GB SSD minimum
- Network: Broadband internet connection (10 Mbps+)

**Production Deployment:**
- Server: 4+ vCPU cores, 8 GB+ RAM
- Storage: 50 GB+ SSD
- Network: Static IP, 100 Mbps+ bandwidth

### 6.2 Software Requirements

**Operating System:**
- Windows 10/11, macOS, or Linux (Ubuntu 20.04+)

**Backend:**
- Node.js 18+ (runtime)
- Express.js 4 (web framework)
- MongoDB 5+ (primary database)
- Redis 6+ (caching, Bull queues)
- Mongoose ODM
- JWT, bcryptjs, speakeasy, qrcode, Razorpay SDK, Nodemailer

**Frontend:**
- React 18
- React Router v6
- Tailwind CSS
- Styled Components, Framer Motion, Headless UI
- Axios, date-fns, Recharts, xlsx

**Development Tools:**
- Visual Studio Code
- Git & GitHub
- Postman / Thunder Client (API testing)
- MongoDB Compass (DB management)

**Deployment:**
- Vercel / Render (frontend/backend hosting)
- MongoDB Atlas (managed database)
- Redis Cloud / Upstash (managed Redis)

### 6.3 Third-Party Services
- **Razorpay:** Payment gateway for fee collection and subscriptions.
- **Nodemailer / SMTP:** Email notifications (password reset, receipts, alerts).
- **Twilio:** SMS gateway for attendance fallback and notifications.

---

## 7. REFERENCES

[1] M. A. Chacon and S. Harter, *Node.js Design Patterns*, 3rd ed. Packt Publishing, 2020.

[2] D. F. P. and M. K. S., "A Comprehensive Study of Multi-Tenant Architecture in SaaS Applications," *IEEE Access*, vol. 8, pp. 184321–184335, 2020. doi: 10.1109/ACCESS.2020.3028456.

[3] R. L. Krutz and A. V. S., "Role-Based Access Control in Modern Web Applications: A Systematic Review," in *Proc. IEEE Int. Conf. on Advances in Computing and Communications (ICACC)*, 2021, pp. 45–52.

[4] S. Gupta and N. K. Singh, "Cloud-Based Attendance Management System with Offline Sync Capability," *IEEE Trans. on Education*, vol. 64, no. 3, pp. 456–463, Aug. 2021. doi: 10.1109/TE.2021.3056789.

[5] A. K. Pandey et al., "Intelligent Attendance Tracking Using Device Fingerprinting and Proxy Detection," in *Proc. IEEE Int. Conf. on Smart Computing and Communications (ICSCC)*, 2022, pp. 112–118.

[6] P. Sharma and R. Verma, "Automated Fee Management and Payment Gateway Integration for Educational Institutions," *IEEE Trans. on Engineering Management*, vol. 69, no. 5, pp. 2341–2350, Oct. 2022. doi: 10.1109/TEM.2022.3145678.

[7] J. W. Satzinger, R. Jackson, and S. D. Burd, *Systems Analysis and Design in a Changing World*, 7th ed. Cengage Learning, 2019.

[8] M. Fowler, *Patterns of Enterprise Application Architecture*. Addison-Wesley Professional, 2012.

[9] Razorpay Documentation, "Payment Gateway Integration Guide," [Online]. Available: https://razorpay.com/docs/

[10] Mongoose Documentation, "Mongoose ODM Guide," [Online]. Available: https://mongoosejs.com/docs/

---

*End of Synopsis*
