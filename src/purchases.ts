import { Purchases } from "@revenuecat/purchases-capacitor";
import type { UserProfile } from "./types";
import { sb } from "./utils";

const ENTITLEMENT = "premium";
let configuredUser: string | null = null;
let configurationQueue: Promise<void> = Promise.resolve();

async function configure(userId: string) {
  if (configuredUser === userId) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
  if (!apiKey) throw new Error("尚未設定 RevenueCat iOS API key");
  configurationQueue = configurationQueue.catch(() => undefined).then(async () => {
    if (configuredUser === userId) return;
    const { isConfigured } = await Purchases.isConfigured();
    if (!isConfigured) {
      await Purchases.configure({ apiKey, appUserID: userId });
    } else {
      const { appUserID } = await Purchases.getAppUserID();
      if (appUserID !== userId) await Purchases.logIn({ appUserID: userId });
    }
    configuredUser = userId;
  });
  await configurationQueue;
}

function findPlanPackage(
  packages: Awaited<ReturnType<typeof Purchases.getOfferings>>["current"] extends infer Offering
    ? Offering extends { availablePackages: infer Packages } ? Packages : never
    : never,
  planId: string,
) {
  return packages.find(item =>
    item.identifier === planId || item.product.identifier === `nyx_${planId}_monthly`,
  );
}

export async function getIOSPlanPrices(userId: string) {
  await configure(userId);
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  return Object.fromEntries(
    ["premium", "premium_plus"].map(planId => [
      planId,
      findPlanPackage(packages, planId)?.product.priceString ?? "",
    ]),
  );
}

export async function purchaseIOSPlan(userId: string, planId: string) {
  await configure(userId);
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const selected = findPlanPackage(packages, planId);
  if (!selected) throw new Error(`App Store 尚未提供 ${planId} 方案`);
  const result = await Purchases.purchasePackage({ aPackage: selected });
  return Boolean(result.customerInfo.entitlements.active[ENTITLEMENT]);
}

export async function restoreIOSPurchases(userId: string) {
  await configure(userId);
  const result = await Purchases.restorePurchases();
  return Boolean(result.customerInfo.entitlements.active[ENTITLEMENT]);
}

export type SubscriptionProfilePatch = Pick<
  UserProfile,
  "is_premium" | "premium_plan" | "premium_expires_at"
>;

/** Immediately mirrors RevenueCat's server-authoritative entitlement to NYX. */
export async function syncIOSSubscriptionProfile(): Promise<SubscriptionProfilePatch> {
  const { data, error } = await sb.functions.invoke("sync-revenuecat-entitlement", { body: {} });
  if (error) throw error;
  if (!data || typeof data.is_premium !== "boolean") {
    throw new Error("訂閱狀態回傳格式不正確");
  }
  return {
    is_premium: data.is_premium,
    premium_plan: data.premium_plan === "premium_plus"
      ? "premium_plus"
      : data.premium_plan === "premium"
        ? "premium"
        : null,
    premium_expires_at: typeof data.premium_expires_at === "string"
      ? data.premium_expires_at
      : null,
  };
}
