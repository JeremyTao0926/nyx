import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Pure Deno Web Push (no npm deps) ──────────────────────

function b64u(buf: Uint8Array | ArrayBuffer): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

function b64uDec(s: string): Uint8Array {
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  const raw = atob(s);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function makeJWT(sub: string, aud: string, privateKeyB64u: string, publicKeyB64u: string): Promise<string> {
  const header = b64u(new TextEncoder().encode(JSON.stringify({typ:"JWT",alg:"ES256"})));
  const now = Math.floor(Date.now()/1000);
  const payload = b64u(new TextEncoder().encode(JSON.stringify({iss:sub, sub, aud, exp:now+43200, iat:now})));
  const msg = `${header}.${payload}`;

  const pubRaw = b64uDec(publicKeyB64u);
  const privKey = await crypto.subtle.importKey(
    "jwk",
    { kty:"EC", crv:"P-256", d:privateKeyB64u,
      x: b64u(pubRaw.slice(1,33)), y: b64u(pubRaw.slice(33,65)) },
    { name:"ECDSA", namedCurve:"P-256" }, false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name:"ECDSA", hash:"SHA-256" },
    privKey,
    new TextEncoder().encode(msg)
  );
  return `${msg}.${b64u(sig)}`;
}

async function encryptPayload(plaintext: string, clientPub: string, clientAuth: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const serverKP = await crypto.subtle.generateKey(
    { name:"ECDH", namedCurve:"P-256" }, true, ["deriveBits"]
  );
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKP.publicKey));

  const clientPubKey = await crypto.subtle.importKey(
    "raw", b64uDec(clientPub), { name:"ECDH", namedCurve:"P-256" }, false, []
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name:"ECDH", public:clientPubKey }, serverKP.privateKey, 256
  );

  const authBuf = b64uDec(clientAuth);
  const enc = new TextEncoder();

  const ikm = await crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveBits"]);

  const prk = await crypto.subtle.deriveBits(
    { name:"HKDF", hash:"SHA-256", salt:authBuf,
      info: enc.encode("Content-Encoding: auth\0") },
    ikm, 256
  );
  const prkKey = await crypto.subtle.importKey("raw", prk, "HKDF", false, ["deriveBits"]);

  const keyInfo = new Uint8Array([...enc.encode("Content-Encoding: aes128gcm\0"), 1]);
  const nonceInfo = new Uint8Array([...enc.encode("Content-Encoding: nonce\0"), 1]);

  const [keyBits, nonceBits] = await Promise.all([
    crypto.subtle.deriveBits({ name:"HKDF", hash:"SHA-256", salt, info:keyInfo }, prkKey, 128),
    crypto.subtle.deriveBits({ name:"HKDF", hash:"SHA-256", salt, info:nonceInfo }, prkKey, 96),
  ]);

  const aesKey = await crypto.subtle.importKey("raw", keyBits, "AES-GCM", false, ["encrypt"]);
  const padded = new Uint8Array([...enc.encode(plaintext), 2]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name:"AES-GCM", iv:nonceBits }, aesKey, padded));

  // aes128gcm content-coding header (RFC 8188)
  const hdr = new Uint8Array(21 + serverPubRaw.length);
  hdr.set(salt);
  new DataView(hdr.buffer).setUint32(16, 4096, false);
  hdr[20] = serverPubRaw.length;
  hdr.set(serverPubRaw, 21);

  const body = new Uint8Array(hdr.length + cipher.length);
  body.set(hdr); body.set(cipher, hdr.length);
  return body;
}

async function sendWebPush(
  endpoint: string, p256dh: string, auth: string,
  payload: string, pubKey: string, privKey: string, subject: string
): Promise<number> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await makeJWT(subject, audience, privKey, pubKey);

  const body = await encryptPayload(payload, p256dh, auth);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "Authorization": `vapid t=${jwt},k=${pubKey}`,
      "TTL": "86400",
      "Urgency": "high",
    },
    body,
  });

  console.log(`Push to ${endpoint.slice(0,50)}... → ${res.status}`);
  if (!res.ok && res.status !== 201) {
    const txt = await res.text().catch(() => "");
    console.error("Push response:", txt.slice(0,200));
  }
  return res.status;
}

// ── Handler ──────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC")  ?? "";
  const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") ?? "";
  const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@nyx.app";

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error("VAPID keys missing");
    return new Response("VAPID keys not set", { status: 500 });
  }

  try {
    const { recipient_id, title, body, url, sender_avatar } = await req.json();
    if (!recipient_id) return new Response("Missing recipient_id", { status: 400 });

    console.log("send-push →", recipient_id, title);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", recipient_id);

    if (error) { console.error(error); return new Response("DB error", { status: 500 }); }

    console.log("subscriptions found:", subs?.length ?? 0);
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent:0, reason:"no_subscriptions" }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" }
      });
    }

    const notification = JSON.stringify({
      title, body, icon: sender_avatar || "/favicon.svg",
      badge: "/favicon.svg", tag: "nyx-msg", url: url || "/"
    });

    let sent = 0;
    for (const sub of subs) {
      try {
        const status = await sendWebPush(
          sub.endpoint, sub.p256dh, sub.auth,
          notification, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT
        );
        if ([200,201,202].includes(status)) sent++;
        if ([404,410].includes(status)) {
          await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      } catch(e) {
        console.error("sendWebPush error:", e);
      }
    }

    return new Response(JSON.stringify({ sent, total: subs.length }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" }
    });

  } catch(e) {
    console.error("Fatal:", e);
    return new Response("Error: " + String(e), { status: 500 });
  }
});
