type Entitlement = {
  product_identifier?: string;
  expires_date?: string | null;
  grace_period_expires_date?: string | null;
};

export type RevenueCatCustomer = {
  subscriber?: { entitlements?: { premium?: Entitlement } };
};

export function premiumFromCustomer(
  customer: RevenueCatCustomer,
  premiumPlusProduct: string,
  now = Date.now(),
) {
  const entitlement = customer.subscriber?.entitlements?.premium;
  const expiration = entitlement?.expires_date;
  // Only explicit null represents lifetime access; malformed dates fail closed.
  const expiresAt = expiration === null ? Infinity : Date.parse(expiration ?? "");
  const graceAt = Date.parse(entitlement?.grace_period_expires_date ?? "");
  const activeUntil = Math.max(
    Number.isNaN(expiresAt) ? 0 : expiresAt,
    Number.isNaN(graceAt) ? 0 : graceAt,
  );
  const active = Boolean(entitlement) && activeUntil > now;
  return {
    is_premium: active,
    premium_plan: active
      ? entitlement?.product_identifier === premiumPlusProduct ? "premium_plus" : "premium"
      : null,
    premium_expires_at: activeUntil === Infinity || activeUntil === 0
      ? null
      : new Date(activeUntil).toISOString(),
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
};

export function affectedSubscribers(event: RevenueCatEvent) {
  if (event.type === "TEST") return [];
  const ids = event.type === "TRANSFER"
    ? [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]
    : [event.app_user_id ?? ""];
  return [...new Set(ids.filter(id => typeof id === "string" && UUID.test(id)))];
}
