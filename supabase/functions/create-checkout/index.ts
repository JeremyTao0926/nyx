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
    const { priceId, userId, userEmail, plan } = await req.json();

    if (!priceId || !userId) return new Response("Missing params", { status: 400 });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${Deno.env.get("APP_URL")}/?payment=success&plan=${plan}`,
      cancel_url: `${Deno.env.get("APP_URL")}/?payment=cancelled`,
      customer_email: userEmail,
      metadata: { userId, plan },
      subscription_data: { metadata: { userId, plan } },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Checkout error:", e);
    return new Response("Error: " + String(e), { status: 500 });
  }
});
