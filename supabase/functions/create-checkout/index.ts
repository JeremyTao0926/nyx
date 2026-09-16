import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Plan = "premium" | "premium_plus";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function priceForPlan(plan: Plan): string {
  const prices: Record<Plan, string> = {
    premium: Deno.env.get("STRIPE_PREMIUM_PRICE_ID") ?? "",
    premium_plus: Deno.env.get("STRIPE_PREMIUM_PLUS_PRICE_ID") ?? "",
  };
  if (!prices[plan]) throw new Error(`Missing Stripe price for ${plan}`);
  return prices[plan];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json() as { plan?: unknown };
    const plan = body.plan;
    if (plan !== "premium" && plan !== "premium_plus") {
      return json({ error: "Invalid plan" }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
    if (!stripeKey || !/^https:\/\//i.test(appUrl)) {
      console.error("create-checkout configuration is incomplete");
      return json({ error: "Payment service is not configured" }, 503);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const [{ data: profile, error: profileError }, { data: billing, error: billingError }] = await Promise.all([
      admin.from("profiles")
        .select("is_premium,premium_expires_at")
        .eq("id", authData.user.id)
        .single(),
      admin.from("billing_accounts")
        .select("stripe_customer_id,stripe_subscription_id")
        .eq("user_id", authData.user.id)
        .maybeSingle(),
    ]);
    if (profileError) throw profileError;
    if (billingError) throw billingError;

    const premiumStillActive = profile.is_premium === true
      && (!profile.premium_expires_at || Date.parse(profile.premium_expires_at) > Date.now());
    if (premiumStillActive && !billing?.stripe_subscription_id) {
      return json({ error: "An active subscription already exists" }, 409);
    }

    if (billing?.stripe_subscription_id) {
      const existing = await stripe.subscriptions.retrieve(billing.stripe_subscription_id);
      const existingIsLive = !["canceled", "incomplete_expired"].includes(existing.status)
        && existing.current_period_end * 1000 > Date.now();
      if (existingIsLive) {
        return json({ error: "Use the existing subscription to change plans" }, 409);
      }
    }

    const customer = billing?.stripe_customer_id || undefined;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceForPlan(plan), quantity: 1 }],
      success_url: `${appUrl}/?payment=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?payment=cancelled`,
      client_reference_id: authData.user.id,
      ...(customer
        ? { customer }
        : authData.user.email
          ? { customer_email: authData.user.email }
          : {}),
      metadata: { userId: authData.user.id, plan, source: "nyx_web" },
      subscription_data: {
        metadata: { userId: authData.user.id, plan, source: "nyx_web" },
      },
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("create-checkout error", error);
    return json({ error: "Unable to create checkout" }, 500);
  }
});
