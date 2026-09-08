import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return new Response("Unauthorized", { status: 401, headers: CORS });
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

    const { text, image } = await req.json();
    if ((!text && !image) || String(text ?? "").length > 4000 || String(image ?? "").length > 8_000_000) {
      return new Response("Invalid content", { status: 400, headers: CORS });
    }
    const content = image
      ? [
          { type: "text", text: "Review this user-uploaded image and optional caption for a dating app. Caption: " + String(text ?? "") },
          { type: "image_url", image_url: { url: image } },
        ]
      : String(text);
    const model = image ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile";
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 120,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a strict safety classifier. Reject sexual or nude content, sexual solicitation, minors, violence, threats, hate, harassment, scams, illegal goods, personal data doxxing, and graphic content. Return only JSON: {\"allowed\":boolean,\"reason\":\"short Traditional Chinese reason\"}. Normal consensual dating conversation is allowed." },
          { role: "user", content },
        ],
      }),
    });
    if (!upstream.ok) throw new Error(`Moderation provider error ${upstream.status}`);
    const result = await upstream.json();
    const verdict = JSON.parse(result.choices?.[0]?.message?.content ?? "{}");
    if (typeof verdict.allowed !== "boolean") throw new Error("Invalid moderation response");
    return new Response(JSON.stringify({ allowed: verdict.allowed, reason: verdict.reason || "內容不符合社群規範" }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("moderate-content error", error);
    return new Response("Moderation unavailable", { status: 503, headers: CORS });
  }
});
