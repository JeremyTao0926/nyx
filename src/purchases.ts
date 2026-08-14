import { Purchases } from "@revenuecat/purchases-capacitor";

const ENTITLEMENT = "premium";
let configuredUser: string | null = null;

async function configure(userId: string) {
  if (configuredUser === userId) return;
  const apiKey = import.meta.env.VITE_REVENUECAT_IOS_API_KEY;
  if (!apiKey) throw new Error("尚未設定 RevenueCat iOS API key");
  await Purchases.configure({ apiKey, appUserID: userId });
  configuredUser = userId;
}

export async function purchaseIOSPlan(userId: string, planId: string) {
  await configure(userId);
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const selected = packages.find(item =>
    item.identifier === planId || item.product.identifier === `nyx_${planId}_monthly`,
  );
  if (!selected) throw new Error(`App Store 尚未提供 ${planId} 方案`);
  const result = await Purchases.purchasePackage({ aPackage: selected });
  return Boolean(result.customerInfo.entitlements.active[ENTITLEMENT]);
}

export async function restoreIOSPurchases(userId: string) {
  await configure(userId);
  const result = await Purchases.restorePurchases();
  return Boolean(result.customerInfo.entitlements.active[ENTITLEMENT]);
}
