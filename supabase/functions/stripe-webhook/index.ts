import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

type Plan = "premium" | "premium_plus";

function planForPrice(priceId: string): Plan | null {
  const premiumPrice = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");
  const premiumPlusPrice = Deno.env.get("STRIPE_PREMIUM_PLUS_PRICE_ID");
  if (priceId === premiumPrice) return "premium";
  if (priceId === premiumPlusPrice) return "premium_plus";
  return null;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const premiumPrice = Deno.env.get("STRIPE_PREMIUM_PRICE_ID");
  const premiumPlusPrice = Deno.env.get("STRIPE_PREMIUM_PLUS_PRICE_ID");
  if (!stripeKey || !webhookSecret || !premiumPrice || !premiumPlusPrice) {
    console.error("stripe-webhook configuration is incomplete");
    return new Response("Webhook is not configured", { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });
  const rawBody = await req.text();
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("stripe-webhook signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  async function syncSubscription(subscription: Stripe.Subscription) {
    const priceId = subscription.items.data[0]?.price.id ?? "";
    const plan = planForPrice(priceId);
    if (!plan) {
      console.warn("Ignoring subscription with an unknown Stripe price", subscription.id, priceId);
      return;
    }

    let userId = subscription.metadata?.userId;
    if (!userId) {
      const { data: existing } = await admin
        .from("billing_accounts")
        .select("user_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();
      userId = existing?.user_id;
    }
    if (!userId) {
      console.error("Unable to map Stripe subscription to a NYX user", subscription.id);
      return;
    }

    const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
    const isActive = ["active", "trialing", "past_due"].includes(subscription.status)
      && subscription.current_period_end * 1000 > Date.now();
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

    const { error: billingError } = await admin.from("billing_accounts").upsert({
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (billingError) throw billingError;

    const { error } = await admin.from("profiles").update({
      is_premium: isActive,
      premium_plan: isActive ? plan : null,
      premium_expires_at: expiresAt,
    }).eq("id", userId);
    if (error) throw error;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      if (subscriptionId) await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
    }

    if (
      event.type === "customer.subscription.created"
      || event.type === "customer.subscription.updated"
      || event.type === "customer.subscription.deleted"
      || event.type === "customer.subscription.paused"
      || event.type === "customer.subscription.resumed"
    ) {
      await syncSubscription(event.data.object as Stripe.Subscription);
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string"
        ? invoice.subscription
        : invoice.subscription?.id;
      if (subscriptionId) await syncSubscription(await stripe.subscriptions.retrieve(subscriptionId));
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stripe-webhook handler failed", event.id, error);
    return new Response("Webhook processing failed", { status: 500 });
  }
});
