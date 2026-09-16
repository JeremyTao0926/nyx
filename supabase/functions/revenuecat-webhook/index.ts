import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { affectedSubscribers, premiumFromCustomer, type RevenueCatEvent } from "../_shared/revenuecat.ts";

async function syncSubscriber(userId: string, admin: ReturnType<typeof createClient>, apiKey: string) {
  const premiumPlusId = Deno.env.get("IOS_PREMIUM_PLUS_PRODUCT_ID") ?? "nyx_premium_plus_monthly";
  // Always resolve current state: a delayed event must not restore a refund.
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`RevenueCat subscriber lookup failed (${response.status})`);
  const patch = premiumFromCustomer(await response.json(), premiumPlusId);
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
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
    if (!event?.type) return new Response("Missing event", { status: 400 });
    // TRANSFER events can omit app_user_id; sync both sides of the transfer.
    const userIds = affectedSubscribers(event);
    if (userIds.length === 0) return new Response("No NYX users to sync", { status: 200 });
    const apiKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");
    if (!apiKey) return new Response("Subscription sync is not configured", { status: 503 });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await Promise.all(userIds.map(id => syncSubscriber(id, admin, apiKey)));
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("revenuecat-webhook error", error);
    return new Response("Internal error", { status: 500 });
  }
});
