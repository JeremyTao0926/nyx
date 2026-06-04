import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Read VAPID keys at module level (after env is ready)
const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@nyx.app";

if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
  console.error("VAPID keys not set! PUBLIC:", !!VAPID_PUBLIC, "PRIVATE:", !!VAPID_PRIVATE);
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log("VAPID configured OK, public key prefix:", VAPID_PUBLIC.slice(0, 10));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {

    const { recipient_id, title, body, url, sender_avatar } = await req.json();
    if (!recipient_id) return new Response("Missing recipient_id", { status: 400 });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", recipient_id);

    if (error) {
      console.error("DB error:", error);
      return new Response("DB error", { status: 500 });
    }

    if (!subs?.length) {
      console.log("No subscriptions for user:", recipient_id);
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: sender_avatar || "/favicon.svg",
      badge: "/favicon.svg",
      tag: "nyx-msg",
      url: url || "/",
    });

    let sent = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { urgency: "high", TTL: 86400 }
        );
        sent++;
        console.log("Push sent to:", sub.endpoint.slice(0, 50));
      } catch (e: any) {
        const statusCode = e?.statusCode || e?.status;
        console.error("Push failed:", statusCode, e?.message);
        errors.push(String(e?.message));
        // Remove expired subscriptions
        if (statusCode === 410 || statusCode === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          console.log("Removed expired subscription");
        }
      }
    }

    return new Response(
      JSON.stringify({ sent, total: subs.length, errors }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("Handler error:", e);
    return new Response("Internal error: " + String(e), { status: 500 });
  }
});
