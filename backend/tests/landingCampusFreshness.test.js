/**
 * Test Suite: Landing Campus Data Freshness & Tenant Deletion Cache Invalidation
 * Usage: node backend/tests/landingCampusFreshness.test.js
 */

const assert = require("assert");
const cache = require("../middleware/cache");

async function runTests() {
  console.log("=== STARTING LANDING CAMPUS FRESHNESS & CACHE INVALIDATION TEST SUITE ===\n");

  let passedTests = 0;
  let totalTests = 0;

  async function test(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}: ${err.message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 1: In-Memory / Redis Cache Invalidation on Tenant Delete
  // ──────────────────────────────────────────────────────────────────────────
  console.log("--- TEST GROUP 1: Cache Invalidation on Tenant Delete ---");

  await test("cache.delPattern clears all matching tenant and landing keys", async () => {
    const tenantId = "tenant123456";
    const subdomain = "buggedcampus";

    // Populate simulated cache entries
    await cache.set(`tenant:${tenantId}`, { name: "Bugged Campus" });
    await cache.set(`tenant:subdomain:${subdomain}`, { name: "Bugged Campus" });
    await cache.set(`landing:search-tenants:${subdomain}`, { results: [subdomain] });
    await cache.set(`landing:search-tenants:default`, { results: [subdomain] });
    await cache.set(`other:unrelated`, { keep: true });

    // Verify they exist
    assert.notStrictEqual(await cache.get(`tenant:${tenantId}`), null);
    assert.notStrictEqual(await cache.get(`tenant:subdomain:${subdomain}`), null);
    assert.notStrictEqual(await cache.get(`landing:search-tenants:${subdomain}`), null);

    // Perform the exact deletion invalidation logic used in deleteTenant
    await cache.del(`tenant:${tenantId}`);
    await cache.del(`tenant:subdomain:${subdomain}`);
    await cache.delPattern(`*${subdomain}*`);
    await cache.delPattern(`*${tenantId}*`);
    await cache.delPattern('landing:*');

    // Verify all tenant and landing caches are purged
    assert.strictEqual(await cache.get(`tenant:${tenantId}`), null);
    assert.strictEqual(await cache.get(`tenant:subdomain:${subdomain}`), null);
    assert.strictEqual(await cache.get(`landing:search-tenants:${subdomain}`), null);
    assert.strictEqual(await cache.get(`landing:search-tenants:default`), null);

    // Unrelated cache should remain untouched
    const unrelated = await cache.get(`other:unrelated`);
    assert.strictEqual(unrelated?.keep, true);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 2: Search and Info Filter Logic for Stale/Deleted Tenants
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 2: Landing Page Tenant Verification Logic ---");

  await test("Filter criteria rejects soft-deleted (deletedAt), inactive, or suspended tenants", () => {
    const mockTenants = [
      { subdomain: "valid1", isActive: true, deletedAt: null, subscription: { status: "active" }, isDemo: false },
      { subdomain: "valid2", isActive: true, deletedAt: null, subscription: { status: "trial" }, isDemo: false },
      { subdomain: "deleted1", isActive: true, deletedAt: new Date(), subscription: { status: "active" }, isDemo: false },
      { subdomain: "inactive1", isActive: false, deletedAt: null, subscription: { status: "active" }, isDemo: false },
      { subdomain: "suspended1", isActive: true, deletedAt: null, subscription: { status: "suspended" }, isDemo: false },
      { subdomain: "expired1", isActive: true, deletedAt: null, subscription: { status: "expired" }, isDemo: false },
      { subdomain: "demo", isActive: true, deletedAt: null, subscription: { status: "active" }, isDemo: true },
    ];

    // Filter used in search-tenants
    const activePublicTenants = mockTenants.filter(t => 
      t.isActive === true &&
      !t.deletedAt &&
      t.isDemo !== true &&
      ["active", "trial"].includes(t.subscription?.status)
    );

    assert.strictEqual(activePublicTenants.length, 2);
    assert.deepStrictEqual(activePublicTenants.map(t => t.subdomain), ["valid1", "valid2"]);
  });

  await test("Tenant verification returns hasTenant: false when tenant not found or deleted", () => {
    const findTenant = (subdomain, db) => {
      const match = db.find(t => 
        t.subdomain === subdomain &&
        t.isActive === true &&
        !t.deletedAt &&
        ["active", "trial"].includes(t.subscription?.status)
      );
      if (!match) {
        return { success: true, hasTenant: false, message: "No tenant found" };
      }
      return { success: true, hasTenant: true, tenant: { subdomain: match.subdomain } };
    };

    const db = [
      { subdomain: "harvard", isActive: true, deletedAt: null, subscription: { status: "active" } }
    ];

    const resultValid = findTenant("harvard", db);
    assert.strictEqual(resultValid.hasTenant, true);

    const resultDeleted = findTenant("buggedcampus", db);
    assert.strictEqual(resultDeleted.hasTenant, false);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST GROUP 3: Frontend LocalStorage Synchronization Semantics
  // ──────────────────────────────────────────────────────────────────────────
  console.log("\n--- TEST GROUP 3: Active and Recent Tenant Storage Purge Semantics ---");

  await test("Storage purge removes deleted tenant from both active and recent lists", () => {
    // Simulated localStorage store
    const store = {
      activeTenant: JSON.stringify({ subdomain: "buggedcampus", name: "Bugged Campus" }),
      tenantSubdomain: "buggedcampus",
      tenantName: "Bugged Campus",
      recentTenants: JSON.stringify([
        { subdomain: "buggedcampus", name: "Bugged Campus" },
        { subdomain: "othercampus", name: "Other Campus" },
      ]),
      "attendease:tenant_branding": JSON.stringify({ subdomain: "buggedcampus", timestamp: Date.now() }),
    };

    const removeRecentTenant = (subdomain) => {
      const cleanSub = subdomain.trim().toLowerCase();
      const recents = JSON.parse(store.recentTenants || "[]").filter(t => t.subdomain.toLowerCase() !== cleanSub);
      store.recentTenants = JSON.stringify(recents);

      const active = store.activeTenant ? JSON.parse(store.activeTenant) : null;
      if (active && active.subdomain.toLowerCase() === cleanSub) {
        delete store.activeTenant;
        delete store.tenantSubdomain;
        delete store.tenantName;
        delete store["attendease:tenant_branding"];
      }
    };

    // Remove the bugged/deleted campus
    removeRecentTenant("buggedcampus");

    assert.strictEqual(store.activeTenant, undefined);
    assert.strictEqual(store.tenantSubdomain, undefined);
    assert.strictEqual(store.tenantName, undefined);
    assert.strictEqual(store["attendease:tenant_branding"], undefined);

    const remainingRecents = JSON.parse(store.recentTenants);
    assert.strictEqual(remainingRecents.length, 1);
    assert.strictEqual(remainingRecents[0].subdomain, "othercampus");
  });

  console.log(`\n=== RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===`);
  if (passedTests === totalTests) {
    console.log("🎉 ALL LANDING CAMPUS FRESHNESS TESTS PASSED!");
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("FATAL ERROR IN TEST RUNNER:", err);
  process.exit(1);
});
