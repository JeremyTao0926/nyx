import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

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

    const body = await req.json() as { plan?: unknown };
    if (body.plan !== "premium_plus") return json({ error: "Invalid upgrade target" }, 400);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const premiumPrice = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");
    const premiumPlusPrice = Deno.env.get("STRIPE_PREMIUM_PLUS_PRICE_ID");
    if (!stripeKey || !premiumPrice || !premiumPlusPrice) {
      return json({ error: "Payment service is not configured" }, 503);
    }

    const { data: billing, error: billingError } = await admin
      .from("billing_accounts")
      .select("stripe_subscription_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (billingError) throw billingError;
    if (!billing?.stripe_subscription_id) return json({ error: "No Stripe subscription found" }, 404);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
    const item = subscription.items.data[0];
    if (!item || item.price.id !== premiumPrice) {
      return json({ error: "Only Premium can be upgraded to Premium+" }, 409);
    }
    if (!["active", "trialing"].includes(subscription.status)) {
      return json({ error: "Subscription is not active" }, 409);
    }

    // Both prices are monthly. Give Premium+ access immediately and charge the
    // new rate at the normal renewal, avoiding a second subscription or an
    // off-session SCA payment failure.
    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: premiumPlusPrice, quantity: item.quantity ?? 1 }],
      proration_behavior: "none",
      payment_behavior: "error_if_incomplete",
      metadata: { ...subscription.metadata, userId: authData.user.id, plan: "premium_plus" },
    });

    const profilePatch = {
      is_premium: true,
      premium_plan: "premium_plus",
      premium_expires_at: new Date(updated.current_period_end * 1000).toISOString(),
    };
    const { error: updateError } = await admin
      .from("profiles")
      .update(profilePatch)
      .eq("id", authData.user.id);
    if (updateError) throw updateError;

    return json({ success: true, profile: profilePatch });
  } catch (error) {
    console.error("upgrade-subscription error", error);
    return json({ error: "Unable to upgrade subscription" }, 500);
  }
});
