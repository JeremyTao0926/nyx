import { describe, expect, it } from "vitest";
import { affectedSubscribers, premiumFromCustomer } from "../supabase/functions/_shared/revenuecat";

const now = Date.parse("2026-09-15T00:00:00Z");
const past = "2026-09-14T00:00:00Z";
const future = "2026-09-16T00:00:00Z";
const plus = "nyx_premium_plus_monthly";
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

describe("RevenueCat authoritative entitlement mapping", () => {
  it("does not grant access without an entitlement", () => {
    expect(premiumFromCustomer({}, plus, now).is_premium).toBe(false);
  });
  it("persists the grace deadline, not the expired billing period", () => {
    const patch = premiumFromCustomer({ subscriber: { entitlements: { premium: {
      expires_date: past, grace_period_expires_date: future, product_identifier: plus,
    } } } }, plus, now);
    expect(patch).toEqual({ is_premium: true, premium_plan: "premium_plus", premium_expires_at: "2026-09-16T00:00:00.000Z" });
  });
  it("expires access after both billing and grace deadlines", () => {
    const patch = premiumFromCustomer({ subscriber: { entitlements: { premium: { expires_date: past } } } }, plus, now);
    expect(patch.is_premium).toBe(false);
    expect(patch.premium_plan).toBeNull();
  });
  it.each([undefined, "invalid"])("fails closed for malformed expiration %s", expires_date => {
    expect(premiumFromCustomer({ subscriber: { entitlements: { premium: { expires_date } } } }, plus, now).is_premium).toBe(false);
  });
  it("supports explicit lifetime entitlements", () => {
    expect(premiumFromCustomer({ subscriber: { entitlements: { premium: { expires_date: null } } } }, plus, now)).toEqual({
      is_premium: true, premium_plan: "premium", premium_expires_at: null,
    });
  });
  it("handles transfers without app_user_id and deduplicates accounts", () => {
    expect(affectedSubscribers({ type: "TRANSFER", transferred_from: [userA, "$RCAnonymousID:x"], transferred_to: [userB, userA] })).toEqual([userA, userB]);
  });
  it("ignores dashboard TEST events", () => {
    expect(affectedSubscribers({ type: "TEST", app_user_id: userA })).toEqual([]);
  });
});
