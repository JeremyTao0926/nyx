import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ALLOWED_MODELS = new Set(["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return new Response("Unauthorized", { status: 401, headers: CORS });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response("Unauthorized", { status: 401, headers: CORS });

    const body = await req.json();
    if (!ALLOWED_MODELS.has(body.model) || !Array.isArray(body.messages)) {
      return new Response("Invalid request", { status: 400, headers: CORS });
    }
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("GROQ_API_KEY")}` },
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        temperature: Math.min(Math.max(Number(body.temperature) || 0.7, 0), 1.5),
        max_tokens: Math.min(Math.max(Number(body.max_tokens) || 400, 1), 2048),
      }),
    });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("groq-proxy error", error);
    return new Response("Internal error", { status: 500, headers: CORS });
  }
});
