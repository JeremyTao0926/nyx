import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Read env every request — most reliable in Deno
    const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC") ?? "";
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") ?? "";
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@nyx.app";

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      console.error("VAPID keys missing! Check secrets.");
      return new Response("VAPID keys not configured", { status: 500 });
    }

    // Set VAPID details fresh each request
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const body = await req.json();
    const { recipient_id, title, body: msgBody, url, sender_avatar } = body;

    if (!recipient_id) return new Response("Missing recipient_id", { status: 400 });

    console.log("Sending push to:", recipient_id, "title:", title);

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

    console.log("Found subscriptions:", subs?.length ?? 0);

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscriptions" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const payload = JSON.stringify({
      title: title ?? "NYX",
      body: msgBody ?? "",
      icon: sender_avatar || "/favicon.svg",
      badge: "/favicon.svg",
      tag: "nyx-msg",
      url: url || "/",
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        const result = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { urgency: "high", TTL: 86400 }
        );
        console.log("Push sent, status:", result.statusCode);
        sent++;
      } catch (e: any) {
        console.error("Push error:", e?.statusCode, e?.message);
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          console.log("Removed expired sub");
        }
      }
    }

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("Fatal error:", e);
    return new Response("Error: " + String(e), { status: 500 });
  }
});
