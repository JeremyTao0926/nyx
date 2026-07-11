import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { userId, newPriceId, newPlan } = await req.json();

    // Get user's subscription ID
    const { data: profile } = await sb.from("profiles")
      .select("stripe_subscription_id")
      .eq("id", userId).single();

    if (!profile?.stripe_subscription_id) {
      return new Response("No subscription found", { status: 404 });
    }

    // Get subscription to find current item
    const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
    const itemId = sub.items.data[0].id;

    // Schedule downgrade at end of billing period (no proration)
    await stripe.subscriptions.update(profile.stripe_subscription_id, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: "none",
      billing_cycle_anchor: "unchanged",
    } as any);

    // Update DB to reflect pending downgrade
    await sb.from("profiles").update({
      premium_plan: newPlan,
    }).eq("id", userId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error(e);
    return new Response("Error: " + String(e), { status: 500 });
  }
});
