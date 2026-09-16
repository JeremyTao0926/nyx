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
    if (body.plan !== "premium") return json({ error: "Invalid downgrade target" }, 400);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Payment service is not configured" }, 503);
    const premiumPrice = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");
    const premiumPlusPrice = Deno.env.get("STRIPE_PREMIUM_PLUS_PRICE_ID");
    if (!premiumPrice || !premiumPlusPrice) {
      return json({ error: "Payment prices are not configured" }, 503);
    }

    const { data: billing, error: billingError } = await admin
      .from("billing_accounts")
      .select("stripe_subscription_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (billingError) throw billingError;
    if (!billing?.stripe_subscription_id) return json({ error: "No subscription found" }, 404);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
    const currentPrice = subscription.items.data[0]?.price.id;
    if (currentPrice !== premiumPlusPrice) {
      return json({ error: "Only Premium+ can be downgraded to Premium" }, 409);
    }

    const schedule = subscription.schedule
      ? await stripe.subscriptionSchedules.retrieve(
          typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule.id,
        )
      : await stripe.subscriptionSchedules.create({ from_subscription: subscription.id });

    const currentStart = schedule.current_phase?.start_date ?? subscription.current_period_start;
    const effectiveAt = subscription.current_period_end;
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      proration_behavior: "none",
      phases: [
        {
          start_date: currentStart,
          end_date: effectiveAt,
          items: subscription.items.data.map(item => ({
            price: item.price.id,
            quantity: item.quantity ?? 1,
          })),
          metadata: { ...subscription.metadata, userId: authData.user.id, plan: "premium_plus" },
          proration_behavior: "none",
        },
        {
          start_date: effectiveAt,
          items: [{ price: premiumPrice, quantity: 1 }],
          metadata: { ...subscription.metadata, userId: authData.user.id, plan: "premium" },
          proration_behavior: "none",
        },
      ],
    });

    return json({ success: true, effectiveAt: new Date(effectiveAt * 1000).toISOString() });
  } catch (error) {
    console.error("schedule-downgrade error", error);
    return json({ error: "Unable to schedule downgrade" }, 500);
  }
});
