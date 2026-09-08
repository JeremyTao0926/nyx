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

    const { data: files, error: listError } = await admin.storage.from("photos").list(uid, { limit: 1000 });
    if (listError) throw listError;
    if (files?.length) {
      const { error: storageError } = await admin.storage.from("photos").remove(files.map(file => `${uid}/${file.name}`));
      if (storageError) throw storageError;
    }

    // The profile row is the parent for app-owned records. Production
    // foreign keys must retain ON DELETE CASCADE.
    const { error: profileError } = await admin.from("profiles").delete().eq("id", uid);
    if (profileError) throw profileError;
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
