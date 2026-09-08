import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number;
  entitlement_ids?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

async function syncSubscriber(userId: string, admin: ReturnType<typeof createClient>, event?: RevenueCatEvent) {
  if (!UUID.test(userId)) return;
  const premiumPlusId = Deno.env.get("IOS_PREMIUM_PLUS_PRODUCT_ID") ?? "nyx_premium_plus_monthly";
  const premiumId = Deno.env.get("IOS_PREMIUM_PRODUCT_ID") ?? "nyx_premium_monthly";
  const apiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");

  let productId = String(event?.product_id ?? "");
  let expiration = event?.expiration_at_ms ? new Date(Number(event.expiration_at_ms)).toISOString() : null;
  let isActive = event?.type !== "EXPIRATION" && (!expiration || Date.parse(expiration) > Date.now());

  // Webhooks may arrive out of order, and PRODUCT_CHANGE can be deferred.
  // When configured, always resolve the current entitlement from RevenueCat.
  if (apiKey) {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
    const customer = await response.json();
    const entitlement = customer?.subscriber?.entitlements?.premium;
    productId = String(entitlement?.product_identifier ?? "");
    expiration = entitlement?.expires_date ?? null;
    const graceExpiration = entitlement?.grace_period_expires_date ?? null;
    const activeUntil = Math.max(
      expiration ? Date.parse(expiration) : Number.POSITIVE_INFINITY,
      graceExpiration ? Date.parse(graceExpiration) : 0,
    );
    isActive = Boolean(entitlement) && activeUntil > Date.now();
  } else {
    const hasPremiumEntitlement = event?.entitlement_ids?.includes("premium") === true;
    const knownProduct = productId === premiumId || productId === premiumPlusId;
    if (!knownProduct && !hasPremiumEntitlement) return;
  }

  const { error } = await admin.from("profiles").update({
    is_premium: isActive,
    premium_plan: isActive ? (productId === premiumPlusId ? "premium_plus" : "premium") : null,
    premium_expires_at: expiration,
  }).eq("id", userId);
  if (error) throw error;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!expected || req.headers.get("Authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { event } = await req.json() as { event?: RevenueCatEvent };
    const userId = event?.app_user_id;
    if (!userId) return new Response("Missing app_user_id", { status: 400 });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (event?.type === "TRANSFER") {
      const transferredUsers = [...new Set([...(event.transferred_from ?? []), ...(event.transferred_to ?? [])])];
      await Promise.all(transferredUsers.map(id => syncSubscriber(id, admin)));
    } else {
      await syncSubscriber(userId, admin, event);
    }
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("revenuecat-webhook error", error);
    return new Response("Internal error", { status: 500 });
  }
});
