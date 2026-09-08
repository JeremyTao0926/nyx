import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ACTIVE_MODEL = "qwen/qwen3.6-27b";
const MODEL_ALIASES = new Map<string, string>([
  [ACTIVE_MODEL, ACTIVE_MODEL],
  // Keep the currently deployed web build working while clients update.
  ["llama-3.3-70b-versatile", ACTIVE_MODEL],
  ["meta-llama/llama-4-scout-17b-16e-instruct", ACTIVE_MODEL],
]);
const MAX_REQUEST_CHARS = 3_900_000;
const MAX_TEXT_CHARS = 120_000;

function hasValidMessages(value: unknown): value is Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) return false;
  let imageCount = 0;
  let textChars = 0;
  for (const rawMessage of value) {
    if (!rawMessage || typeof rawMessage !== "object") return false;
    const message = rawMessage as Record<string, unknown>;
    if (!["system", "user", "assistant"].includes(String(message.role))) return false;
    if (typeof message.content === "string") {
      textChars += message.content.length;
      continue;
    }
    if (!Array.isArray(message.content) || message.content.length > 6) return false;
    for (const rawPart of message.content) {
      if (!rawPart || typeof rawPart !== "object") return false;
      const part = rawPart as Record<string, unknown>;
      if (part.type === "text" && typeof part.text === "string") {
        textChars += part.text.length;
      } else if (part.type === "image_url") {
        const imageUrl = part.image_url as Record<string, unknown> | undefined;
        if (!imageUrl || typeof imageUrl.url !== "string" || !imageUrl.url.startsWith("data:image/")) return false;
        imageCount += 1;
      } else {
        return false;
      }
    }
  }
  return imageCount <= 3 && textChars <= MAX_TEXT_CHARS;
}

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

    const rawBody = await req.text();
    if (rawBody.length > MAX_REQUEST_CHARS) {
      return new Response("Request too large", { status: 413, headers: CORS });
    }
    const body = JSON.parse(rawBody);
    const upstreamModel = typeof body.model === "string" ? MODEL_ALIASES.get(body.model) : undefined;
    if (!upstreamModel || !hasValidMessages(body.messages)) {
      return new Response("Invalid request", { status: 400, headers: CORS });
    }
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("groq-proxy configuration error: GROQ_API_KEY is missing");
      return new Response(JSON.stringify({ error: "AI service is not configured" }), {
        status: 503,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const responseFormat = body.response_format?.type === "json_object"
      ? { type: "json_object" }
      : undefined;
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqApiKey}` },
      body: JSON.stringify({
        model: upstreamModel,
        messages: body.messages,
        temperature: Math.min(Math.max(Number(body.temperature) || 0.7, 0), 1.5),
        max_tokens: Math.min(Math.max(Number(body.max_tokens) || 400, 1), 4096),
        reasoning_effort: "none",
        ...(responseFormat ? { response_format: responseFormat } : {}),
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
