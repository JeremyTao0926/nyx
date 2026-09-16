import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

describe("Premium identity visibility", () => {
  it("shows the active plan on the subscriber's own profile", () => {
    const profile = source("src/screens/ProfileScreen.tsx");
    expect(profile).toContain("const activePremiumPlan = getActivePremiumPlan(profile)");
    expect(profile).toContain("<PremiumBadge plan={activePremiumPlan} />");
  });

  it("shows paid identity to other users throughout discovery and chat", () => {
    const explore = source("src/screens/ExploreScreen.tsx");
    const chat = source("src/screens/ChatScreens.tsx");
    expect(explore).toContain("<PremiumBadge plan={p.is_premium ? (p.premium_plan || \"premium\") : null}");
    expect(chat).toContain("<PremiumBadge plan={item.premiumPlan} mini />");
    expect(chat).toContain("<PremiumBadge plan={other.isPremium ? (other.premiumPlan || \"premium\") : null} mini />");
  });

  it("loads plan and expiry fields and hides expired badges", () => {
    const utils = source("src/utils.ts");
    const subscription = source("src/subscription.ts");
    expect(utils).toContain("is_premium,premium_plan,premium_expires_at");
    expect(utils).toContain("const activePlan = getActivePremiumPlan(r)");
    expect(subscription).toContain("expiresAt <= now");
  });
});
