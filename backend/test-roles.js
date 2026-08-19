/**
 * Role-Flow Verification Script
 * Tests all GET endpoints for each role against a running backend (port 8011).
 *
 * Usage: node test-roles.js
 * Requires: the backend server running on http://localhost:8011
 *
 * You must fill in valid JWTs below (or set env vars).
 */

const http = require("http");

const BASE = "http://localhost:8011/api";

// ── Fill these in with real tokens from your test DB ──
const TOKENS = {
  super_admin: process.env.SA_TOKEN || "",
  admin: process.env.ADMIN_TOKEN || "",
  teacher: process.env.TEACHER_TOKEN || "",
  student: process.env.STUDENT_TOKEN || "",
  parent: process.env.PARENT_TOKEN || "",
};

function get(path, token) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "GET",
      headers: {},
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    const req = http.request(opts, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = null; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on("error", (e) => resolve({ status: 0, error: e.message }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ status: 0, error: "timeout" }); });
    req.end();
  });
}

// ── Endpoint catalogue: [path, description, allowedRoles] ──
// allowedRoles = roles that should get 200; others should get 403/401
const ENDPOINTS = [
  // Timetable
  ["/timetable", "GET /timetable (admin list)", ["admin", "super_admin"]],
  ["/timetable/section/A", "GET /timetable/section/A", ["admin", "teacher", "student", "parent", "super_admin"]],
  ["/timetable/teacher", "GET /timetable/teacher (own)", ["teacher"]],
  // Subjects
  ["/subjects/all", "GET /subjects/all", ["admin", "teacher", "student", "parent", "super_admin"]],
  // Attendance
  ["/attendance/history", "GET /attendance/history", ["admin", "teacher", "student", "parent", "super_admin"]],
  ["/attendance/stats", "GET /attendance/stats", ["student"]],
  // Users
  ["/users/students", "GET /users/students", ["admin", "teacher", "super_admin"]],
  ["/users/profile", "GET /users/profile", ["admin", "teacher", "student", "parent", "super_admin"]],
  // Exams
  ["/exams", "GET /exams (list)", ["admin", "teacher", "student", "parent", "super_admin"]],
  ["/exams/my-results", "GET /exams/my-results", ["admin", "teacher", "student", "parent", "super_admin"]],
  // Fees
  ["/fees/my-fees", "GET /fees/my-fees", ["admin", "teacher", "student", "parent", "super_admin"]],
  // Parent
  ["/parent/dashboard", "GET /parent/dashboard", ["parent"]],
  ["/parent/subjects", "GET /parent/subjects", ["parent"]],
  ["/parent/attendance/stats", "GET /parent/attendance/stats", ["parent"]],
  ["/parent/teachers", "GET /parent/teachers", ["parent"]],
  // Alerts
  ["/alerts", "GET /alerts", ["admin", "teacher", "student", "parent", "super_admin"]],
  // Roles
  ["/roles/my-permissions", "GET /roles/my-permissions", ["admin", "teacher", "student", "parent", "super_admin"]],
  // Tenant
  ["/tenant/usage", "GET /tenant/usage", ["admin", "teacher", "student", "parent", "super_admin"]],
  // Reports
  ["/reports/attendance", "GET /reports/attendance", ["admin", "teacher", "super_admin"]],
];

const ROLES = ["super_admin", "admin", "teacher", "student", "parent"];

async function main() {
  const results = [];
  let pass = 0;
  let fail = 0;
  let skip = 0;

  for (const [path, desc, allowedRoles] of ENDPOINTS) {
    for (const role of ROLES) {
      const token = TOKENS[role];
      if (!token) {
        results.push({ desc, role, status: "SKIP (no token)" });
        skip++;
        continue;
      }
      const res = await get(path, token);
      const shouldAllow = allowedRoles.includes(role);
      const ok = shouldAllow
        ? res.status === 200
        : res.status === 403 || res.status === 401 || res.status === 400;
      const mark = ok ? "PASS" : "FAIL";
      if (ok) pass++; else fail++;
      results.push({
        desc,
        role,
        httpStatus: res.status,
        expected: shouldAllow ? "200" : "403/401",
        result: mark,
        message: res.body?.message || "",
      });
    }
  }

  // Print table
  console.log("\n=== ROLE FLOW VERIFICATION ===\n");
  console.log("Endpoint".padEnd(55) + "Role".padEnd(12) + "HTTP".padEnd(8) + "Expect".padEnd(8) + "Result");
  console.log("-".repeat(95));
  for (const r of results) {
    const color = r.result === "PASS" ? "\x1b[32m" : r.result === "FAIL" ? "\x1b[31m" : "\x1b[33m";
    console.log(
      `${r.desc.padEnd(55)}${r.role.padEnd(12)}${String(r.httpStatus || "-").padEnd(8)}${(r.expected || "-").padEnd(8)}${color}${r.result}\x1b[0m${r.result === "FAIL" ? " (" + r.message + ")" : ""}`
    );
  }

  console.log(`\n=== SUMMARY: ${pass} passed, ${fail} failed, ${skip} skipped ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
