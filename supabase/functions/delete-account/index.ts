import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response("Missing Authorization header", { status: 401 });
    const jwt = authHeader.replace(/^Bearer\s+/i, "");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Verify the caller's own token — an account can only delete itself.
    const { data: authData, error: authErr } = await admin.auth.getUser(jwt);
    if (authErr || !authData?.user) return new Response("Invalid session", { status: 401 });
    const uid = authData.user.id;

    // Delete the profile row explicitly first — don't rely on the FK's
    // cascade behavior being configured, since the base `profiles` table
    // migration isn't tracked in this repo and we can't confirm it here.
    await admin.from("profiles").delete().eq("id", uid);
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) throw delErr;

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("delete-account error:", e);
    return new Response("Error: " + String(e), { status: 500 });
  }
});
