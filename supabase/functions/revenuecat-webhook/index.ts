import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!expected || req.headers.get("Authorization") !== `Bearer ${expected}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { event } = await req.json();
    const userId = event?.app_user_id;
    if (!userId) return new Response("Missing app_user_id", { status: 400 });

    const productId = String(event.product_id ?? "");
    const premiumPlusId = Deno.env.get("IOS_PREMIUM_PLUS_PRODUCT_ID") ?? "nyx_premium_plus_monthly";
    const premiumId = Deno.env.get("IOS_PREMIUM_PRODUCT_ID") ?? "nyx_premium_monthly";
    const knownProduct = productId === premiumId || productId === premiumPlusId;
    if (!knownProduct) return new Response("Ignored product", { status: 200 });

    const expiration = event.expiration_at_ms ? new Date(Number(event.expiration_at_ms)).toISOString() : null;
    const isActive = event.type !== "EXPIRATION" && (!expiration || Date.parse(expiration) > Date.now());
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.from("profiles").update({
      is_premium: isActive,
      premium_plan: isActive ? (productId === premiumPlusId ? "premium_plus" : "premium") : null,
      premium_expires_at: expiration,
    }).eq("id", userId);
    if (error) throw error;
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("revenuecat-webhook error", error);
    return new Response("Internal error", { status: 500 });
  }
});
