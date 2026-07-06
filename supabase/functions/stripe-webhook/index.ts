import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    event = stripe.webhooks.constructEvent(body, signature!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (e) {
    console.error("Webhook signature failed:", e);
    return new Response("Invalid signature", { status: 400 });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const getPlan = (meta: any) => meta?.plan || "premium";

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.CheckoutSession;
    const userId = session.metadata?.userId;
    const plan = getPlan(session.metadata);
    if (userId) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await sb.from("profiles").update({
        is_premium: true,
        premium_plan: plan,
        premium_expires_at: expiresAt.toISOString(),
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
      }).eq("id", userId);
      console.log("Premium activated:", userId, plan);
    }
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused") {
    const sub = event.data.object as Stripe.Subscription;
    const userId = sub.metadata?.userId;
    if (userId) {
      await sb.from("profiles").update({
        is_premium: false,
        premium_plan: null,
        premium_expires_at: null,
      }).eq("id", userId);
      console.log("Premium cancelled:", userId);
    }
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = invoice.subscription as string;
    if (subId) {
      const { data: sub } = await sb.from("profiles").select("id").eq("stripe_subscription_id", subId).maybeSingle();
      if (sub) {
        await sb.from("profiles").update({ is_premium: false }).eq("id", sub.id);
        console.log("Premium payment failed, deactivated:", sub.id);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
