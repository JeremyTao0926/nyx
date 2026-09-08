import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revenueCat = vi.hoisted(() => ({
  configure: vi.fn(),
  getAppUserID: vi.fn(),
  getOfferings: vi.fn(),
  isConfigured: vi.fn(),
  logIn: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
}));
const invoke = vi.hoisted(() => vi.fn());

vi.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: revenueCat }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ functions: { invoke } })),
}));

import { getIOSPlanPrices, syncIOSSubscriptionProfile } from "./purchases";

describe("RevenueCat identity lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_REVENUECAT_IOS_API_KEY", "test_revenuecat_key");
    vi.clearAllMocks();
    revenueCat.isConfigured
      .mockResolvedValueOnce({ isConfigured: false })
      .mockResolvedValueOnce({ isConfigured: true });
    revenueCat.getAppUserID.mockResolvedValue({ appUserID: "user-one" });
    revenueCat.getOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          { identifier: "premium", product: { identifier: "nyx_premium_monthly", priceString: "$9.99" } },
          { identifier: "premium_plus", product: { identifier: "nyx_premium_plus_monthly", priceString: "$19.99" } },
        ],
      },
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("configures once and switches accounts with logIn", async () => {
    expect(await getIOSPlanPrices("user-one")).toEqual({ premium: "$9.99", premium_plus: "$19.99" });
    expect(await getIOSPlanPrices("user-two")).toEqual({ premium: "$9.99", premium_plus: "$19.99" });

    expect(revenueCat.configure).toHaveBeenCalledTimes(1);
    expect(revenueCat.configure).toHaveBeenCalledWith(expect.objectContaining({ appUserID: "user-one" }));
    expect(revenueCat.logIn).toHaveBeenCalledWith({ appUserID: "user-two" });
  });

  it("applies only a server-verified entitlement payload", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        is_premium: true,
        premium_plan: "premium_plus",
        premium_expires_at: "2026-10-08T12:00:00Z",
      },
      error: null,
    });

    await expect(syncIOSSubscriptionProfile()).resolves.toEqual({
      is_premium: true,
      premium_plan: "premium_plus",
      premium_expires_at: "2026-10-08T12:00:00Z",
    });
    expect(invoke).toHaveBeenCalledWith("sync-revenuecat-entitlement", { body: {} });
  });

  it("rejects malformed subscription sync data", async () => {
    invoke.mockResolvedValueOnce({ data: { premium_plan: "premium_plus" }, error: null });
    await expect(syncIOSSubscriptionProfile()).rejects.toThrow("訂閱狀態回傳格式不正確");
  });
});
