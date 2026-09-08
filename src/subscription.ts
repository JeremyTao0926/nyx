import type { PremiumPlan } from "./types";

export type PremiumStatus = {
  is_premium?: boolean | null;
  premium_plan?: PremiumPlan | string | null;
  premium_expires_at?: string | null;
};

export function getActivePremiumPlan(
  status: PremiumStatus | null | undefined,
  now = Date.now(),
): PremiumPlan | null {
  if (!status?.is_premium) return null;
  if (status.premium_expires_at) {
    const expiresAt = Date.parse(status.premium_expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  }
  return status.premium_plan === "premium_plus" ? "premium_plus" : "premium";
}

export function premiumPlanLabel(plan: PremiumPlan | null): string {
  return plan === "premium_plus" ? "Premium+" : plan === "premium" ? "Premium" : "免費方案";
}

export function isPurchaseCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return record.userCancelled === true
    || String(record.code ?? "").toUpperCase().includes("PURCHASE_CANCELLED");
}
