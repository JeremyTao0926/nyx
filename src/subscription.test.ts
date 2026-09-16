import { describe, expect, it } from "vitest";
import { getActivePremiumPlan, isPurchaseCancellation, premiumPlanLabel } from "./subscription";

describe("subscription status", () => {
  const now = Date.parse("2026-09-08T12:00:00Z");

  it("shows both active paid tiers", () => {
    expect(getActivePremiumPlan({ is_premium: true, premium_plan: "premium" }, now)).toBe("premium");
    expect(getActivePremiumPlan({ is_premium: true, premium_plan: "premium_plus" }, now)).toBe("premium_plus");
  });

  it("does not show an expired or malformed entitlement", () => {
    expect(getActivePremiumPlan({ is_premium: true, premium_plan: "premium_plus", premium_expires_at: "2026-09-08T11:59:59Z" }, now)).toBeNull();
    expect(getActivePremiumPlan({ is_premium: true, premium_plan: "premium", premium_expires_at: "not-a-date" }, now)).toBeNull();
  });

  it("uses Premium as the safe legacy fallback and labels plans", () => {
    expect(getActivePremiumPlan({ is_premium: true, premium_plan: null }, now)).toBe("premium");
    expect(premiumPlanLabel("premium_plus")).toBe("Premium+");
    expect(premiumPlanLabel(null)).toBe("免費方案");
  });

  it("recognizes an App Store sheet cancelled by the user", () => {
    expect(isPurchaseCancellation({ userCancelled: true })).toBe(true);
    expect(isPurchaseCancellation({ code: "PURCHASE_CANCELLED_ERROR" })).toBe(true);
    expect(isPurchaseCancellation(new Error("network failed"))).toBe(false);
  });
});
