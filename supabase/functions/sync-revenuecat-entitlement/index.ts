import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");
    if (!apiKey) {
      console.error("sync-revenuecat-entitlement is missing REVENUECAT_SECRET_API_KEY");
      return json({ error: "Subscription sync is not configured" }, 503);
    }

    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(authData.user.id)}`,
      { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } },
    );
    if (!response.ok) {
      console.error("RevenueCat subscriber lookup failed", response.status, await response.text());
      return json({ error: "Unable to verify App Store subscription" }, 502);
    }

    const customer = await response.json();
    const entitlement = customer?.subscriber?.entitlements?.premium;
    const expiration = typeof entitlement?.expires_date === "string" ? entitlement.expires_date : null;
    const graceExpiration = typeof entitlement?.grace_period_expires_date === "string"
      ? entitlement.grace_period_expires_date
      : null;
    const activeUntil = Math.max(
      expiration ? Date.parse(expiration) : Number.POSITIVE_INFINITY,
      graceExpiration ? Date.parse(graceExpiration) : 0,
    );
    const active = Boolean(entitlement) && activeUntil > Date.now();
    const premiumPlusProduct = Deno.env.get("IOS_PREMIUM_PLUS_PRODUCT_ID") ?? "nyx_premium_plus_monthly";
    const productId = String(entitlement?.product_identifier ?? "");
    const plan = active
      ? productId === premiumPlusProduct ? "premium_plus" : "premium"
      : null;

    const profilePatch = {
      is_premium: active,
      premium_plan: plan,
      premium_expires_at: active ? (expiration ?? graceExpiration) : expiration,
    };
    const { error: updateError } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", authData.user.id);
    if (updateError) throw updateError;

    return json(profilePatch);
  } catch (error) {
    console.error("sync-revenuecat-entitlement error", error);
    return json({ error: "Unable to sync subscription" }, 500);
  }
});
